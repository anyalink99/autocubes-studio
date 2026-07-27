import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const main=async()=>{
  const port=4196;
  const baseUrl=`http://127.0.0.1:${port}`;
  const server=await createServer({configFile:path.resolve('vite.config.ts'),server:{host:'127.0.0.1',port,strictPort:true,open:false}});
  await server.listen();
  const browser=await chromium.launch({headless:true});
  const errors:string[]=[];
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.addInitScript(()=>sessionStorage.setItem('autocubes-sync-disabled','true'));
    page.on('pageerror',(error)=>errors.push(error.message));
    page.on('console',(message)=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))errors.push(message.text());});

    await page.goto(`${baseUrl}/documents.html`,{waitUntil:'networkidle'});
    await page.evaluate(()=>{localStorage.removeItem('autocubes-documents-v2');localStorage.removeItem('autocubes-documents-v1');});
    await page.reload({waitUntil:'networkidle'});

    const intro=page.locator('.paper-intro');
    await intro.fill(Array.from({length:14},(_,index)=>`Document flow line ${index+1}`).join('\n'));
    await page.waitForTimeout(50);
    const introSize=await intro.evaluate((field)=>({clientHeight:field.clientHeight,scrollHeight:field.scrollHeight}));
    if(introSize.scrollHeight>introSize.clientHeight+1)throw new Error('Document intro has a nested scrollbar');

    const stage=page.locator('.paper-stage');
    const stageSize=await stage.evaluate((element)=>({clientHeight:element.clientHeight,scrollHeight:element.scrollHeight}));
    if(stageSize.scrollHeight<=stageSize.clientHeight)throw new Error('Document paper does not own vertical scrolling');
    await page.mouse.move(760,700);
    await page.mouse.wheel(0,600);
    await page.waitForTimeout(100);
    if(await stage.evaluate((element)=>element.scrollTop)<300)throw new Error('Mouse wheel did not scroll the document paper');

    await stage.evaluate((element)=>{element.scrollTop=element.scrollHeight;});
    await page.getByRole('button',{name:/Добавить блок/}).click();
    await page.locator('.block-menu').getByRole('button',{name:'Чек-лист'}).click();
    const checklistItem=page.locator('.paper-block').last().locator('.block-item-text').first();
    await checklistItem.fill('A deliberately long checklist item that wraps onto several lines and remains fully visible without an inner scrollbar.');
    await page.waitForTimeout(50);
    const checklistSize=await checklistItem.evaluate((field)=>({clientHeight:field.clientHeight,scrollHeight:field.scrollHeight}));
    if(checklistSize.scrollHeight>checklistSize.clientHeight+1)throw new Error('Checklist item has a nested scrollbar');

    await page.getByRole('button',{name:/Добавить блок/}).click();
    await page.locator('.block-menu').getByRole('button',{name:'Таблица'}).click();
    const tableCell=page.locator('.paper-block').last().locator('.block-table-cell').nth(3);
    await tableCell.fill('A long table value that wraps in the cell instead of disappearing behind horizontal text-field scrolling.');
    await page.waitForTimeout(50);
    const tableSize=await tableCell.evaluate((field)=>({clientHeight:field.clientHeight,scrollHeight:field.scrollHeight}));
    if(tableSize.scrollHeight>tableSize.clientHeight+1)throw new Error('Table cell has a nested scrollbar');

    await page.waitForTimeout(100);
    const pagination=await page.evaluate(()=>{
      const paper=document.querySelector<HTMLElement>('.document-paper');
      if(!paper)return {guideCount:0,violations:['paper missing']};
      const styles=getComputedStyle(paper);
      const pageHeight=Number.parseFloat(styles.getPropertyValue('--document-page-height'));
      const pageMargin=Number.parseFloat(styles.getPropertyValue('--document-page-margin'));
      const printableHeight=pageHeight-pageMargin*2;
      const violations=[...paper.querySelectorAll<HTMLElement>('.paper-block:not(.page-break-block)')].filter((block)=>{
        const position=((block.offsetTop%pageHeight)+pageHeight)%pageHeight;
        return block.offsetHeight<=printableHeight&&position+block.offsetHeight>pageHeight-pageMargin+2;
      }).map((block)=>block.querySelector<HTMLTextAreaElement>('.block-heading')?.value||block.className);
      return {guideCount:paper.querySelectorAll('.pagination-guide').length,violations};
    });
    if(pagination.guideCount<1)throw new Error('A4 page boundaries are not visible in the editor');
    if(pagination.violations.length)throw new Error(`Document blocks cross visible page boundaries: ${pagination.violations.join(', ')}`);

    await fs.mkdir(path.resolve('out/qa'),{recursive:true});
    await page.screenshot({path:path.resolve('out/qa/documents-flow-desktop.png')});

    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(50);
    const mobile=await page.evaluate(()=>({
      bodyScrollWidth:document.body.scrollWidth,
      viewportWidth:window.innerWidth,
      toolbarClientWidth:document.querySelector<HTMLElement>('.document-toolbar>div:last-child')?.clientWidth??0,
      toolbarScrollWidth:document.querySelector<HTMLElement>('.document-toolbar>div:last-child')?.scrollWidth??0,
    }));
    if(mobile.bodyScrollWidth>mobile.viewportWidth+1)throw new Error(`Documents mobile layout overflows by ${mobile.bodyScrollWidth-mobile.viewportWidth}px`);
    if(mobile.toolbarScrollWidth<=mobile.toolbarClientWidth)throw new Error('Documents mobile toolbar no longer exposes its horizontal action rail');
    await page.screenshot({path:path.resolve('out/qa/documents-flow-mobile.png'),fullPage:true});

    await page.evaluate(()=>{
      const documents=JSON.parse(localStorage.getItem('autocubes-documents-v2')||'[]');
      const out={id:'out',type:'checklist',heading:'Out of scope',body:'Explicit exclusions.',items:['Third-party fees'],checked:[false]};
      const questions={id:'questions',type:'checklist',heading:'Discovery questions',body:'',items:['Launch market'],checked:[false]};
      documents[0].blocks=[out,questions];
      documents[0].localized={ru:{...documents[0].localized.ru,blocks:[out,questions]},en:{...documents[0].localized.en,blocks:[out,questions]}};
      localStorage.setItem('autocubes-documents-v2',JSON.stringify(documents));
    });
    await page.reload({waitUntil:'networkidle'});
    const outOfScope=page.locator('.paper-block.block-deliverables').filter({hasText:'Out of scope'});
    if(await outOfScope.count()!==1)throw new Error('Out-of-scope migration did not use the standard deliverables format');
    if(await outOfScope.locator('input[type="checkbox"]').count())throw new Error('Out-of-scope migration kept checklist controls');
    const discoveryQuestions=page.locator('.paper-block.block-deliverables').filter({hasText:'Discovery questions'});
    if(await discoveryQuestions.count()!==1)throw new Error('Discovery questions migration did not use the standard list format');
    if(await discoveryQuestions.locator('input[type="checkbox"]').count())throw new Error('Discovery questions migration kept checklist controls');

    if(errors.length)throw new Error(`Browser errors:\n${errors.join('\n')}`);
    console.log('Documents flow passed · scroll · expanding fields · A4 guides · standard list migrations · mobile toolbar');
  }finally{
    await browser.close();
    await server.close();
  }
};

void main().catch((error)=>{console.error(error);process.exitCode=1;});
