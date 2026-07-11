import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {manifestPath, publicDir, rootDir, shotDir} from '../../packages/core/paths';
import {CaptureApi} from './types';
import {ensureCleanDir, fileExists, normalizePath, scrollPageTo, sleep} from './utils';
import {scenarios} from './scenarios';

const scenarioName = process.argv[2];

if (!scenarioName || !scenarios[scenarioName]) {
  console.error(`Unknown scenario: ${scenarioName || '(empty)'}`);
  console.error(`Available: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}

const scenario = scenarios[scenarioName];
const root = shotDir(scenario.site);
const videoDir = path.join(root, 'browser-video');
const stillDir = path.join(root, 'stills');

const main = async () => {
  await ensureCleanDir(root);
  await fs.mkdir(videoDir, {recursive: true});
  await fs.mkdir(stillDir, {recursive: true});

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--font-render-hinting=none',
    ],
  });

  const context = await browser.newContext({
    viewport: {
      width: scenario.viewport.width,
      height: scenario.viewport.height,
    },
    deviceScaleFactor: scenario.viewport.deviceScaleFactor,
    recordVideo: {
      dir: videoDir,
      size: {
        width: scenario.viewport.width,
        height: scenario.viewport.height,
      },
    },
  });

  const page = await context.newPage();
  const started = Date.now();
  const stills: CaptureApi['stills'] = [];
  const actions: CaptureApi['actions'] = [];
  const notes: string[] = [];
  let actionIndex = 0;

  const elapsed = () => (Date.now() - started) / 1000;
  const nextActionId = (type: string) =>
    `${String(++actionIndex).padStart(2, '0')}-${type}`;
  const movePointerTo = async (x: number, y: number, label: string, durationMs = 700) => {
    actions.push({
      id: nextActionId('move'),
      type: 'move',
      label,
      at: elapsed(),
      x: Math.round(x),
      y: Math.round(y),
      duration: durationMs / 1000,
    });
    await page.mouse.move(x, y, {steps: Math.max(8, Math.round(durationMs / 24))});
  };
  const visibleCenter = (box: {x: number; y: number; width: number; height: number}) => {
    const viewport = page.viewportSize();
    if (!viewport) return undefined;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const margin = 6;

    if (
      box.width <= 0 ||
      box.height <= 0 ||
      x < margin ||
      y < margin ||
      x > viewport.width - margin ||
      y > viewport.height - margin
    ) {
      return undefined;
    }

    return {x, y};
  };

  const api: CaptureApi = {
    page,
    context,
    shotRoot: root,
    stills,
    actions,
    notes,
    wait: sleep,
    screenshot: async (id, label) => {
      const file = path.join(stillDir, `${id}.png`);
      await page.screenshot({path: file, fullPage: false});
      stills.push({
        id,
        file: normalizePath(path.relative(root, file)),
        at: (Date.now() - started) / 1000,
        label,
      });
    },
    smoothScrollTo: async (y, durationMs) => {
      actions.push({
        id: nextActionId('scroll'),
        type: 'scroll',
        label: `Scroll to ${Math.round(y)}`,
        at: elapsed(),
        duration: durationMs / 1000,
      });
      await scrollPageTo(page, y, durationMs);
    },
    movePointerTo: async (x, y, label, durationMs = 700) => {
      await movePointerTo(x, y, label, durationMs);
    },
    clickPoint: async (x, y, label, durationMs = 650) => {
      await movePointerTo(x, y, label, durationMs);
      actions.push({
        id: nextActionId('click'),
        type: 'click',
        label,
        at: elapsed(),
        x: Math.round(x),
        y: Math.round(y),
      });
      await page.mouse.click(x, y, {delay: 45});
    },
    hoverBest: async (selectors, label) => {
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        const count = await locator.count();
        if (count === 0) continue;
        const box = await locator.boundingBox();
        if (!box) continue;
        const point = visibleCenter(box);
        if (!point) continue;
        const {x, y} = point;
        await movePointerTo(x, y, label, 680);
        actions.push({
          id: nextActionId('hover'),
          type: 'hover',
          label,
          at: elapsed(),
          x: Math.round(x),
          y: Math.round(y),
          target: selector,
        });
        notes.push(`hover:${label}:${selector}`);
        return true;
      }
      notes.push(`hover-miss:${label}`);
      return false;
    },
    clickBest: async (selectors, label) => {
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        const count = await locator.count();
        if (count === 0) continue;
        const box = await locator.boundingBox();
        if (!box) continue;
        const point = visibleCenter(box);
        if (!point) continue;
        const {x, y} = point;
        await movePointerTo(x, y, label, 720);
        actions.push({
          id: nextActionId('click'),
          type: 'click',
          label,
          at: elapsed(),
          x: Math.round(x),
          y: Math.round(y),
          target: selector,
        });
        await page.mouse.click(x, y, {delay: 45});
        notes.push(`click:${label}:${selector}`);
        return true;
      }
      notes.push(`click-miss:${label}`);
      return false;
    },
  };

  try {
    await scenario.run(api);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const videoFiles = await fs.readdir(videoDir);
  const firstVideo = videoFiles.find((name) => name.endsWith('.webm'));
  let video: string | undefined;

  if (firstVideo) {
    const source = path.join(videoDir, firstVideo);
    const target = path.join(root, 'capture.webm');
    await fs.rename(source, target);
    video = normalizePath(path.relative(root, target));
  }

  const base = {
    site: scenario.site,
    title: scenario.title,
    url: scenario.url,
    capturedAt: new Date().toISOString(),
    viewport: scenario.viewport,
    video,
    durationSeconds: scenario.durationSeconds,
    stills,
    actions,
    notes,
  };

  const manifest = scenario.buildManifest?.(base) ?? base;

  await fs.writeFile(manifestPath(scenario.site), JSON.stringify(manifest, null, 2), 'utf8');

  const publicCaptureDir = path.join(publicDir, 'captures', scenario.site);
  await fs.rm(publicCaptureDir, {recursive: true, force: true});
  await fs.mkdir(path.dirname(publicCaptureDir), {recursive: true});
  await fs.cp(root, publicCaptureDir, {recursive: true});

  const generatedDir = path.join(rootDir, 'data', 'generated');
  await fs.mkdir(generatedDir, {recursive: true});
  await fs.writeFile(
    path.join(generatedDir, `${scenario.site}-manifest.json`),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );

  if (!video || !(await fileExists(path.join(root, video)))) {
    console.warn('Capture finished without browser video; Remotion will use stills fallback.');
  }

  console.log(`Captured ${scenario.site}`);
  console.log(`Manifest: ${manifestPath(scenario.site)}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
