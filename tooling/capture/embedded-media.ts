import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Page} from 'playwright';
import {FrameLockedCaptureConfig} from './types';
import {ensureCleanDir} from './utils';

const execFileAsync = promisify(execFile);

type EmbeddedMediaOverride = {
  src: string;
  decoderSrc: string;
  frameDir: string;
  frameCount: number;
};

type VideoReadiness = {
  src: string;
  readyState: number;
  duration: number | null;
  loadResult: 'already' | 'ready' | 'error' | 'timeout';
  presentedMediaTime: number | null;
  loop: boolean;
};

export type VideoProxyReport = {
  videos: VideoReadiness[];
  unconfiguredSources: string[];
};

export const prepareEmbeddedMediaOverrides = async ({
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
    let frameInput = normalization.src;

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
      frameInput = cadenceFile;
      notes.push(
        `embedded-cadence:${normalization.sourceFps}->${fps}:${normalization.src}:${cadenceCached ? 'cache' : 'render'}`,
      );
    }

    const key = crypto
      .createHash('sha256')
      .update(`${normalization.src}|${normalization.sourceFps}|${fps}|jpeg-direct-v2`)
      .digest('hex')
      .slice(0, 20);
    const frameDir = path.join(cacheDir, `${key}-${fps}fps-jpeg-frames`);
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
          frameInput,
          '-an',
          '-vf',
          `fps=${fps}`,
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
      `embedded-frame-cache:${frameCount}:${normalization.src}:${framesCached ? 'cache' : 'render'}`,
    );
  }

  return overrides;
};

