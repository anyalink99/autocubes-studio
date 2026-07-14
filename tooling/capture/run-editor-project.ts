import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium, Page} from 'playwright';
import {EditorProject, EasingName, PointerEvent, ScrollFrame} from '../../packages/core/editor-project';
import {migrateEditorProject} from '../../packages/core/editor-operations';
import {cursorStateAt} from '../../packages/core/motion-kinematics';
import {ensureCleanDir, sleep} from './utils';

const projectPath = path.resolve(process.argv[2] ?? 'data/projects/flowline.editor.json');
let pendingOutput: string | undefined;

const scrollTo = async (page: Page, y: number, duration: number, easing: EasingName) => {
  await page.evaluate(`
    new Promise((resolve) => {
      const targetY=${JSON.stringify(y)};
      const durationMs=${JSON.stringify(duration*1000)};
      const easingName=${JSON.stringify(easing)};
      const startY = window.scrollY;
      const distance = targetY - startY;
      const started = performance.now();
      const apply = (value) => {
        if (easingName === 'linear') return value;
        if (easingName === 'easeIn') return value ** 3;
        if (easingName === 'easeOut') return 1 - (1 - value) ** 3;
        if (easingName === 'spring') return 1 - Math.exp(-7 * value) * Math.cos(value * Math.PI * 2.4);
        return value < 0.5 ? 16 * value ** 5 : 1 - Math.pow(-2 * value + 2, 5) / 2;
      };
      const tick = (now) => {
        const raw = Math.min(1, (now - started) / Math.max(1, durationMs));
        const eased=apply(raw);
        const humanDrift=Math.sin(raw*Math.PI)*Math.sin(raw*Math.PI*3)*Math.min(7,Math.abs(distance)*.0025);
        window.scrollTo(0, startY + distance * eased + Math.sign(distance) * humanDrift);
        if (raw < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    })
  `);
};

const movePointerNaturally=async(page:Page,project:EditorProject,action:PointerEvent)=>{
  const settle=action.kind==='click'?Math.max(.04,action.settle??.2):0;
  const moveDuration=Math.max(.06,action.duration-settle);
  const steps=Math.max(8,Math.round(moveDuration*60));
  const stepDuration=moveDuration/steps;
  for(let index=1;index<=steps;index+=1){
    const state=cursorStateAt(project.pointer,action.at+index/steps*moveDuration,project.viewport);
    await page.mouse.move(state.x,state.y);
    await sleep(stepDuration*1000);
  }
};

const pointerTarget = async (page: Page, action: PointerEvent) => {
  if (action.selector) {
    const locator = page.locator(action.selector).first();
    await locator.waitFor({state: 'visible', timeout: 2500}).catch(() => undefined);
    const box = await locator.boundingBox().catch(() => null);
    if (box) return {x: box.x + box.width / 2, y: box.y + box.height / 2};
  }
  return {x: action.x, y: action.y};
};

const main = async () => {
  const project = migrateEditorProject(JSON.parse(await fs.readFile(projectPath, 'utf8')) as EditorProject);
  const captureBaseId = `editor-${project.id}`;
  const revision = `${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${process.pid}`;
  const captureId = `${captureBaseId}-${revision}`;
  const output = path.resolve('public', 'captures', captureId);
  const captureRoot = path.dirname(output);
  pendingOutput = output;
  // Остаток старой схемы публикации мог сохраниться после Windows EPERM.
  await fs.rm(path.join(captureRoot, `.${captureBaseId}-next`), {recursive: true, force: true}).catch(() => undefined);
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
  console.log(`Подготовка страницы: ${project.url}`);
  await page.goto(project.url, {waitUntil: 'domcontentloaded', timeout: 60000});
  await page.waitForLoadState('networkidle', {timeout: 8000}).catch(() => undefined);
  await page.addStyleTag({content: '* { cursor: none !important; } html { scroll-behavior: auto !important; }'});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(project.viewport.width*.82,project.viewport.height*.82);
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
      await sleep(Math.min(180, Math.max(60, frame.hold * 80)));
      await page.screenshot({path: path.join(stillDirectory, `${frame.id}.png`)});
      console.log(`[${event.at.toFixed(2)}с] сцена «${frame.label}» → ${frame.scrollY}px`);
    } else {
      const action = event.value;
      const target = await pointerTarget(page, action);
      action.x=target.x;
      action.y=target.y;
      await movePointerNaturally(page,project,action);
      if (action.kind === 'click') {
        const settleMs=Math.max(170,(action.settle??.2)*1000);
        const leadIn=Math.max(30,(settleMs-80)*.45);
        await sleep(leadIn);
        await page.mouse.down();
        await sleep(80);
        await page.mouse.up();
        await sleep(Math.max(20,settleMs-leadIn-80));
      }
      console.log(`[${event.at.toFixed(2)}с] ${action.kind === 'click' ? 'клик' : action.kind === 'hover' ? 'наведение' : 'движение'} «${action.targetLabel || action.label}» → ${Math.round(target.x)}, ${Math.round(target.y)}`);
    }
  }

  const remaining = project.duration - (Date.now() - timelineStarted) / 1000;
  if (remaining > 0) await sleep(remaining * 1000);
  const video = page.video();
  await page.close();
  await context.close();
  const recordedPath = await video?.path();
  await browser.close();

  if (!recordedPath) throw new Error('Playwright не создал видеофайл');
  await fs.copyFile(recordedPath, path.join(output, 'capture.webm'));
  await fs.rm(videoDirectory, {recursive: true, force: true});

  // Каталог ревизии никем не используется до этой точки. Публикация происходит
  // одной сменой URL в проекте, поэтому открытое старое превью не блокирует запись.
  project.pageHeight = pageHeight;
  project.videoOffset = videoOffset;
  project.previewVideo = `/captures/${captureId}/capture.webm`;
  project.frames = project.frames.map((frame) => ({...frame, thumbnail: `/captures/${captureId}/stills/${frame.id}.png?v=${Date.now()}`}));
  await fs.writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.resolve('data/generated/editor-project.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
  pendingOutput = undefined;
  const oldRevisions = (await fs.readdir(captureRoot, {withFileTypes: true}))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${captureBaseId}-`) && entry.name !== captureId)
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(4);
  await Promise.all(oldRevisions.map((name) => fs.rm(path.join(captureRoot, name), {recursive: true, force: true}).catch(() => undefined)));
  console.log(`Захват готов: ${project.previewVideo}`);
};

main().catch(async (error) => {
  if (pendingOutput) await fs.rm(pendingOutput, {recursive: true, force: true}).catch(() => undefined);
  console.error(error);
  process.exit(1);
});
