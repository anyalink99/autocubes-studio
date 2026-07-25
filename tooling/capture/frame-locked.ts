import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Browser, BrowserContext, Page} from 'playwright';
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

type VideoReadiness = {
  src: string;
  readyState: number;
  loadResult: 'already' | 'ready' | 'error' | 'timeout';
  seekResult: 'already' | 'ready' | 'error' | 'timeout' | 'unavailable';
  connected: boolean;
};

type VideoProxyReport = {
  videos: VideoReadiness[];
  visibleSources: number;
  activeProxies: number;
  retainedSources: number;
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
      let enabled = false;
      let virtualTime = 0;
      let epoch = nativeDateNow();
      let nextId = 1;
      const callbacks = new Map();

      try {
        Object.defineProperty(performance, 'now', {
          configurable: true,
          value: () => enabled ? virtualTime : nativePerformanceNow(),
        });
      } catch {}

      Date.now = () => enabled ? Math.round(epoch + virtualTime) : nativeDateNow();
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
        enabled = true;
      };
      window.__captureStep = (seconds) => {
        virtualTime += seconds * 1000;
        const batch = [...callbacks.values()];
        callbacks.clear();
        for (const callback of batch) callback(virtualTime);
      };
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

const stabilizeVisibleVideoFrames = async (
  page: Page,
  frame: number,
  timeSeconds: number,
  margin: number,
  timeoutMs: number,
): Promise<VideoProxyReport> => {
  // A successful "seeked" event does not mean Chromium has presented the new
  // frame to the compositor. Showing a repeatedly-seeked <video> directly can
  // therefore alternate between a decoded frame and an empty surface. Keep the
  // media element hidden and draw it into a retained root-level canvas instead.
  //
  // Keep this as literal browser JavaScript. tsx adds a private __name helper to
  // nested serialized functions, but that helper does not exist in page context.
  const script = `
    (async () => {
      const frame = ${JSON.stringify(frame)};
      const time = ${JSON.stringify(timeSeconds)};
      const preloadMargin = ${JSON.stringify(margin)};
      const timeout = ${JSON.stringify(timeoutMs)};
      const waitForEvent = (video, events, eventTimeout) =>
        new Promise((resolve) => {
          let settled = false;
          let timer;
          const finish = (result) => {
            if (settled) return;
            settled = true;
            for (const event of events) video.removeEventListener(event, onReady);
            video.removeEventListener('error', onError);
            clearTimeout(timer);
            resolve(result);
          };
          const onReady = () => finish('ready');
          const onError = () => finish('error');
          for (const event of events) {
            video.addEventListener(event, onReady, {once: true});
          }
          video.addEventListener('error', onError, {once: true});
          timer = setTimeout(() => finish('timeout'), eventTimeout);
        });

      let overlay = document.getElementById('__autocubes_capture_video_overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = '__autocubes_capture_video_overlay';
        overlay.style.cssText =
          'position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden;';
        document.body.appendChild(overlay);

        const style = document.createElement('style');
        style.id = '__autocubes_capture_video_style';
        style.textContent = 'video{opacity:0!important}';
        document.head.appendChild(style);

        window.__autocubesCaptureVideoState = {
          items: new Map(),
          lastScroll: scrollY,
        };
      }

      const state = window.__autocubesCaptureVideoState;
      const scrollDelta = scrollY - state.lastScroll;
      for (const item of state.items.values()) {
        item.top -= scrollDelta;
        item.canvas.style.top = item.top + 'px';
      }
      state.lastScroll = scrollY;

      const videos = [...document.querySelectorAll('video')].filter((video) => {
        const rect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        return (
          rect.bottom >= -preloadMargin &&
          rect.top <= innerHeight + preloadMargin &&
          rect.right >= -preloadMargin &&
          rect.left <= innerWidth + preloadMargin &&
          rect.width > 2 &&
          rect.height > 2 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      });

      const groups = new Map();
      for (const video of videos) {
        const src = video.currentSrc || video.src;
        if (!src) continue;
        if (!groups.has(src)) groups.set(src, []);
        groups.get(src).push(video);
      }

      for (const [src, candidates] of groups) {
        let item = state.items.get(src);
        const video = candidates.sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          if (item) {
            const aDistance = Math.hypot(aRect.left - item.left, aRect.top - item.top);
            const bDistance = Math.hypot(bRect.left - item.left, bRect.top - item.top);
            return aDistance - bDistance;
          }
          const aDistance = Math.abs(aRect.left + aRect.width / 2 - innerWidth / 2);
          const bDistance = Math.abs(bRect.left + bRect.width / 2 - innerWidth / 2);
          return aDistance - bDistance;
        })[0];
        const rect = video.getBoundingClientRect();

        if (!item) {
          const canvas = document.createElement('canvas');
          overlay.appendChild(canvas);
          item = {
            src,
            video,
            canvas,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            lastSeen: frame,
          };
          state.items.set(src, item);
        }

        item.video = video;
        item.left = rect.left;
        item.top = rect.top;
        item.width = rect.width;
        item.height = rect.height;
        item.lastSeen = frame;
      }

      const results = [];
      let retainedSources = 0;
      for (const [src, item] of [...state.items]) {
        if (
          item.top > innerHeight + preloadMargin ||
          item.top + item.height < -preloadMargin
        ) {
          item.canvas.remove();
          state.items.delete(src);
          continue;
        }

        const video = item.video;
        if (!groups.has(src)) retainedSources += 1;
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        let loadResult = 'already';
        if (video.readyState < 2 || !Number.isFinite(video.duration)) {
          const pending = waitForEvent(video, ['loadeddata', 'canplay'], timeout);
          video.load();
          loadResult = await pending;
        }

        let seekResult = 'unavailable';
        if (video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0) {
          const target = time % video.duration;
          if (Math.abs(video.currentTime - target) > 0.002) {
            const pending = waitForEvent(video, ['seeked'], Math.min(timeout, 5000));
            video.currentTime = target;
            seekResult = await pending;
          } else {
            seekResult = 'already';
          }
        }

        if (
          video.readyState >= 2 &&
          Number.isFinite(video.duration) &&
          video.duration > 0
        ) {
          const canvas = item.canvas;
          const width = Math.max(1, Math.round(item.width));
          const height = Math.max(1, Math.round(item.height));
          const context = canvas.getContext('2d');
          const videoWidth = video.videoWidth || 1;
          const videoHeight = video.videoHeight || 1;
          const style = getComputedStyle(video);
          const fit = style.objectFit || 'fill';

          canvas.width = width;
          canvas.height = height;
          context.clearRect(0, 0, width, height);
          if (fit === 'cover' || fit === 'contain') {
            const scale =
              fit === 'cover'
                ? Math.max(width / videoWidth, height / videoHeight)
                : Math.min(width / videoWidth, height / videoHeight);
            const drawWidth = videoWidth * scale;
            const drawHeight = videoHeight * scale;
            context.drawImage(
              video,
              (width - drawWidth) / 2,
              (height - drawHeight) / 2,
              drawWidth,
              drawHeight,
            );
          } else {
            context.drawImage(video, 0, 0, width, height);
          }

          canvas.style.cssText =
            'position:absolute;' +
            'left:' + item.left + 'px;' +
            'top:' + item.top + 'px;' +
            'width:' + item.width + 'px;' +
            'height:' + item.height + 'px;' +
            'border-radius:' + style.borderRadius + ';' +
            'filter:' + style.filter + ';' +
            'opacity:1;';
        }

        results.push({
          src: src.split('/').pop() ?? '',
          readyState: video.readyState,
          loadResult,
          seekResult,
          connected: video.isConnected,
        });
      }

      return {
        videos: results,
        visibleSources: groups.size,
        activeProxies: state.items.size,
        retainedSources,
      };
    })()
  `;
  return (await page.evaluate(script)) as VideoProxyReport;
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

  const context = await browser.newContext({
    viewport: {width: viewport.width, height: viewport.height},
    deviceScaleFactor: viewport.deviceScaleFactor,
  });
  await addDeterministicClock(context);
  const page = await context.newPage();

  try {
    await page.goto(url, {waitUntil: 'networkidle', timeout: 120_000});
    await page.addStyleTag({
      content: '* { cursor: none !important; } html { scroll-behavior: auto !important; }',
    });
    await warmPage(page, config.warmupStepPx ?? 1000);
    await page.evaluate(() => {
      (
        window as typeof window & {
          __captureEnable: () => void;
          __captureFlush: () => void;
        }
      ).__captureEnable();
      (
        window as typeof window & {
          __captureFlush: () => void;
        }
      ).__captureFlush();
    });

    const sourceHashes = new Set<string>();
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

      const proxyReport = await stabilizeVisibleVideoFrames(
        page,
        frame,
        frame / config.fps,
        config.preloadMarginPx ?? 500,
        config.videoReadyTimeoutMs ?? 12_000,
      );
      const badVideo = proxyReport.videos.find(
        (video) =>
          video.readyState < 2 ||
          video.loadResult === 'timeout' ||
          video.loadResult === 'error' ||
          video.seekResult === 'timeout' ||
          video.seekResult === 'error',
      );
      if (badVideo) {
        throw new Error(
          `Video frame unavailable at ${frame}: ${badVideo.src} (${badVideo.loadResult}/${badVideo.seekResult})`,
        );
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
