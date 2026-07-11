import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium, Page} from 'playwright';
import {EditorProject, EasingName, PointerEvent, ScrollFrame} from '../../packages/core/editor-project';
import {ensureCleanDir, sleep} from './utils';

const projectPath = path.resolve(process.argv[2] ?? 'data/projects/flowline.editor.json');

const scrollTo = async (page: Page, y: number, duration: number, easing: EasingName) => {
  await page.evaluate(`
    new Promise((resolve) => {
      const targetY = ${JSON.stringify(y)};
      const durationMs = ${JSON.stringify(duration * 1000)};
      const easingName = ${JSON.stringify(easing)};
      const startY = window.scrollY;
      const distance = targetY - startY;
      const started = performance.now();
      const apply = (value) => {
        if (easingName === 'linear') return value;
        if (easingName === 'easeIn') return value ** 3;
        if (easingName === 'easeOut') return 1 - (1 - value) ** 3;
        if (easingName === 'spring') return 1 - Math.exp(-7 * value) * Math.cos(value * Math.PI * 2.4);
        return value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
      };
      const tick = (now) => {
        const raw = Math.min(1, (now - started) / Math.max(1, durationMs));
        window.scrollTo(0, startY + distance * apply(raw));
        if (raw < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    })
  `);
};

const pointerTarget = async (page: Page, action: PointerEvent) => {
  if (action.selector) {
    const locator = page.locator(action.selector).first();
    const box = await locator.boundingBox();
    if (box) return {x: box.x + box.width / 2, y: box.y + box.height / 2};
  }
  return {x: action.x, y: action.y};
};

const main = async () => {
  const project = JSON.parse(await fs.readFile(projectPath, 'utf8')) as EditorProject;
  const captureId = `editor-${project.id}`;
  const output = path.resolve('public', 'captures', captureId);
  const videoDirectory = path.join(output, 'raw-video');
  const stillDirectory = path.join(output, 'stills');
  await ensureCleanDir(output);
  await fs.mkdir(videoDirectory, {recursive: true});
  await fs.mkdir(stillDirectory, {recursive: true});

  const browser = await chromium.launch({headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']});
  const context = await browser.newContext({
    viewport: project.viewport,
    recordVideo: {dir: videoDirectory, size: project.viewport},
  });
  const page = await context.newPage();
  const videoStarted = Date.now();
  await page.goto(project.url, {waitUntil: 'networkidle', timeout: 60000});
  await page.addStyleTag({content: '* { cursor: none !important; } html { scroll-behavior: auto !important; }'});
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);

  const pageHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const timelineStarted = Date.now();
  const videoOffset = (timelineStarted - videoStarted) / 1000;
  const events: Array<{at: number; type: 'frame'; value: ScrollFrame} | {at: number; type: 'pointer'; value: PointerEvent}> = [
    ...project.frames.map((value) => ({at: value.at, type: 'frame' as const, value})),
    ...project.pointer.map((value) => ({at: value.at, type: 'pointer' as const, value})),
  ].sort((a, b) => a.at - b.at);

  for (const event of events) {
    const elapsed = (Date.now() - timelineStarted) / 1000;
    if (event.at > elapsed) await sleep((event.at - elapsed) * 1000);

    if (event.type === 'frame') {
      const frame = event.value;
      await scrollTo(page, Math.min(frame.scrollY, Math.max(0, pageHeight - project.viewport.height)), frame.duration, frame.easing);
      await page.screenshot({path: path.join(stillDirectory, `${frame.id}.png`)});
      console.log(`[${event.at.toFixed(2)}s] scroll ${frame.label} -> ${frame.scrollY}px`);
    } else {
      const action = event.value;
      const target = await pointerTarget(page, action);
      await page.mouse.move(target.x, target.y, {steps: Math.max(3, Math.round(action.duration * 35))});
      if (action.kind === 'click') await page.mouse.click(target.x, target.y, {delay: 45});
      console.log(`[${event.at.toFixed(2)}s] ${action.kind} ${action.label} -> ${Math.round(target.x)}, ${Math.round(target.y)}`);
    }
  }

  const remaining = project.duration - (Date.now() - timelineStarted) / 1000;
  if (remaining > 0) await sleep(remaining * 1000);
  const video = page.video();
  await page.close();
  await context.close();
  const recordedPath = await video?.path();
  await browser.close();

  if (!recordedPath) throw new Error('Playwright did not produce a video');
  await fs.copyFile(recordedPath, path.join(output, 'capture.webm'));
  await fs.rm(videoDirectory, {recursive: true, force: true});

  project.pageHeight = pageHeight;
  project.videoOffset = videoOffset;
  project.previewVideo = `/captures/${captureId}/capture.webm`;
  project.frames = project.frames.map((frame) => ({...frame, thumbnail: `/captures/${captureId}/stills/${frame.id}.png?v=${Date.now()}`}));
  await fs.writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.resolve('data/generated/editor-project.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  console.log(`Capture ready: ${project.previewVideo}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
