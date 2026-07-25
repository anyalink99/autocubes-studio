import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Browser, BrowserContext, Page} from 'playwright';
import {
  paintConfiguredVideoFrames,
  prepareEmbeddedMediaOverrides,
} from './embedded-media';
import {FrameLockedCaptureConfig} from './types';
import {ensureCleanDir, normalizePath} from './utils';

const execFileAsync = promisify(execFile);

type CaptureInput = {
  browser: Browser;
  url: string;
  root: string;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  config: FrameLockedCaptureConfig;
  notes: string[];
};

export type VideoCadenceReport = {
  file: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  duration: number;
  uniqueDecodedFrames: number;
  duplicateDecodedFrames: number;
  freezeEvents: number;
  meanFrameDifference: number;
  maxFrameDifference: number;
  temporalSpikeEvents: number;
  temporalSpikeFrames: number[];
};

const interpolateScroll = (
  frame: number,
  keyframes: FrameLockedCaptureConfig['scrollKeyframes'],
) => {
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (sorted.length === 0) return 0;
  if (frame <= sorted[0].frame) return sorted[0].y;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const next = sorted[index];
    if (frame <= next.frame) {
      const progress = (frame - previous.frame) / (next.frame - previous.frame);
      return previous.y + (next.y - previous.y) * progress;
    }
  }

  return sorted[sorted.length - 1].y;
};

const addDeterministicClock = async (context: BrowserContext) => {
  await context.addInitScript(`
    (() => {
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
      const nativePerformanceNow = performance.now.bind(performance);
      const nativeDateNow = Date.now.bind(Date);
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);
      let enabled = false;
      let virtualTime = 0;
      let epoch = nativeDateNow();
      let nextId = 1;
      const callbacks = new Map();
      const timers = new Map();

      const invokeTimer = (timer) => {
        if (typeof timer.callback === 'function') {
          timer.callback(...timer.args);
          return;
        }
        Function(String(timer.callback))();
      };

      const scheduleNativeTimer = (id) => {
        const timer = timers.get(id);
        if (!timer || enabled) return;
        const delay = Math.max(0, timer.dueAt - nativePerformanceNow());
        timer.nativeHandle = nativeSetTimeout(() => {
          const current = timers.get(id);
          if (!current || enabled) return;
          current.nativeHandle = undefined;
          if (current.interval === null) {
            timers.delete(id);
          } else {
            current.dueAt += current.interval;
          }
          invokeTimer(current);
          if (current.interval !== null && timers.get(id) === current) {
            scheduleNativeTimer(id);
          }
        }, delay);
      };

      const scheduleTimer = (callback, delay, interval, args) => {
        const id = nextId++;
        const numericDelay = Math.max(0, Number(delay) || 0);
        const timer = {
          callback,
          args,
          interval: interval ? Math.max(1, numericDelay) : null,
          dueAt: (enabled ? virtualTime : nativePerformanceNow()) + numericDelay,
          nativeHandle: undefined,
        };
        timers.set(id, timer);
        if (!enabled) scheduleNativeTimer(id);
        return id;
      };

      const clearTimer = (id) => {
        const timer = timers.get(id);
        if (!timer) return;
        if (timer.nativeHandle !== undefined) {
          nativeClearTimeout(timer.nativeHandle);
        }
        timers.delete(id);
      };

      try {
        Object.defineProperty(performance, 'now', {
          configurable: true,
          value: () => enabled ? virtualTime : nativePerformanceNow(),
        });
      } catch {}

      Date.now = () => enabled ? Math.round(epoch + virtualTime) : nativeDateNow();
      window.setTimeout = (callback, delay, ...args) =>
        scheduleTimer(callback, delay, false, args);
      window.clearTimeout = clearTimer;
      window.setInterval = (callback, delay, ...args) =>
        scheduleTimer(callback, delay, true, args);
      window.clearInterval = clearTimer;
      window.requestAnimationFrame = (callback) => {
        if (!enabled) return nativeRequestAnimationFrame(callback);
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        if (!enabled) {
          nativeCancelAnimationFrame(id);
          return;
        }
        callbacks.delete(id);
      };
      window.__captureEnable = () => {
        if (enabled) return;
        virtualTime = nativePerformanceNow();
        epoch = nativeDateNow() - virtualTime;
        for (const timer of timers.values()) {
          if (timer.nativeHandle !== undefined) {
            nativeClearTimeout(timer.nativeHandle);
            timer.nativeHandle = undefined;
          }
        }
        enabled = true;
      };
      window.__captureStep = (seconds) => {
        const targetTime = virtualTime + seconds * 1000;
        let executions = 0;
        while (true) {
          let dueId = null;
          let dueTimer = null;
          for (const [id, timer] of timers) {
            if (
              timer.dueAt <= targetTime &&
              (!dueTimer ||
                timer.dueAt < dueTimer.dueAt ||
                (timer.dueAt === dueTimer.dueAt && id < dueId))
            ) {
              dueId = id;
              dueTimer = timer;
            }
          }
          if (!dueTimer || dueId === null) break;
          executions += 1;
          if (executions > 10000) {
            throw new Error('Deterministic timer runaway');
          }
          virtualTime = dueTimer.dueAt;
          if (dueTimer.interval === null) {
            timers.delete(dueId);
          } else {
            dueTimer.dueAt += dueTimer.interval;
          }
          invokeTimer(dueTimer);
        }
        virtualTime = targetTime;
        const batch = [...callbacks.values()];
        callbacks.clear();
        for (const callback of batch) callback(virtualTime);
      };
      window.__captureNativeSetTimeout = nativeSetTimeout;
      window.__captureNativeClearTimeout = nativeClearTimeout;
      window.__captureFlush = () => {
        void document.documentElement.offsetHeight;
      };
    })();
  `);
};

