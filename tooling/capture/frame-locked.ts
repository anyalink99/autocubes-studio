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
  duration: number | null;
  loadResult: 'already' | 'ready' | 'error' | 'timeout';
  seekResult: 'already' | 'ready' | 'error' | 'timeout' | 'unavailable';
  presentResult: 'already' | 'ready' | 'timeout' | 'unsupported';
  presentedMediaTime: number | null;
  connected: boolean;
  loop: boolean;
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

type EmbeddedMediaOverride = {
  src: string;
  decoderSrc: string;
  frameDir: string;
  frameCount: number;
};

const prepareEmbeddedMediaOverrides = async ({
  pageUrl,
  root,
  fps,
  normalizations,
  notes,
}: {
  pageUrl: string;
  root: string;
  fps: number;
  normalizations: FrameLockedCaptureConfig['embeddedVideoNormalizations'];
  notes: string[];
}): Promise<EmbeddedMediaOverride[]> => {
  if (!normalizations?.length) return [];

  const cacheDir = path.join(path.dirname(root), '.capture-media-cache');
  await fs.mkdir(cacheDir, {recursive: true});
  const overrides: EmbeddedMediaOverride[] = [];

  for (const normalization of normalizations) {
    let transcodeInput = normalization.src;
    if (normalization.sourceFps < fps) {
      const cadenceKey = crypto
        .createHash('sha256')
        .update(`${normalization.src}|${normalization.sourceFps}|${fps}|mci-v1`)
        .digest('hex')
        .slice(0, 20);
      const cadenceFile = path.join(cacheDir, `${cadenceKey}-${fps}fps.mp4`);
      let cadenceCached = true;
      try {
        await fs.access(cadenceFile);
      } catch {
        cadenceCached = false;
        await execFileAsync(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            normalization.src,
            '-an',
            '-vf',
            `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:me=epzs:vsbmc=1`,
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-crf',
            '18',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            cadenceFile,
          ],
          {maxBuffer: 20 * 1024 * 1024},
        );
      }
      transcodeInput = cadenceFile;
      notes.push(
        `embedded-cadence:${normalization.sourceFps}->${fps}:${normalization.src}:${cadenceCached ? 'cache' : 'render'}`,
      );
    }

    const key = crypto
      .createHash('sha256')
      .update(`${normalization.src}|${normalization.sourceFps}|${fps}|all-intra-v2`)
      .digest('hex')
      .slice(0, 20);
    const file = path.join(cacheDir, `${key}-${fps}fps.mp4`);
    let cached = true;
    try {
      await fs.access(file);
    } catch {
      cached = false;
      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          transcodeInput,
          '-an',
          '-vf',
          `fps=${fps}`,
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '18',
          '-g',
          '1',
          '-keyint_min',
          '1',
          '-sc_threshold',
          '0',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          file,
        ],
        {maxBuffer: 20 * 1024 * 1024},
      );
    }

    const frameDir = path.join(cacheDir, `${key}-${fps}fps-jpeg-frames-v1`);
    const frameManifest = path.join(frameDir, 'complete.json');
    let frameCount = 0;
    let framesCached = true;
    try {
      const parsed = JSON.parse(await fs.readFile(frameManifest, 'utf8')) as {
        frameCount?: number;
      };
      frameCount = parsed.frameCount ?? 0;
      if (frameCount < 1) throw new Error('Empty frame cache');
    } catch {
      framesCached = false;
      await ensureCleanDir(frameDir);
      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          file,
          '-an',
          '-vsync',
          '0',
          '-q:v',
          '2',
          path.join(frameDir, 'frame-%06d.jpg'),
        ],
        {maxBuffer: 20 * 1024 * 1024},
      );
      frameCount = (await fs.readdir(frameDir)).filter((name) =>
        /^frame-\d{6}\.jpg$/.test(name),
      ).length;
      if (frameCount < 1) {
        throw new Error(`No extracted frames for ${normalization.src}`);
      }
      await fs.writeFile(
        frameManifest,
        JSON.stringify({frameCount, fps}, null, 2),
        'utf8',
      );
    }

    const decoderSrc = new URL(
      `/__autocubes_capture_media/${key}-${fps}fps-frames/`,
      pageUrl,
    ).toString();
    overrides.push({
      src: normalization.src,
      decoderSrc,
      frameDir,
      frameCount,
    });
    notes.push(
      `embedded-normalization:${normalization.sourceFps}->${fps}:all-intra:${normalization.src}:${cached ? 'cache' : 'render'}`,
    );
    notes.push(
      `embedded-frame-cache:${frameCount}:${normalization.src}:${framesCached ? 'cache' : 'render'}`,
    );
  }

  return overrides;
};

