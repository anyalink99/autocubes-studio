import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const main = async () => {
  const externalUrl = process.argv[2];
  const port = 4192;
  const baseUrl = externalUrl ?? `http://127.0.0.1:${port}`;
  const server = externalUrl ? null : await createServer({
    configFile: path.resolve('vite.config.ts'),
    server: {host: '127.0.0.1', port, strictPort: true, open: false},
  });
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {if (message.type() === 'error') errors.push(message.text());});

  try {
  await server?.listen();
  await page.goto(`${baseUrl}/apps/identity/identity-lab.html`, {waitUntil: 'networkidle'});
  await page.evaluate(() => localStorage.clear());
  await page.reload({waitUntil: 'networkidle'});

  for (let index = 0; index < 30; index += 1) {
    await page.locator('.composition[data-template="0"]').locator('[data-delta="1"]').click();
  }

  const galleryState = await page.evaluate(() => ({
    cards: document.querySelectorAll('.composition').length,
    visible: [...document.querySelectorAll<HTMLElement>('.composition')].filter((card) => !card.hidden).length,
    boards: [...document.querySelectorAll<HTMLElement>('.composition .artboard')].map((board) => {
      const bounds = board.getBoundingClientRect();
      return {width: bounds.width, height: bounds.height};
    }),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  if (galleryState.cards !== 64 || galleryState.visible !== 64) throw new Error(`Gallery lost cards: ${JSON.stringify(galleryState)}`);
  if (galleryState.boards.some(({width, height}) => width < 100 || height < 100 || Math.abs(width / height - .8) > .02)) throw new Error('Gallery artboard geometry is unstable');

  const identityTypography = await page.evaluate(() => ({
    foreignFonts:[...new Set([...document.querySelectorAll<HTMLElement>('.composition .artboard, .composition .artboard *')]
      .map((element) => getComputedStyle(element).fontFamily)
      .filter((family) => !family.toLowerCase().startsWith('inter'))) ],
    idea61Text:document.querySelector<HTMLElement>('.composition[data-template="60"] .brief-main')?.innerText.replace(/\s+/g, ' ').trim(),
  }));
  if (identityTypography.foreignFonts.length) throw new Error(`Identity typography drifted from Inter: ${identityTypography.foreignFonts.join(', ')}`);
  if (identityTypography.idea61Text !== 'We create brand identities, websites, applications, motion, and digital systems. One team takes the work from the first idea to launch.') {
    throw new Error(`Idea 61 copy drifted: ${identityTypography.idea61Text}`);
  }

  const controlsCard = page.locator('.composition[data-template="60"] .artboard');
  await controlsCard.click();
  const logoToggle = page.locator('[data-prop="logoVisible"]');
  if (!(await logoToggle.isChecked())) throw new Error('Logo visibility control did not default to visible');
  await logoToggle.uncheck();
  const headingId = await page.locator('#modalArtboard .brief-main').getAttribute('data-edit-id');
  if (!headingId) throw new Error('Idea 61 heading did not receive an editable layer id');
  await page.locator(`.layer-row[data-layer="${headingId}"] .layer-name`).click();
  const weightControl = page.locator('[data-prop="fontWeight"]');
  await weightControl.selectOption('900');
  const changedControls = await page.locator('#modalArtboard .artboard').evaluate((board) => ({
    logosHidden:board.classList.contains('logos-hidden'),
    logoDisplay:getComputedStyle(board.querySelector<HTMLElement>('.brief-mark')!).display,
    headingWeight:getComputedStyle(board.querySelector<HTMLElement>('.brief-main')!).fontWeight,
  }));
  if (!changedControls.logosHidden || changedControls.logoDisplay !== 'none') throw new Error(`Logo visibility did not apply: ${JSON.stringify(changedControls)}`);
  if (changedControls.headingWeight !== '900') throw new Error(`Text weight did not apply: ${JSON.stringify(changedControls)}`);
  await page.locator('#closeModal').click();
  await controlsCard.click();
  const persistedControls = await page.locator('#modalArtboard .artboard').evaluate((board) => ({
    logosHidden:board.classList.contains('logos-hidden'),
    headingWeight:getComputedStyle(board.querySelector<HTMLElement>('.brief-main')!).fontWeight,
  }));
  if (!persistedControls.logosHidden || persistedControls.headingWeight !== '900') throw new Error(`Identity controls did not persist: ${JSON.stringify(persistedControls)}`);
  await page.locator('#resetComposition').click();
  await page.locator('#closeModal').click();

  const readProcessGeometry = async (selector: string) => page.locator(selector).evaluate((board) => {
    const boardBounds = board.getBoundingClientRect();
    return Object.fromEntries(['h2','.steps','.step:first-child'].map((item) => {
      const element = board.querySelector<HTMLElement>(item)!;
      const bounds = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      return [item,{left:(bounds.left-boardBounds.left)/boardBounds.width,top:(bounds.top-boardBounds.top)/boardBounds.height,width:bounds.width/boardBounds.width,height:bounds.height/boardBounds.height,fontSize:Number.parseFloat(computed.fontSize)/(board as HTMLElement).clientWidth,border:Number.parseFloat(computed.borderBottomWidth)/(board as HTMLElement).clientWidth}];
    }));
  });
  const galleryProcess: Record<string, Record<string, number>> = await readProcessGeometry('.composition[data-template="5"] .artboard');
  await page.locator('.composition[data-template="5"] .artboard').click();
  await page.waitForTimeout(250);
  const editorProcess: Record<string, Record<string, number>> = await readProcessGeometry('#modalArtboard .artboard');
  for (const key of Object.keys(galleryProcess)) for (const metric of Object.keys(galleryProcess[key])) {
    if (Math.abs(galleryProcess[key][metric]-editorProcess[key][metric])>.002) throw new Error(`Process layout mismatch at ${key}.${metric}: ${galleryProcess[key][metric]} vs ${editorProcess[key][metric]}`);
  }
  await page.locator('#closeModal').click();

  const targetCard = page.locator('.composition').nth(24);
  await targetCard.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await targetCard.locator('[data-delta="1"]').click();
  const scrollAfter = await page.evaluate(() => window.scrollY);
  if (Math.abs(scrollAfter - scrollBefore) > 2) throw new Error(`Variant paging moved the page by ${scrollAfter - scrollBefore}px`);

  const galleryTypography = await page.locator('.composition[data-template="0"] .artboard').evaluate((board) => {
    const element = board.querySelector<HTMLElement>('.brand-lockup > span')!;
    return Number.parseFloat(getComputedStyle(element).fontSize) / (board as HTMLElement).clientWidth;
  });
  await page.locator('.composition[data-template="0"] .artboard').click();
  await page.waitForTimeout(250);
  const editorTypography = await page.locator('#modalArtboard .artboard').evaluate((board) => {
    const element = board.querySelector<HTMLElement>('.brand-lockup > span')!;
    return Number.parseFloat(getComputedStyle(element).fontSize) / (board as HTMLElement).clientWidth;
  });
  if (Math.abs(galleryTypography - editorTypography) > .001) throw new Error(`Gallery/editor typography mismatch: ${galleryTypography} vs ${editorTypography}`);
  await page.locator('.layer-row').nth(1).locator('.layer-name').click();
  const defaultFields = await page.locator('#inspector').evaluate((inspector) => Object.fromEntries(
    ['x','y','width','height','fontSize','opacity'].map((property) => [property, (inspector.querySelector<HTMLInputElement>(`[data-prop="${property}"]`)?.value ?? '')]),
  ));
  if (Object.values(defaultFields).some((value) => value === '') || Number(defaultFields.width) <= 0 || Number(defaultFields.height) <= 0) {
    throw new Error(`Layer defaults were not initialized: ${JSON.stringify(defaultFields)}`);
  }
  const selectedBefore = await page.locator('.editor-selected').boundingBox();
  await page.locator('[data-prop="width"]').fill(String(Number(defaultFields.width) + 1));
  const selectedAfter = await page.locator('.editor-selected').boundingBox();
  if (!selectedBefore || !selectedAfter || selectedAfter.width < selectedBefore.width * .8) throw new Error('First size edit reset the layer geometry');

  const modalLayout = await page.evaluate(() => Object.fromEntries(
    ['#modal', '.modal-panel', '.panel-head', '.editor-scroll', '.modal-actions', '.export-actions', '.modal-nav', '#nextComposition']
      .map((selector) => [selector, document.querySelector<HTMLElement>(selector)?.getBoundingClientRect().toJSON()]),
  ));
  if ((modalLayout['#nextComposition']?.bottom ?? Infinity) > 1000) {
    throw new Error(`Modal controls are outside viewport: ${JSON.stringify(modalLayout)}`);
  }
  for (let index = 0; index < 20; index += 1) await page.locator('#nextComposition').click();

  const previewAt100 = await page.locator('#modalArtboard').boundingBox();
  await page.locator('#studioScale').fill('60');
  await page.waitForTimeout(250);
  const previewAt60 = await page.locator('#modalArtboard').boundingBox();
  if (!previewAt100 || !previewAt60 || previewAt60.width >= previewAt100.width * .8) throw new Error(`Studio scale does not control the preview: ${JSON.stringify({previewAt100,previewAt60,value:await page.locator('#studioScale').inputValue()})}`);
  if (await page.locator('#modalArtboard').evaluate((element) => (element as HTMLElement).offsetWidth) !== 1080) throw new Error('Studio scale changed canonical artboard geometry');
  await page.locator('#studioScale').fill('100');

  for (const zoom of [.75, 1, 1.25, 1.5, 2]) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = String(value);
      window.dispatchEvent(new Event('resize'));
    }, zoom);
    await page.waitForTimeout(50);
    const state = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.modal-stage')!.getBoundingClientRect();
      const shell = document.querySelector<HTMLElement>('#modalArtboard')!.getBoundingClientRect();
      const board = document.querySelector<HTMLElement>('#modalArtboard .artboard')!.getBoundingClientRect();
      return {stage, shell, board, canonicalWidth:document.querySelector<HTMLElement>('#modalArtboard')!.offsetWidth};
    });
    if (state.canonicalWidth !== 1080) throw new Error(`Browser zoom changed canonical geometry at ${zoom}: ${JSON.stringify(state)}`);
    if (Math.abs(state.board.width / state.board.height - .8) > .02) throw new Error(`Modal ratio broke at zoom ${zoom}`);
  }

  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  for (const viewport of [{width: 1024, height: 768}, {width: 800, height: 900}, {width: 390, height: 844}]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.modal-stage')!.getBoundingClientRect();
      const shell = document.querySelector<HTMLElement>('#modalArtboard')!.getBoundingClientRect();
      const next = document.querySelector<HTMLElement>('#nextComposition')!.getBoundingClientRect();
      return {stage, shell, next, viewport: {width: window.innerWidth, height: window.innerHeight}};
    });
    if (layout.shell.right > layout.stage.right + 2 || layout.shell.bottom > layout.stage.bottom + 2 || layout.shell.left < layout.stage.left - 2 || layout.shell.top < layout.stage.top - 2) {
      throw new Error(`Modal escaped at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
    }
    if (layout.next.bottom > layout.viewport.height + 1 || layout.next.right > layout.viewport.width + 1) {
      throw new Error(`Modal navigation clipped at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
    }
  }

  await page.screenshot({path: path.resolve('out/qa/identity-stress.png')});
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
  console.log('Identity stress passed');
  } finally {
    await browser.close();
    await server?.close();
  }
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