export const paintConfiguredVideoFrames = async (
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
  // Literal browser JavaScript avoids tsx injecting helpers into nested
  // functions that Playwright serializes into the page.
  const script = `
    (async () => {
      const captureFrame = ${JSON.stringify(frame)};
      const captureFps = ${JSON.stringify(fps)};
      const preloadMargin = ${JSON.stringify(margin)};
      const timeout = ${JSON.stringify(timeoutMs)};
      const configuredMedia = ${JSON.stringify(mediaOverrides)};
      const nativeSetTimeout =
        window.__captureNativeSetTimeout || window.setTimeout.bind(window);
      const nativeClearTimeout =
        window.__captureNativeClearTimeout || window.clearTimeout.bind(window);
      const normalizeSource = (value) => {
        try {
          const parsed = new URL(value, location.href);
          parsed.search = '';
          parsed.hash = '';
          return parsed.href;
        } catch {
          return value;
        }
      };
      const configuredBySource = new Map();
      for (const [source, override] of Object.entries(configuredMedia)) {
        configuredBySource.set(source, override);
        configuredBySource.set(normalizeSource(source), override);
      }

      if (!window.__autocubesCaptureVideoState) {
        window.__autocubesCaptureVideoState = {items: new Map()};
      }
      const state = window.__autocubesCaptureVideoState;
      const groups = new Map();

      for (const video of document.querySelectorAll('video')) {
        const source = video.currentSrc || video.src;
        if (!source) continue;
        const rect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        if (rect.width <= 2 || rect.height <= 2 || style.display === 'none') {
          continue;
        }
        video.controls = false;
        video.removeAttribute('controls');
        video.pause();
        video.style.setProperty('visibility', 'hidden', 'important');
        if (!groups.has(source)) groups.set(source, []);
        groups.get(source).push(video);
      }

      const unconfiguredSources = new Set();
      const results = [];

      for (const [source, candidates] of groups) {
        const active = candidates.some((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return (
            rect.bottom >= -preloadMargin &&
            rect.top <= innerHeight + preloadMargin
          );
        });
        const override =
          configuredBySource.get(source) ||
          configuredBySource.get(normalizeSource(source));

        if (!override) {
          if (active) unconfiguredSources.add(source);
          continue;
        }

        let item = state.items.get(source);
        if (!item) {
          const image = new Image();
          image.decoding = 'sync';
          item = {
            image,
            imageSource: '',
            override,
            instances: new Map(),
            firstActiveFrame: null,
            loop: false,
          };
          state.items.set(source, item);
        }

        item.loop = candidates.some((candidate) => candidate.loop);
        const currentCandidates = new Set(candidates);
        for (const [candidate, instance] of [...item.instances]) {
          if (!candidate.isConnected || !currentCandidates.has(candidate)) {
            instance.canvas.remove();
            item.instances.delete(candidate);
          }
        }

        for (const candidate of candidates) {
          let instance = item.instances.get(candidate);
          if (!instance) {
            const canvas = document.createElement('canvas');
            canvas.dataset.autocubesCaptureProxy = 'true';
            canvas.style.cssText =
              'position:absolute;pointer-events:none;margin:0;padding:0;';
            instance = {canvas, styleSignature: ''};
            item.instances.set(candidate, instance);
          }
          const parent = candidate.parentElement;
          if (parent && candidate.nextSibling !== instance.canvas) {
            parent.insertBefore(instance.canvas, candidate.nextSibling);
          }
        }

        if (!active) continue;
        if (!Number.isFinite(item.firstActiveFrame)) {
          item.firstActiveFrame = captureFrame;
        }

        const localFrame = Math.max(0, captureFrame - item.firstActiveFrame);
        const frameIndex = item.loop
          ? localFrame % item.override.frameCount
          : Math.min(localFrame, item.override.frameCount - 1);
        const frameName =
          'frame-' + String(frameIndex + 1).padStart(6, '0') + '.jpg';
        const frameSource = item.override.decoderSrc + frameName;
        let loadResult = 'already';

        if (
          item.imageSource !== frameSource ||
          !item.image.complete ||
          item.image.naturalWidth < 1
        ) {
          loadResult = await new Promise((resolve) => {
            let settled = false;
            let timer;
            const finish = (result) => {
              if (settled) return;
              settled = true;
              item.image.onload = null;
              item.image.onerror = null;
              nativeClearTimeout(timer);
              resolve(result);
            };
            item.image.onload = () => finish('ready');
            item.image.onerror = () => finish('error');
            timer = nativeSetTimeout(() => finish('timeout'), timeout);
            item.imageSource = frameSource;
            item.image.src = frameSource;
          });
        }

        const drawable =
          item.image.complete && item.image.naturalWidth > 0
            ? item.image
            : null;
        if (drawable) {
          for (const [candidate, instance] of item.instances) {
            if (!candidate.isConnected || !instance.canvas.isConnected) {
              continue;
            }
            const rect = candidate.getBoundingClientRect();
            const width = Math.max(1, Math.round(candidate.offsetWidth || rect.width));
            const height = Math.max(
              1,
              Math.round(candidate.offsetHeight || rect.height),
            );
            const canvas = instance.canvas;
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, width, height);
            const style = getComputedStyle(candidate);
            const fit = style.objectFit || 'fill';
            const mediaWidth = drawable.naturalWidth;
            const mediaHeight = drawable.naturalHeight;

            if (fit === 'cover' || fit === 'contain') {
              const scale =
                fit === 'cover'
                  ? Math.max(width / mediaWidth, height / mediaHeight)
                  : Math.min(width / mediaWidth, height / mediaHeight);
              const drawWidth = mediaWidth * scale;
              const drawHeight = mediaHeight * scale;
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

            const styleSignature = [
              candidate.offsetLeft,
              candidate.offsetTop,
              width,
              height,
              style.transform,
              style.transformOrigin,
              style.borderRadius,
              style.clipPath,
              style.maskImage,
              style.maskSize,
              style.maskPosition,
              style.filter,
              style.mixBlendMode,
              style.opacity,
              style.zIndex,
            ].join('|');
            if (instance.styleSignature !== styleSignature) {
              canvas.style.cssText =
                'position:absolute;' +
                'left:' + candidate.offsetLeft + 'px;' +
                'top:' + candidate.offsetTop + 'px;' +
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
              instance.styleSignature = styleSignature;
            }
          }
        }

        results.push({
          src: (() => {
            try {
              return new URL(source, location.href).pathname.split('/').pop() || source;
            } catch {
              return source;
            }
          })(),
          readyState: drawable ? 4 : 0,
          duration: item.override.frameCount / captureFps,
          loadResult,
          presentedMediaTime: drawable ? (frameIndex + 0.5) / captureFps : null,
          loop: Boolean(item.loop),
        });
      }

      return {
        videos: results,
        unconfiguredSources: [...unconfiguredSources],
      };
    })()
  `;

  return (await page.evaluate(script)) as VideoProxyReport;
};