const warmPage = async (page: Page, step: number) => {
  const maxScroll = await page.evaluate(
    () =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) -
      window.innerHeight,
  );

  for (let y = 0; y <= maxScroll; y += step) {
    await page.evaluate((target) => window.scrollTo(0, target), y);
    await page.waitForTimeout(90);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
};



const parseRate = (rate: string) => {
  const [numerator, denominator] = rate.split('/').map(Number);
  return denominator ? numerator / denominator : numerator;
};

export const inspectVideoCadence = async (
  file: string,
  options: {
    expectedFps: number;
    expectedFrames?: number;
    maxDuplicateFrames?: number;
    maxFreezeEvents?: number;
    maxTemporalSpikeEvents?: number;
    temporalSpikeRatio?: number;
    temporalSpikeMinDifference?: number;
  },
): Promise<VideoCadenceReport> => {
  const {stdout: probeOutput} = await execFileAsync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,r_frame_rate,avg_frame_rate,nb_frames,duration',
      '-of',
      'json',
      file,
    ],
    {maxBuffer: 20 * 1024 * 1024},
  );
  const stream = JSON.parse(probeOutput).streams?.[0];
  if (!stream) throw new Error(`No video stream in ${file}`);

  const averageFps = parseRate(stream.avg_frame_rate);
  const nominalFps = parseRate(stream.r_frame_rate);
  const frames = Number(stream.nb_frames);
  const duration = Number(stream.duration);
  if (
    Math.abs(averageFps - options.expectedFps) > 0.001 ||
    Math.abs(nominalFps - options.expectedFps) > 0.001
  ) {
    throw new Error(
      `Non-CFR video: nominal=${nominalFps}, average=${averageFps}, expected=${options.expectedFps}`,
    );
  }
  if (options.expectedFrames !== undefined && frames !== options.expectedFrames) {
    throw new Error(`Frame count ${frames}; expected ${options.expectedFrames}`);
  }

  const {stdout: frameMd5} = await execFileAsync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', file, '-map', '0:v:0', '-f', 'framemd5', '-'],
    {maxBuffer: 40 * 1024 * 1024},
  );
  const hashes = frameMd5
    .split(/\r?\n/)
    .filter((line) => /^\s*\d/.test(line))
    .map((line) => line.split(',').at(-1)?.trim() ?? '');
  const uniqueDecodedFrames = new Set(hashes).size;
  const duplicateDecodedFrames = hashes.length - uniqueDecodedFrames;
  if (duplicateDecodedFrames > (options.maxDuplicateFrames ?? 0)) {
    throw new Error(
      `${duplicateDecodedFrames} duplicate decoded frames; allowed ${options.maxDuplicateFrames ?? 0}`,
    );
  }

  let freezeOutput = '';
  try {
    const result = await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-i',
        file,
        '-vf',
        'freezedetect=n=0.002:d=0.1',
        '-f',
        'null',
        '-',
      ],
      {maxBuffer: 20 * 1024 * 1024},
    );
    freezeOutput = `${result.stdout}\n${result.stderr}`;
  } catch (error) {
    const failure = error as {stdout?: string; stderr?: string};
    freezeOutput = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`;
  }
  const freezeEvents = (freezeOutput.match(/freeze_duration:/g) ?? []).length;
  if (freezeEvents > (options.maxFreezeEvents ?? 0)) {
    throw new Error(
      `${freezeEvents} freeze events; allowed ${options.maxFreezeEvents ?? 0}`,
    );
  }

  const {stdout: differenceOutput} = await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      file,
      '-vf',
      'scale=270:480,format=gray,tblend=all_mode=difference,signalstats,metadata=print:file=-',
      '-an',
      '-f',
      'null',
      '-',
    ],
    {maxBuffer: 20 * 1024 * 1024},
  );
  const frameDifferences = [...differenceOutput.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  };
  const temporalSpikeRatio = options.temporalSpikeRatio ?? 2.2;
  const temporalSpikeMinDifference = options.temporalSpikeMinDifference ?? 18;
  const temporalSpikeFrames = frameDifferences.flatMap((difference, index) => {
    const neighborhood = [
      ...frameDifferences.slice(Math.max(0, index - 4), index),
      ...frameDifferences.slice(index + 1, index + 5),
    ];
    const localMedian = median(neighborhood);
    return difference > temporalSpikeMinDifference &&
      difference > localMedian * temporalSpikeRatio
      ? [index + 1]
      : [];
  });
  if (temporalSpikeFrames.length > (options.maxTemporalSpikeEvents ?? 0)) {
    throw new Error(
      `${temporalSpikeFrames.length} temporal discontinuities at frames ${temporalSpikeFrames
        .slice(0, 16)
        .join(', ')}; allowed ${options.maxTemporalSpikeEvents ?? 0}`,
    );
  }

  return {
    file: normalizePath(file),
    width: Number(stream.width),
    height: Number(stream.height),
    fps: averageFps,
    frames,
    duration,
    uniqueDecodedFrames,
    duplicateDecodedFrames,
    freezeEvents,
    meanFrameDifference:
      frameDifferences.reduce((sum, value) => sum + value, 0) /
      Math.max(1, frameDifferences.length),
    maxFrameDifference: Math.max(0, ...frameDifferences),
    temporalSpikeEvents: temporalSpikeFrames.length,
    temporalSpikeFrames,
  };
};

export const captureFrameLockedBrowser = async ({
  browser,
  url,
  root,
  viewport,
  config,
  notes,
}: CaptureInput) => {
  const framesDir = path.join(root, 'frame-locked-frames');
  const output = path.join(root, 'capture.mp4');
  await ensureCleanDir(framesDir);
  const embeddedMediaOverrides = await prepareEmbeddedMediaOverrides({
    pageUrl: url,
    root,
    fps: config.fps,
    normalizations: config.embeddedVideoNormalizations,
    notes,
  });
  const mediaOverrideMap = Object.fromEntries(
    embeddedMediaOverrides.map((override) => [
      override.src,
      {
        decoderSrc: override.decoderSrc,
        frameCount: override.frameCount,
      },
    ]),
  );

  const context = await browser.newContext({
    viewport: {width: viewport.width, height: viewport.height},
    deviceScaleFactor: viewport.deviceScaleFactor,
  });
  for (const override of embeddedMediaOverrides) {
    await context.route(`${override.decoderSrc}**`, async (route) => {
      const frameName = path.basename(new URL(route.request().url()).pathname);
      if (!/^frame-\d{6}\.jpg$/.test(frameName)) {
        await route.abort();
        return;
      }
      const frameFile = path.join(override.frameDir, frameName);
      const frameBytes = await fs.readFile(frameFile);
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': String(frameBytes.length),
        },
        body: frameBytes,
      });
    });
  }
  await addDeterministicClock(context);
  const warmupPage = await context.newPage();
  try {
    await warmupPage.goto(url, {waitUntil: 'networkidle', timeout: 120_000});
    await warmPage(warmupPage, config.warmupStepPx ?? 1000);
    notes.push('asset-warmup:separate-page');
  } finally {
    await warmupPage.close();
  }

  const page = await context.newPage();

  try {
    await page.goto(url, {waitUntil: 'networkidle', timeout: 120_000});
    await page.addStyleTag({
      content: '* { cursor: none !important; } html { scroll-behavior: auto !important; }',
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const captureWindow = window as typeof window & {
        __captureEnable: () => void;
        __captureFlush: () => void;
      };
      captureWindow.__captureEnable();
      captureWindow.__captureFlush();
    });

    const sourceHashes = new Set<string>();
    const transformTracks = (config.transformContinuityTracks ?? []).map(
      (track) => ({
        ...track,
        samples: [] as {
          frame: number;
          x: number;
          y: number;
          rotation: number;
          scale: number;
          opacity: number;
          descendants: {
            index: number;
            x: number;
            y: number;
            visible: boolean;
          }[];
        }[],
      }),
    );
    const embeddedCadence = new Map<
      string,
      {
        comparisons: number;
        duplicates: number;
        backwards: number;
        loopWraps: number;
        lastFrame: number;
        lastMediaTime: number;
      }
    >();
    for (let frame = 0; frame < config.frames; frame += 1) {
      const targetY = interpolateScroll(frame, config.scrollKeyframes);
      const position = await page.evaluate(
        ({targetY: y, halfStep}) => {
          const captureWindow = window as typeof window & {
            __captureStep: (seconds: number) => void;
            __captureFlush: () => void;
          };
          window.scrollTo(0, y);
          captureWindow.__captureStep(halfStep);
          captureWindow.__captureStep(halfStep);
          window.scrollTo(0, y);
          captureWindow.__captureFlush();
          const maxScroll =
            Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) -
            innerHeight;
          return {actualY: scrollY, maxScroll};
        },
        {targetY, halfStep: 1 / config.fps / 2},
      );
      const expectedY = Math.max(0, Math.min(targetY, position.maxScroll));
      if (Math.abs(position.actualY - expectedY) > 1) {
        throw new Error(
          `Scroll mismatch at frame ${frame}: target=${expectedY}, actual=${position.actualY}`,
        );
      }

      const proxyReport = await paintConfiguredVideoFrames(
        page,
        frame,
        config.fps,
        config.preloadMarginPx ?? 500,
        config.videoReadyTimeoutMs ?? 12_000,
        mediaOverrideMap,
      );
      if (proxyReport.unconfiguredSources.length > 0) {
        throw new Error(
          `Visible embedded video has no JPEG frame cache at ${frame}: ${proxyReport.unconfiguredSources.join(', ')}`,
        );
      }
      const badVideo = proxyReport.videos.find(
        (video) =>
          video.readyState < 2 ||
          video.loadResult === 'timeout' ||
          video.loadResult === 'error',
      );
      if (badVideo) {
        throw new Error(
          `Video frame unavailable at ${frame}: ${badVideo.src} (${badVideo.loadResult})`,
        );
      }
      const transformSamples = await page.evaluate((tracks) => {
        (
          window as typeof window & {
            __captureFlush: () => void;
          }
        ).__captureFlush();
        return tracks.map((track) => {
          let element = document.querySelector<HTMLElement>(track.selector);
          for (
            let level = 0;
            element && level < (track.ancestorLevels ?? 0);
            level += 1
          ) {
            element = element.parentElement;
          }
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          const margin = track.viewportMarginPx ?? 0;
          if (
            rect.width <= 2 ||
            rect.height <= 2 ||
            rect.bottom < -margin ||
            rect.top > innerHeight + margin
          ) {
            return null;
          }
          const style = getComputedStyle(element);
          const matrix = new DOMMatrixReadOnly(style.transform);
          return {
            x: matrix.m41,
            y: matrix.m42,
            rotation: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
            scale: Math.hypot(matrix.a, matrix.b),
            opacity: Number(style.opacity),
            descendants: track.descendantSelector
              ? [
                  ...element.querySelectorAll<HTMLElement>(
                    track.descendantSelector,
                  ),
                ].map((descendant, index) => {
                  const descendantRect = descendant.getBoundingClientRect();
                  return {
                    index,
                    x: descendantRect.left,
                    y: descendantRect.top,
                    visible:
                      descendantRect.right > 2 &&
                      descendantRect.left < innerWidth - 2 &&
                      descendantRect.bottom > 2 &&
                      descendantRect.top < innerHeight - 2,
                  };
                })
              : [],
          };
        });
      }, config.transformContinuityTracks ?? []);
      for (const [index, sample] of transformSamples.entries()) {
        if (
          !sample ||
          ![sample.x, sample.y, sample.rotation, sample.scale, sample.opacity].every(
            (value) => Number.isFinite(value),
          )
        ) {
          continue;
        }
        transformTracks[index].samples.push({frame, ...sample});
      }
      for (const video of proxyReport.videos) {
        if (!Number.isFinite(video.presentedMediaTime)) continue;
        const mediaTime = video.presentedMediaTime as number;
        const previous = embeddedCadence.get(video.src);
        if (!previous) {
          embeddedCadence.set(video.src, {
            comparisons: 0,
            duplicates: 0,
            backwards: 0,
            loopWraps: 0,
            lastFrame: frame,
            lastMediaTime: mediaTime,
          });
          continue;
        }
        if (previous.lastFrame === frame - 1) {
          previous.comparisons += 1;
          if (Math.abs(previous.lastMediaTime - mediaTime) < 0.000_001) {
            previous.duplicates += 1;
          }
          const expectedLoopWrap =
            video.loop &&
            Number.isFinite(video.duration) &&
            (video.duration as number) > 0 &&
            previous.lastMediaTime >= (video.duration as number) - 1.5 / config.fps &&
            mediaTime <= 1.5 / config.fps;
          if (
            mediaTime < previous.lastMediaTime - 0.000_001 &&
            !expectedLoopWrap
          ) {
            previous.backwards += 1;
          }
          if (expectedLoopWrap) {
            previous.loopWraps += 1;
          }
        }
        previous.lastFrame = frame;
        previous.lastMediaTime = mediaTime;
      }

      const frameFile = path.join(framesDir, `frame-${String(frame).padStart(6, '0')}.jpg`);
      await page.screenshot({
        path: frameFile,
        type: 'jpeg',
        quality: config.jpegQuality ?? 92,
      });
      const frameBytes = await fs.readFile(frameFile);
      sourceHashes.add(crypto.createHash('sha256').update(frameBytes).digest('hex'));
    }

    const duplicateSourceFrames = config.frames - sourceHashes.size;
    if (duplicateSourceFrames > (config.maxDuplicateFrames ?? 0)) {
      throw new Error(
        `${duplicateSourceFrames} duplicate source frames; allowed ${config.maxDuplicateFrames ?? 0}`,
      );
    }

    const maxEmbeddedDuplicateRatio = config.maxEmbeddedDuplicateRatio ?? 0.25;
    const embeddedReports = [...embeddedCadence].flatMap(([src, cadence]) => {
      if (cadence.comparisons < 6) return [];
      return [
        {
          src,
          comparisons: cadence.comparisons,
          duplicates: cadence.duplicates,
          backwards: cadence.backwards,
          loopWraps: cadence.loopWraps,
          ratio: cadence.duplicates / cadence.comparisons,
        },
      ];
    });
    const choppyEmbeddedVideo = embeddedReports.find(
      (report) => report.ratio > maxEmbeddedDuplicateRatio,
    );
    if (choppyEmbeddedVideo) {
      throw new Error(
        `Embedded video cadence ${choppyEmbeddedVideo.src}: ${choppyEmbeddedVideo.duplicates}/${choppyEmbeddedVideo.comparisons} repeated media frames (${(choppyEmbeddedVideo.ratio * 100).toFixed(1)}%); allowed ${(maxEmbeddedDuplicateRatio * 100).toFixed(1)}%`,
      );
    }
    const reversingEmbeddedVideo = embeddedReports.find(
      (report) => report.backwards > 0,
    );
    if (reversingEmbeddedVideo) {
      throw new Error(
        `Embedded video direction ${reversingEmbeddedVideo.src}: ${reversingEmbeddedVideo.backwards} backwards media-time steps`,
      );
    }
    const maxEmbeddedLoopWraps = config.maxEmbeddedLoopWraps ?? 0;
    const wrappingEmbeddedVideo = embeddedReports.find(
      (report) => report.loopWraps > maxEmbeddedLoopWraps,
    );
    if (wrappingEmbeddedVideo) {
      throw new Error(
        `Embedded video loop ${wrappingEmbeddedVideo.src}: ${wrappingEmbeddedVideo.loopWraps} visible loop wraps; allowed ${maxEmbeddedLoopWraps}`,
      );
    }
    notes.push(
      ...embeddedReports.map(
        (report) =>
          `embedded-cadence:${report.src}:duplicates=${report.duplicates}/${report.comparisons}:backwards=${report.backwards}:loop-wraps=${report.loopWraps}`,
      ),
    );
    for (const track of transformTracks) {
      if (track.samples.length < (track.minSamples ?? 2)) {
        throw new Error(
          `Transform track ${track.id}: ${track.samples.length} visible samples; expected at least ${track.minSamples ?? 2}`,
        );
      }
      const deltas = track.samples.flatMap((sample, index) => {
        if (index === 0) return [];
        const previous = track.samples[index - 1];
        if (sample.frame !== previous.frame + 1) return [];
        const dx = sample.x - previous.x;
        const dy = sample.y - previous.y;
        const rotation =
          ((sample.rotation - previous.rotation + 540) % 360) - 180;
        return [
          {
            axis:
              track.axis === 'x'
                ? dx
                : track.axis === 'y'
                  ? dy
                  : Math.hypot(dx, dy),
            translation: Math.hypot(dx, dy),
            rotation,
            scale: sample.scale - previous.scale,
            opacity: sample.opacity - previous.opacity,
          },
        ];
      });
      const directionViolations =
        track.direction && track.axis
          ? deltas.filter((delta) =>
              track.direction === 'negative'
                ? delta.axis > 0.01
                : delta.axis < -0.01,
            )
          : [];
      const translationViolations = deltas.filter(
        (delta) =>
          track.maxTranslationStep !== undefined &&
          Math.abs(
            track.axis === undefined ? delta.translation : delta.axis,
          ) > track.maxTranslationStep,
      );
      const rotationViolations = deltas.filter(
        (delta) =>
          track.maxRotationStepDeg !== undefined &&
          Math.abs(delta.rotation) > track.maxRotationStepDeg,
      );
      const scaleViolations = deltas.filter(
        (delta) =>
          track.maxScaleStep !== undefined &&
          Math.abs(delta.scale) > track.maxScaleStep,
      );
      const opacityViolations = deltas.filter(
        (delta) =>
          track.maxOpacityStep !== undefined &&
          Math.abs(delta.opacity) > track.maxOpacityStep,
      );
      const descendantDeltas = track.samples.flatMap((sample, index) => {
        if (index === 0) return [];
        const previous = track.samples[index - 1];
        if (sample.frame !== previous.frame + 1) return [];
        return sample.descendants.flatMap((descendant) => {
          const previousDescendant = previous.descendants.find(
            (candidate) => candidate.index === descendant.index,
          );
          if (
            !previousDescendant ||
            !previousDescendant.visible ||
            !descendant.visible
          ) {
            return [];
          }
          const dx = descendant.x - previousDescendant.x;
          const dy = descendant.y - previousDescendant.y;
          return [
            track.axis === 'x'
              ? Math.abs(dx)
              : track.axis === 'y'
                ? Math.abs(dy)
                : Math.hypot(dx, dy),
          ];
        });
      });
      const descendantViolations = descendantDeltas.filter(
        (delta) =>
          track.maxDescendantStep !== undefined &&
          delta > track.maxDescendantStep,
      );
      if (
        directionViolations.length > 0 ||
        translationViolations.length > 0 ||
        rotationViolations.length > 0 ||
        scaleViolations.length > 0 ||
        opacityViolations.length > 0 ||
        descendantViolations.length > 0
      ) {
        throw new Error(
          `Transform track ${track.id}: direction=${directionViolations.length}, translation=${translationViolations.length}, rotation=${rotationViolations.length}, scale=${scaleViolations.length}, opacity=${opacityViolations.length}, descendants=${descendantViolations.length}`,
        );
      }
      const xValues = track.samples.map((sample) => sample.x);
      const yValues = track.samples.map((sample) => sample.y);
      const opacityValues = track.samples.map((sample) => sample.opacity);
      const translationRange = Math.hypot(
        Math.max(...xValues) - Math.min(...xValues),
        Math.max(...yValues) - Math.min(...yValues),
      );
      const opacityRange =
        Math.max(...opacityValues) - Math.min(...opacityValues);
      if (
        track.minTranslationRange !== undefined &&
        translationRange < track.minTranslationRange
      ) {
        throw new Error(
          `Transform track ${track.id}: translation range ${translationRange.toFixed(3)}; expected at least ${track.minTranslationRange}`,
        );
      }
      if (
        track.minOpacityRange !== undefined &&
        opacityRange < track.minOpacityRange
      ) {
        throw new Error(
          `Transform track ${track.id}: opacity range ${opacityRange.toFixed(3)}; expected at least ${track.minOpacityRange}`,
        );
      }
      notes.push(
        `transform-track:${track.id}:samples=${track.samples.length}:translation-range=${translationRange.toFixed(3)}:opacity-range=${opacityRange.toFixed(3)}:max-step=${Math.max(0, ...deltas.map((delta) => delta.translation)).toFixed(3)}:max-rotation-step=${Math.max(0, ...deltas.map((delta) => Math.abs(delta.rotation))).toFixed(3)}:max-descendant-step=${Math.max(0, ...descendantDeltas).toFixed(3)}`,
      );
    }
  } finally {
    await page.close();
    await context.close();
  }

  await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-framerate',
      String(config.fps),
      '-i',
      path.join(framesDir, 'frame-%06d.jpg'),
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      String(config.crf ?? 16),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      output,
    ],
    {maxBuffer: 20 * 1024 * 1024},
  );

  const report = await inspectVideoCadence(output, {
    expectedFps: config.fps,
    expectedFrames: config.frames,
    maxDuplicateFrames: config.maxDuplicateFrames,
    maxFreezeEvents: config.maxFreezeEvents,
    maxTemporalSpikeEvents: config.maxTemporalSpikeEvents,
  });
  notes.push(
    `frame-lock:${report.frames}f@${report.fps}fps:duplicates=${report.duplicateDecodedFrames}:freezes=${report.freezeEvents}`,
  );

  if (!config.keepFrames) {
    await fs.rm(framesDir, {recursive: true, force: true});
  }

  return {
    video: normalizePath(path.relative(root, output)),
    durationSeconds: config.frames / config.fps,
    report,
  };
};
