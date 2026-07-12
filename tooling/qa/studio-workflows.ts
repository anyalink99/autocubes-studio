import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const main=async()=>{
  const port=4193;
  const baseUrl=`http://127.0.0.1:${port}`;
  const server=await createServer({configFile:path.resolve('vite.config.ts'),server:{host:'127.0.0.1',port,strictPort:true,open:false}});
  const browser=await chromium.launch({headless:true});
  const errors:string[]=[];
  try{
    await server.listen();
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',(error)=>errors.push(error.message));
    page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
    await page.route('**/api/project*',(route)=>route.request().method()==='PUT'?route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}):route.continue());

    await page.goto(`${baseUrl}/editor.html`,{waitUntil:'networkidle'});
    if(!await page.locator('.page-map').isVisible())throw new Error('Motion Page Map is not visible');
    await page.locator('.shot-card-main').first().click();
    const position=page.locator('.position-input-row input');
    await position.fill('50%');
    await position.press('Enter');
    if(!/px$/.test(await position.inputValue()))throw new Error('Page Position did not accept a percentage');
    const selectedStop=page.locator('.page-map-stop.selected');
    if(!await selectedStop.isVisible())throw new Error('Page Map did not reflect shot selection');
    await page.getByTitle('Build a story from a recipe').click();
    await page.getByRole('button',{name:/Site walkthrough/}).click();
    if(await page.locator('.shot-card').count()!==5)throw new Error('Motion recipe did not build five shots');
    await page.getByTitle('Add Overlays at playhead').click();
    if(await page.locator('.track-overlays .timeline-clip').count()!==1)throw new Error('Overlay track did not receive a clip');
    await page.getByTitle('Add Captions at playhead').click();
    await page.locator('.inspector textarea').fill('Studio workflow test');
    await page.locator('.inspector select').filter({has:page.locator('option[value="rise"]')}).selectOption('rise');
    if(await page.locator('.preview-caption').textContent()!=='Studio workflow test')throw new Error('Caption Studio did not update preview');
    await page.getByTitle('Add marker at playhead').click();
    if(await page.locator('.timeline-marker').count()!==1)throw new Error('Timeline marker was not created');
    const frameClips=page.locator('.track-frames .timeline-clip');
    await frameClips.nth(0).click();
    await frameClips.nth(1).click({modifiers:['Shift']});
    if(await page.locator('.track-frames .timeline-clip.selected').count()!==2)throw new Error('Timeline multi-selection failed');
    if(Number.parseInt(await page.locator('.position-input-row input').inputValue(),10)<=0)throw new Error('Page Position readout did not follow timeline selection');
    await page.screenshot({path:path.resolve('out/qa/motion-workflow.png')});

    await page.goto(`${baseUrl}/apps/identity/identity-lab.html`,{waitUntil:'networkidle'});
    await page.evaluate(()=>localStorage.clear());
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#openBrandKit').click();
    await page.locator('#brandName').fill('Studio Test');
    await page.locator('#brandTagline').fill('One system, every format.');
    await page.locator('#saveBrandKit').click();
    if((await page.locator('.composition .brand-lockup > span').first().textContent())!=='Studio Test')throw new Error('Brand Kit did not apply to ideas');
    await page.locator('.pick-button').nth(0).click();
    await page.locator('.pick-button').nth(1).click();
    await page.locator('#openCarousel').click();
    if(await page.locator('.carousel-item').count()!==2)throw new Error('Carousel Builder did not receive picked compositions');
    await page.locator('#reverseCarousel').click();
    await page.screenshot({path:path.resolve('out/qa/identity-carousel.png')});
    await page.locator('#closeCarousel').click();

    await page.goto(`${baseUrl}/documents.html`,{waitUntil:'networkidle'});
    await page.evaluate(()=>{localStorage.removeItem('autocubes-documents-v2');localStorage.removeItem('autocubes-documents-v1');});
    await page.reload({waitUntil:'networkidle'});
    const initialBlocks=await page.locator('.paper-block').count();
    await page.getByRole('button',{name:/Add block/}).click();
    await page.locator('.block-menu').getByRole('button',{name:'Checklist'}).click();
    if(await page.locator('.paper-block').count()!==initialBlocks+1)throw new Error('Documents did not insert a block');
    await page.getByTitle('Undo').click();
    if(await page.locator('.paper-block').count()!==initialBlocks)throw new Error('Documents undo failed');
    await page.getByTitle('Redo').click();
    const markdownPromise=page.waitForEvent('download');
    await page.getByTitle('Download Markdown').click();
    const markdown=await markdownPromise;
    const markdownPath=path.resolve('out/qa/studio-document.md');
    await markdown.saveAs(markdownPath);
    if((await fs.stat(markdownPath)).size<200)throw new Error('Documents Markdown export is too small');
    await page.screenshot({path:path.resolve('out/qa/documents-blocks.png')});

    await page.goto(baseUrl,{waitUntil:'networkidle'});
    if(await page.locator('.production-flow a').count()!==3)throw new Error('Studio production flow is missing');
    if(!await page.locator('#project-hub').isVisible())throw new Error('Studio Project Hub is missing');
    if(errors.length)throw new Error(`Browser errors:\n${errors.join('\n')}`);
    console.log('Studio workflows passed · Motion Page Map/Timeline · Identity Brand Kit/Carousel · Documents blocks · Project Hub');
  }finally{await browser.close();await server.close();}
};

void main().catch((error)=>{console.error(error);process.exitCode=1;});
