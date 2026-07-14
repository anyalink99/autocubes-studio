import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import JSZip from 'jszip';
import {EditorProject} from '../../packages/core/editor-project';

const main = async () => {
  const port = 4190;
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = await createServer({
    configFile: path.resolve('vite.config.ts'),
    server: {host: '127.0.0.1', port, strictPort: true, open: false},
  });
  const browser = await chromium.launch({headless: true});

  try {
    await server.listen();
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});

    await page.goto(`${baseUrl}/apps/identity/identity-lab.html`, {waitUntil: 'networkidle'});
    await page.locator('[data-format="square"]').click();
    await page.locator('.artboard').first().click();
    await page.locator('#addText').click();
    await page.locator('[data-prop="text"]').fill('Smoke test');
    await page.locator('#undoEdit').click();
    if (await page.locator('.editor-added-text').textContent() === 'Smoke test') {
      throw new Error('Identity undo did not restore the previous text');
    }
    await page.locator('#redoEdit').click();
    if (await page.locator('.editor-added-text').textContent() !== 'Smoke test') {
      throw new Error('Identity redo did not restore the edited text');
    }
    await page.locator('#duplicateSelected').click();
    if (await page.locator('.editor-added-text').count() !== 2) throw new Error('Identity layer duplication failed');
    await page.locator('#undoEdit').click();
    if (await page.locator('.editor-added-text').count() !== 1) throw new Error('Identity duplicate undo failed');
    await page.locator('#redoEdit').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportPng').click();
    const download = await downloadPromise;
    const exportPath = path.resolve('out/qa/identity-square.png');
    await fs.mkdir(path.dirname(exportPath), {recursive: true});
    await download.saveAs(exportPath);
    const exportSize = (await fs.stat(exportPath)).size;
    if (exportSize < 10_000) throw new Error(`Identity export is unexpectedly small: ${exportSize} bytes`);
    const squarePng = await fs.readFile(exportPath);
    if (squarePng.readUInt32BE(16) !== 1080 || squarePng.readUInt32BE(20) !== 1080) throw new Error('Identity square export dimensions are incorrect');
    await page.locator('#studioScale').fill('60');
    await page.evaluate(() => {document.documentElement.style.zoom = '1.5';});
    const zoomedDownloadPromise = page.waitForEvent('download');
    await page.locator('#exportPng').click();
    const zoomedDownload = await zoomedDownloadPromise;
    const zoomedPath = path.resolve('out/qa/identity-square-zoomed.png');
    await zoomedDownload.saveAs(zoomedPath);
    const zoomedPng = await fs.readFile(zoomedPath);
    if (!squarePng.equals(zoomedPng)) throw new Error('Identity export changed with Studio or browser scale');
    await page.evaluate(() => {document.documentElement.style.zoom = '';});
    await page.locator('#studioScale').fill('100');
    await page.screenshot({path: path.resolve('out/qa/identity-editor.png')});

    const formatsPromise = page.waitForEvent('download');
    await page.locator('#exportAllSizes').click();
    const formatsDownload = await formatsPromise;
    const formatsPath = path.resolve('out/qa/identity-formats.zip');
    await formatsDownload.saveAs(formatsPath);
    const formatZip = await JSZip.loadAsync(await fs.readFile(formatsPath));
    const formatPngs = Object.keys(formatZip.files).filter((name) => name.endsWith('.png'));
    if (formatPngs.length !== 4) throw new Error(`All-formats export contains ${formatPngs.length} PNG files`);

    await page.locator('#modalPick').click();
    await page.locator('#closeModal').click();
    const packPromise = page.waitForEvent('download');
    await page.locator('#exportPack').click();
    const pack = await packPromise;
    const packPath = path.resolve('out/qa/identity-pack.zip');
    await pack.saveAs(packPath);
    if ((await fs.stat(packPath)).size < 10_000) throw new Error('Identity PNG pack is unexpectedly small');

    await page.locator('#customFormat summary').click();
    await page.locator('#customWidth').fill('1200');
    await page.locator('#customHeight').fill('628');
    await page.locator('#applyCustom').click();
    await page.locator('.artboard').first().click();
    const customPromise = page.waitForEvent('download');
    await page.locator('#exportPng').click();
    const customDownload = await customPromise;
    const customPath = path.resolve('out/qa/identity-custom.png');
    await customDownload.saveAs(customPath);
    const customPng = await fs.readFile(customPath);
    if (customPng.readUInt32BE(16) !== 1200 || customPng.readUInt32BE(20) !== 628) throw new Error('Identity custom export dimensions are incorrect');
    await page.locator('#closeModal').click();
    await page.locator('[data-format="portrait"]').click();

    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`${baseUrl}/apps/identity/identity-lab.html`, {waitUntil: 'networkidle'});
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (horizontalOverflow > 2) throw new Error(`Identity mobile layout overflows by ${horizontalOverflow}px`);
    await page.locator('.artboard').first().click();
    if (!await page.locator('#closeModal').isVisible() || !await page.locator('#exportPng').isVisible()) throw new Error('Identity mobile editor controls are not visible');
    await page.screenshot({path: path.resolve('out/qa/identity-mobile.png')});
    await page.setViewportSize({width: 1440, height: 1000});

    await page.route('**/api/project*', (route) => route.request().method() === 'PUT'
      ? route.fulfill({status: 200, contentType: 'application/json', body: '{"ok":true}'})
      : route.continue());
    await page.goto(`${baseUrl}/editor.html`, {waitUntil: 'networkidle'});
    if (!await page.getByRole('button', {name: 'Экспорт MP4'}).isVisible()) throw new Error('Motion toolbar is not visible');
    const projectDownloadPromise = page.waitForEvent('download');
    await page.getByTitle('Экспорт JSON проекта').click();
    const projectDownload = await projectDownloadPromise;
    const projectExportPath = path.resolve('out/qa/project.editor.json');
    await projectDownload.saveAs(projectExportPath);
    const projectExport = JSON.parse(await fs.readFile(projectExportPath, 'utf8')) as EditorProject;
    if (!projectExport.title) throw new Error('Motion project export is invalid');
    if (!await page.getByTitle('Магнит к плейхеду, маркерам и краям').isVisible()) throw new Error('Timeline magnet control is missing');
    if (!await page.getByTitle('Ripple: сдвигать всё после правой обрезки').isVisible()) throw new Error('Timeline ripple control is missing');
    if (!await page.locator('.clip-handle-start').count() || !await page.locator('.clip-handle-end').count()) throw new Error('Timeline must expose both trim handles');
    const analysisResponse=await page.request.post(`${baseUrl}/api/capture/analyze`,{data:{project:{...projectExport,id:'qa-live-preview',url:`${baseUrl}/operations.html`,viewport:{width:1080,height:900}}}});
    if(!analysisResponse.ok())throw new Error(`Capture analysis returned ${analysisResponse.status()}`);
    const analysis=await analysisResponse.json() as {previewFrames?:Array<{image:string;scrollY:number}>};
    if((analysis.previewFrames?.length??0)<2)throw new Error('Capture analysis did not store live viewport states');
    await page.locator('.preview-format').selectOption('instagram-portrait');
    const stageRatio = await page.locator('.stage').evaluate((element) => getComputedStyle(element).aspectRatio);
    if (!stageRatio.includes('1080') || !stageRatio.includes('1350')) throw new Error(`Motion format did not change: ${stageRatio}`);
    if (!await page.locator('.safe-zone-overlay').isVisible()) throw new Error('Motion safe zone is not visible');
    await page.getByTitle('Добавить: Текст').click();
    await page.locator('.inspector textarea').first().fill('Built to ship.');
    if (await page.locator('.preview-caption').textContent() !== 'Built to ship.') throw new Error('Motion caption preview did not update');
    const coverPromise = page.waitForEvent('download');
    await page.getByTitle('Экспортировать текущий кадр PNG').click();
    const cover = await coverPromise;
    const coverPath = path.resolve('out/qa/motion-cover.png');
    await cover.saveAs(coverPath);
    if ((await fs.stat(coverPath)).size < 10_000) throw new Error('Motion cover export is unexpectedly small');
    const coverPng = await fs.readFile(coverPath);
    if (coverPng.readUInt32BE(16) !== 1080 || coverPng.readUInt32BE(20) !== 1350) throw new Error('Motion cover export dimensions are incorrect');
    await page.screenshot({path: path.resolve('out/qa/motion-editor.png')});
    await page.setViewportSize({width: 1100, height: 800});
    const exportButtonBounds = await page.getByRole('button', {name: 'Экспорт MP4'}).boundingBox();
    if (!exportButtonBounds || exportButtonBounds.x + exportButtonBounds.width > 1100) throw new Error('Motion toolbar overflows a compact desktop');
    await page.screenshot({path: path.resolve('out/qa/motion-compact.png')});

    const response = await page.request.get(`${baseUrl}/api/projects`);
    if (!response.ok()) throw new Error(`Projects API returned ${response.status()}`);
    const projects = await response.json() as unknown[];
    if (!projects.length) throw new Error('Projects API returned no projects');

    const sourceResponse = await page.request.get(`${baseUrl}/api/project`);
    const sourceProject = await sourceResponse.json() as Record<string, unknown>;
    const duplicateResponse = await page.request.post(`${baseUrl}/api/projects`, {data: sourceProject});
    if (!duplicateResponse.ok()) throw new Error(`Project duplication returned ${duplicateResponse.status()}`);
    const duplicate = await duplicateResponse.json() as {id: string};
    try {
      const removeProjectResponse = await page.request.delete(`${baseUrl}/api/project?id=${encodeURIComponent(duplicate.id)}`);
      if (!removeProjectResponse.ok()) throw new Error(`Project deletion returned ${removeProjectResponse.status()}`);
    } finally {
      await fs.rm(path.resolve('data/projects', `${duplicate.id}.editor.json`), {force: true});
    }
    const missingProjectDelete = await page.request.delete(`${baseUrl}/api/project?id=qa-project-that-does-not-exist`);
    if (missingProjectDelete.ok()) throw new Error('The API reported success while deleting a missing project');

    const uploadResponse = await page.request.put(`${baseUrl}/api/assets?name=qa-tone.mp3`, {data: Buffer.from('ID3QA')});
    if (!uploadResponse.ok()) throw new Error(`Audio upload returned ${uploadResponse.status()}`);
    const uploaded = await uploadResponse.json() as {path: string};
    const assetsResponse = await page.request.get(`${baseUrl}/api/assets`);
    const assets = await assetsResponse.json() as {audio: string[]};
    if (!assets.audio.includes(uploaded.path)) throw new Error('Imported audio is missing from the asset library');
    const deleteResponse = await page.request.delete(`${baseUrl}/api/assets?path=${encodeURIComponent(uploaded.path)}`);
    if (!deleteResponse.ok()) throw new Error(`Audio cleanup returned ${deleteResponse.status()}`);
    const invalidUpload = await page.request.put(`${baseUrl}/api/assets?name=not-audio.exe`, {data: Buffer.from('MZ')});
    if (invalidUpload.ok()) throw new Error('The API accepted a disallowed audio extension');

    console.log(`Studio smoke passed · identity export ${Math.round(exportSize / 1024)} KB · ${projects.length} project(s)`);
  } finally {
    await browser.close();
    await server.close();
  }
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