const stabilizeVisibleVideoFrames = async (
  page: Page,
  frame: number,
  fps: number,
  margin: number,
  timeoutMs: number,
  mediaOverrides: Record<
    string,
    {
      decoderSrc: string;
      frameCount: number;
    }
  >,
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
      const fps = ${JSON.stringify(fps)};
      const preloadMargin = ${JSON.stringify(margin)};
      const timeout = ${JSON.stringify(timeoutMs)};
      const mediaOverrides = ${JSON.stringify(mediaOverrides)};
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
      const waitForPresentedFrame = (video, target, eventTimeout) =>
        new Promise((resolve) => {
          if (typeof video.requestVideoFrameCallback !== 'function') {
            resolve({result: 'unsupported', mediaTime: video.currentTime});
            return;
          }
          let settled = false;
          let callbackId;
          let timer;
          const finish = (result, mediaTime) => {
            if (settled) return;
            settled = true;
            if (callbackId !== undefined) {
              video.cancelVideoFrameCallback(callbackId);
            }
            clearTimeout(timer);
            resolve({result, mediaTime});
          };
          const request = () => {
            callbackId = video.requestVideoFrameCallback((_now, metadata) => {
              if (Math.abs(metadata.mediaTime - target) <= 0.075) {
                finish('ready', metadata.mediaTime);
                return;
              }
              request();
            });
          };
          request();
          timer = setTimeout(
            () => finish('timeout', video.currentTime),
            eventTimeout,
          );
        });

      if (!window.__autocubesCaptureVideoState) {
        window.__autocubesCaptureVideoState = {
          items: new Map(),
          lastScroll: scrollY,
        };
      }

      const state = window.__autocubesCaptureVideoState;
      const scrollDelta = scrollY - state.lastScroll;
      for (const item of state.items.values()) {
        item.top -= scrollDelta;
      }
      state.lastScroll = scrollY;

      const videos = [...document.querySelectorAll('video')].filter((video) => {
        if (video.dataset.autocubesCaptureDecoder === 'true') return false;
        const rect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        return (
          rect.width > 2 &&
          rect.height > 2 &&
          style.display !== 'none'
        );
      });

      const groups = new Map();
      for (const video of videos) {
        const src = video.currentSrc || video.src;
        if (!src) continue;
        video.dataset.autocubesCaptureSource = 'true';
        video.controls = false;
        video.removeAttribute('controls');
        video.pause();
        video.style.setProperty('visibility', 'hidden', 'important');
        if (!groups.has(src)) groups.set(src, []);
        groups.get(src).push(video);
      }

      for (const [src, candidates] of groups) {
        let item = state.items.get(src);
        const video = candidates[0];
        const rects = candidates.map((candidate) =>
          candidate.getBoundingClientRect(),
        );
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        const verticallyActive = rects.some(
          (rect) =>
            rect.bottom >= -preloadMargin &&
            rect.top <= innerHeight + preloadMargin,
        );

        if (!item) {
          const frameOverride = mediaOverrides[src] || null;
          let decoder = null;
          let image = null;
          if (frameOverride) {
            image = new Image();
            image.decoding = 'sync';
          } else {
            decoder = document.createElement('video');
            decoder.dataset.autocubesCaptureDecoder = 'true';
            decoder.crossOrigin = video.crossOrigin || 'anonymous';
            decoder.src = src;
            decoder.preload = 'auto';
            decoder.muted = true;
            decoder.playsInline = true;
            decoder.autoplay = false;
            decoder.loop = false;
            decoder.style.cssText =
              'position:fixed;left:-2px;top:-2px;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(decoder);
            decoder.pause();
          }
          item = {
            src,
            video,
            decoder,
            image,
            imageSrc: '',
            frameOverride,
            loop: candidates.some((candidate) => candidate.loop),
            instances: new Map(),
            left,
            top,
            width: right - left,
            height: bottom - top,
            active: verticallyActive,
            firstActiveFrame: verticallyActive ? frame : null,
            lastSeen: frame,
          };
          state.items.set(src, item);
        }

        item.video = video;
        item.left = left;
        item.top = top;
        item.width = right - left;
        item.height = bottom - top;
        item.active = verticallyActive;
        if (verticallyActive && !Number.isFinite(item.firstActiveFrame)) {
          item.firstActiveFrame = frame;
        }
        item.lastSeen = frame;
        item.loop = candidates.some((candidate) => candidate.loop);

        const activeCandidates = new Set(candidates);
        for (const [trackedVideo, instance] of [...item.instances]) {
          if (!activeCandidates.has(trackedVideo) || !trackedVideo.isConnected) {
            instance.canvas.remove();
            item.instances.delete(trackedVideo);
          }
        }

        for (const candidate of candidates) {
          let instance = item.instances.get(candidate);
          if (!instance) {
            const canvas = document.createElement('canvas');
            canvas.dataset.autocubesCaptureProxy = 'true';
            canvas.style.cssText = 'position:absolute;pointer-events:none;';
            instance = {canvas};
            item.instances.set(candidate, instance);
          }

          const parent = candidate.parentElement;
          if (parent && instance.canvas.parentElement !== parent) {
            parent.insertBefore(instance.canvas, candidate.nextSibling);
          } else if (parent && candidate.nextSibling !== instance.canvas) {
            parent.insertBefore(instance.canvas, candidate.nextSibling);
          }
        }
      }

      const results = [];
      let retainedSources = 0;
      for (const [src, item] of [...state.items]) {
        if (
          !groups.has(src) &&
          (item.top > innerHeight + preloadMargin ||
            item.top + item.height < -preloadMargin)
        ) {
          for (const instance of item.instances.values()) {
            instance.canvas.remove();
          }
          if (item.decoder) item.decoder.remove();
          state.items.delete(src);
          continue;
        }

        if (!groups.has(src)) retainedSources += 1;
        if (!item.active) continue;

        let loadResult = 'already';
        let seekResult = 'unavailable';
        let presentResult = 'already';
        let presentedMediaTime = item.presentedMediaTime ?? null;
        let readyState = 0;
        let duration = null;
        let drawable = null;
        let videoWidth = 1;
        let videoHeight = 1;
        const localFrame = Math.max(
          0,
          frame -
            (Number.isFinite(item.firstActiveFrame)
              ? item.firstActiveFrame
              : frame),
        );

        if (item.frameOverride) {
          const frameIndex = item.loop
            ? localFrame % item.frameOverride.frameCount
            : Math.min(localFrame, item.frameOverride.frameCount - 1);
          const frameName =
            'frame-' + String(frameIndex + 1).padStart(6, '0') + '.jpg';
          const frameSrc = item.frameOverride.decoderSrc + frameName;
          const image = item.image;
          if (
            item.imageSrc !== frameSrc ||
            !image.complete ||
            image.naturalWidth < 1
          ) {
            loadResult = await new Promise((resolve) => {
              let settled = false;
              let timer;
              const finish = (result) => {
                if (settled) return;
                settled = true;
                image.onload = null;
                image.onerror = null;
                clearTimeout(timer);
                resolve(result);
              };
              image.onload = () => finish('ready');
              image.onerror = () => finish('error');
              timer = setTimeout(() => finish('timeout'), timeout);
              item.imageSrc = frameSrc;
              image.src = frameSrc;
            });
          }
          if (image.complete && image.naturalWidth > 0) {
            readyState = 4;
            duration = item.frameOverride.frameCount / fps;
            drawable = image;
            videoWidth = image.naturalWidth;
            videoHeight = image.naturalHeight;
            seekResult = loadResult === 'already' ? 'already' : 'ready';
            presentResult = loadResult === 'already' ? 'already' : 'ready';
            presentedMediaTime = (frameIndex + 0.5) / fps;
          }
        } else {
          const video = item.decoder;
          video.preload = 'auto';
          video.muted = true;
          video.playsInline = true;
          video.autoplay = false;
          video.loop = false;
          video.pause();

          if (
            (video.readyState < 2 || !Number.isFinite(video.duration)) &&
            !Number.isFinite(item.presentedMediaTime)
          ) {
            const pending = waitForEvent(video, ['loadeddata', 'canplay'], timeout);
            video.load();
            loadResult = await pending;
          }

          if (
            (video.readyState >= 2 || Number.isFinite(item.presentedMediaTime)) &&
            Number.isFinite(video.duration) &&
            video.duration > 0
          ) {
          const lastStableTime = Math.max(0, video.duration - 0.5 / fps);
          const localTime = (localFrame + 0.5) / fps;
          const target = item.loop
            ? localTime % video.duration
            : Math.min(localTime, lastStableTime);
          if (Math.abs(video.currentTime - target) > 0.002) {
            video.pause();
            const presented = waitForPresentedFrame(
              video,
              target,
              Math.min(timeout, 5000),
            );
            const pending = waitForEvent(video, ['seeked'], Math.min(timeout, 5000));
            video.currentTime = target;
            seekResult = await pending;
            const presentation = await presented;
            presentResult = presentation.result;
            presentedMediaTime = presentation.mediaTime;
            video.pause();
          } else {
            seekResult = 'already';
          }
            readyState = video.readyState;
            duration = video.duration;
            drawable = video;
            videoWidth = video.videoWidth || 1;
            videoHeight = video.videoHeight || 1;
          }
        }
        item.presentedMediaTime = presentedMediaTime;

        if (drawable && readyState >= 2 && Number.isFinite(duration) && duration > 0) {
          for (const [instanceVideo, instance] of item.instances) {
            if (!instanceVideo.isConnected || !instance.canvas.isConnected) {
              continue;
            }
            const canvas = instance.canvas;
            const instanceRect = instanceVideo.getBoundingClientRect();
            const width = Math.max(
              1,
              Math.round(instanceVideo.offsetWidth || instanceRect.width),
            );
            const height = Math.max(
              1,
              Math.round(instanceVideo.offsetHeight || instanceRect.height),
            );
            const context = canvas.getContext('2d');
            const style = getComputedStyle(instanceVideo);
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
                drawable,
                (width - drawWidth) / 2,
                (height - drawHeight) / 2,
                drawWidth,
                drawHeight,
              );
            } else {
              context.drawImage(drawable, 0, 0, width, height);
            }

            canvas.style.cssText =
              'position:absolute;' +
              'left:' + instanceVideo.offsetLeft + 'px;' +
              'top:' + instanceVideo.offsetTop + 'px;' +
              'width:' + width + 'px;' +
              'height:' + height + 'px;' +
              'margin:0;padding:0;' +
              'transform:' + style.transform + ';' +
              'transform-origin:' + style.transformOrigin + ';' +
              'border-radius:' + style.borderRadius + ';' +
              'clip-path:' + style.clipPath + ';' +
              'mask-image:' + style.maskImage + ';' +
              'mask-size:' + style.maskSize + ';' +
              'mask-position:' + style.maskPosition + ';' +
              'filter:' + style.filter + ';' +
              'mix-blend-mode:' + style.mixBlendMode + ';' +
              'opacity:' + style.opacity + ';' +
              'z-index:' + style.zIndex + ';' +
              'pointer-events:none;';
          }
        }

        results.push({
          src: src.split('/').pop() ?? '',
          readyState,
          duration: Number.isFinite(duration) ? duration : null,
          loadResult,
          seekResult,
          presentResult,
          presentedMediaTime,
          connected: [...item.instances.keys()].some(
            (instanceVideo) => instanceVideo.isConnected,
          ),
          loop: Boolean(item.loop),
        });
      }

      return {
        videos: results,
        visibleSources: groups.size,
        activeProxies: [...state.items.values()].reduce(
          (count, item) => count + item.instances.size,
          0,
        ),
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
  const page = await context.newPage();

  try {
    await page.goto(url, {waitUntil: 'networkidle', timeout: 120_000});
    await page.addStyleTag({
      content: '* { cursor: none !important; } html { scroll-behavior: auto !important; }',
    });
    await warmPage(page, config.warmupStepPx ?? 1000);
    await page.evaluate(() => {
      const carouselTransforms = new Map<number, string>();
      (
        window as typeof window & {
          __captureEnable: () => void;
          __captureFlush: () => void;
          __captureLockMediaCarousels: () => void;
        }
      ).__captureLockMediaCarousels = () => {
        const lists = [...document.querySelectorAll('ul')].filter((list) =>
          list.querySelector('video'),
        );
        for (const [listIndex, list] of lists.entries()) {
          let lockedTransform = carouselTransforms.get(listIndex);
          if (!lockedTransform) {
            const style = getComputedStyle(list);
            const match = style.transform.match(/^matrix\(([^)]+)\)$/);
            if (!match) continue;
            const values = match[1].split(',').map(Number);
            if (
              values.length !== 6 ||
              values.some((value) => !Number.isFinite(value))
            ) {
              continue;
            }
            const itemLefts = [...list.querySelectorAll('video')]
              .map((video) => video.getBoundingClientRect().left)
              .sort((a, b) => a - b);
            const strides = itemLefts
              .slice(1)
              .map((left, index) => Math.abs(left - itemLefts[index]))
              .filter((stride) => stride > 2);
            if (strides.length === 0) continue;
            strides.sort((a, b) => a - b);
            const stride = strides[Math.floor(strides.length / 2)];
            const snappedX = Math.round(values[4] / stride) * stride;
            lockedTransform = `matrix(${values[0]}, ${values[1]}, ${values[2]}, ${values[3]}, ${snappedX}, ${values[5]})`;
            carouselTransforms.set(listIndex, lockedTransform);
          }
          list.setAttribute('data-autocubes-capture-carousel', 'locked');
          list.style.setProperty('transform', lockedTransform, 'important');
          list.style.setProperty('transition', 'none', 'important');
          list.style.setProperty('animation', 'none', 'important');
          for (const video of list.querySelectorAll('video')) {
            let ancestor = video.parentElement;
            while (ancestor && ancestor !== list) {
              ancestor.style.setProperty('visibility', 'visible', 'important');
              ancestor.style.setProperty('opacity', '1', 'important');
              ancestor = ancestor.parentElement;
            }
          }
        }
      };
      (
        window as typeof window & {
          __captureLockMediaCarousels: () => void;
        }
      ).__captureLockMediaCarousels();
      (
        window as typeof window & {
          __captureEnable: () => void;
        }
      ).__captureEnable();
      (
        window as typeof window & {
          __captureFlush: () => void;
        }
      ).__captureFlush();
    });

    const sourceHashes = new Set<string>();
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
            __captureLockMediaCarousels: () => void;
          };
          window.scrollTo(0, y);
          captureWindow.__captureStep(halfStep);
          captureWindow.__captureStep(halfStep);
          captureWindow.__captureLockMediaCarousels();
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
        config.fps,
        config.preloadMarginPx ?? 500,
        config.videoReadyTimeoutMs ?? 12_000,
        mediaOverrideMap,
      );
      const badVideo = proxyReport.videos.find(
        (video) =>
          (video.readyState < 2 && video.presentResult !== 'ready') ||
          video.loadResult === 'timeout' ||
          video.loadResult === 'error' ||
          video.seekResult === 'timeout' ||
          video.seekResult === 'error' ||
          video.presentResult === 'timeout',
      );
      if (badVideo) {
        throw new Error(
          `Video frame unavailable at ${frame}: ${badVideo.src} (${badVideo.loadResult}/${badVideo.seekResult})`,
        );
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
