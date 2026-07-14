import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {Plugin, ViteDevServer} from 'vite';
import {CaptureAnalysis, EditorProject, JobState} from '../../packages/core/editor-project';
import {getJob, getJobOutput, startJob} from './job-manager';
import {capturesDirectory, editorFramesDirectory, workspacePath} from './paths';
import {createProject, deleteProject, listProjects, saveProject} from './project-repository';
import {launchStudioBrowser} from './browser';
import {assertSyncChannel, readSyncRecord, updateSyncRecord} from './sync-store';
import {AssistantApiError, AssistantRequest, createAssistantResponse} from './assistant-api';

const readBuffer = async (request: NodeJS.ReadableStream, maxBytes = 5 * 1024 * 1024) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error(`Request exceeds ${Math.round(maxBytes / 1024 / 1024)} MB`);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const readBody = async <T>(request: NodeJS.ReadableStream): Promise<T> => {
  return JSON.parse((await readBuffer(request)).toString('utf8')) as T;
};

const reply = (response: import('node:http').ServerResponse, status: number, body: unknown) => {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
};

const listFiles = async (directory: string, prefix: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(directory, {withFileTypes: true});
    const nested = await Promise.all(entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      const publicPath = `${prefix}/${entry.name}`;
      return entry.isDirectory() ? listFiles(full, publicPath) : [publicPath.replaceAll('\\', '/')];
    }));
    return nested.flat();
  } catch {
    return [];
  }
};

const captureFrame = async (project: EditorProject, frameId: string, scrollY: number) => {
  const browser = await launchStudioBrowser();
  try {
    const page = await browser.newPage({viewport: project.viewport});
    await page.goto(project.url, {waitUntil: 'networkidle', timeout: 60_000});
    await page.addStyleTag({content: '* { cursor: none !important; } html { scroll-behavior: auto !important; }'});
    const pageHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    await page.evaluate((target) => window.scrollTo(0, target), Number(scrollY));
    await page.waitForTimeout(650);
    const directory = path.join(editorFramesDirectory, project.id);
    await fs.mkdir(directory, {recursive: true});
    const filename = `${frameId.replace(/[^a-z0-9-_]/gi, '-')}.png`;
    await page.screenshot({path: path.join(directory, filename)});
    return {thumbnail: `/editor-frames/${project.id}/${filename}?v=${Date.now()}`, pageHeight};
  } finally {
    await browser.close();
  }
};

const analyzePage = async (project: EditorProject): Promise<CaptureAnalysis> => {
  const browser = await launchStudioBrowser();
  try {
    const page = await browser.newPage({viewport:project.viewport});
    await page.goto(project.url,{waitUntil:'domcontentloaded',timeout:60_000});
    await page.waitForTimeout(900);
    const result = await page.evaluate(() => {
      const visible = (element:Element) => {
        const rect=(element as HTMLElement).getBoundingClientRect();
        const style=getComputedStyle(element);
        // Opacity is deliberately ignored: scroll-reveal libraries often start
        // useful content at opacity:0 and reveal it only after IntersectionObserver fires.
        return rect.width>4&&rect.height>4&&style.display!=='none'&&style.visibility!=='hidden';
      };
      const selectorFor=(element:Element) => {
        const escaped=(value:string)=>CSS.escape(value);
        if(element.id)return `#${escaped(element.id)}`;
        for(const name of ['data-testid','data-test','aria-label','name']){const value=element.getAttribute(name);if(value)return `[${name}="${value.replaceAll('"','\\"')}"]`;}
        const parts:string[]=[];let current:Element|null=element;
        while(current&&current!==document.body&&parts.length<4){let part=current.tagName.toLowerCase();const parentElement:Element|null=current.parentElement;if(parentElement){const siblings=[...parentElement.children].filter((item)=>item.tagName===current!.tagName);if(siblings.length>1)part+=`:nth-of-type(${siblings.indexOf(current)+1})`;}parts.unshift(part);current=parentElement;}
        return parts.join(' > ');
      };
      const pageHeight=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
      const headings=[...document.querySelectorAll('h1,h2,h3,section[id]')].filter(visible).map((element,index)=>{const rect=(element as HTMLElement).getBoundingClientRect();const heading=element.matches('section')?element.querySelector('h1,h2,h3'):element;return {id:`section-${index}`,label:(heading?.textContent||element.getAttribute('aria-label')||`Section ${index+1}`).trim().replace(/\s+/g,' ').slice(0,80),selector:selectorFor(element),scrollY:Math.max(0,Math.round(rect.top+window.scrollY-window.innerHeight*.12)),level:element.matches('h1')?1:element.matches('h2')?2:3};}).filter((item)=>item.label);
      const sections=headings.filter((item,index,array)=>index===0||item.scrollY-array[index-1].scrollY>window.innerHeight*.28).slice(0,18);
      if(!sections.length||sections[0].scrollY>80)sections.unshift({id:'section-top',label:document.title||'Top',selector:'body',scrollY:0,level:1});
      const targets=[...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[tabindex]')].filter(visible).map((element,index)=>{const rect=(element as HTMLElement).getBoundingClientRect();const role=element.getAttribute('role')||element.tagName.toLowerCase();return {id:`target-${index}`,label:(element.getAttribute('aria-label')||element.textContent||element.getAttribute('placeholder')||element.getAttribute('title')||role).trim().replace(/\s+/g,' ').slice(0,70),selector:selectorFor(element),role,x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2),pageY:Math.round(rect.top+window.scrollY+rect.height/2),width:Math.round(rect.width),height:Math.round(rect.height)};}).filter((item)=>item.label).slice(0,100);
      return {title:document.title||new URL(location.href).hostname,pageHeight,sections,targets};
    });
    const directory=path.join(editorFramesDirectory,project.id);
    await fs.mkdir(directory,{recursive:true});
    await page.addStyleTag({content:'html { scroll-behavior: auto !important; } * { cursor: none !important; }'});
    const maxY=Math.max(0,result.pageHeight-project.viewport.height);
    const sweepStep=Math.max(320,Math.round(project.viewport.height*.72));
    const sweepPositions=[0,...Array.from({length:Math.min(20,Math.ceil(maxY/sweepStep)+1)},(_,index)=>Math.min(maxY,index*sweepStep)),...result.sections.map((section)=>Math.min(maxY,section.scrollY)),maxY]
      .filter((value,index,array)=>array.indexOf(value)===index)
      .sort((a,b)=>a-b);
    for(const scrollY of sweepPositions){
      await page.evaluate((target)=>window.scrollTo(0,target),scrollY);
      await page.waitForTimeout(180);
    }
    const previewPositions=[0,...result.sections.map((section)=>Math.min(maxY,section.scrollY)),maxY]
      .filter((value,index,array)=>array.indexOf(value)===index)
      .sort((a,b)=>a-b)
      .filter((_,index,array)=>array.length<=12||index===0||index===array.length-1||index%Math.ceil(array.length/12)===0);
    const version=Date.now();
    const previewFrames=[];
    for(const [index,scrollY] of previewPositions.entries()){
      await page.evaluate((target)=>window.scrollTo(0,target),scrollY);
      await page.waitForTimeout(260);
      const previewFilename=`page-preview-${index}.png`;
      await page.screenshot({path:path.join(directory,previewFilename)});
      const nearest=result.sections.reduce((best,section)=>Math.abs(section.scrollY-scrollY)<Math.abs(best.scrollY-scrollY)?section:best,result.sections[0]);
      previewFrames.push({id:`preview-${index}`,label:nearest?.label??`Viewport ${index+1}`,scrollY,image:`/editor-frames/${project.id}/${previewFilename}?v=${version}`});
    }
    const filename='page-analysis.png';
    await page.screenshot({path:path.join(directory,filename),fullPage:true});
    return {url:project.url,title:result.title,pageHeight:result.pageHeight,sections:result.sections,targets:result.targets,previewFrames,analyzedAt:new Date().toISOString(),fullPageImage:`/editor-frames/${project.id}/${filename}?v=${version}`};
  } finally {await browser.close();}
};

type MiddlewareHost = {middlewares: ViteDevServer['middlewares']};
type StudioApiOptions = {env?: Record<string, string | undefined>};

const bearerToken = (authorization: string | undefined) => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
};

const attachStudioApi = (server: MiddlewareHost, env: Record<string, string | undefined>) => {
  server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/api/')) return next();
      try {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/api/assistant' && request.method !== 'POST') {
          return reply(response, 405, {error: 'Use POST'});
        }
        if (url.pathname === '/api/assistant') {
          const accessToken = env.ASSISTANT_API_TOKEN;
          if (!accessToken) return reply(response, 503, {error: 'ASSISTANT_API_TOKEN is not configured'});
          if (bearerToken(request.headers.authorization) !== accessToken) return reply(response, 401, {error: 'A valid Bearer token is required'});
          try {
            let body: AssistantRequest;
            try {
              body = await readBody<AssistantRequest>(request);
            } catch {
              return reply(response, 400, {error: 'Request body must be valid JSON'});
            }
            const result = await createAssistantResponse(body, {
              apiKey: env.OPENAI_API_KEY,
              model: env.OPENAI_MODEL,
              instructions: env.OPENAI_ASSISTANT_INSTRUCTIONS,
            });
            return reply(response, 200, result);
          } catch (error) {
            if (error instanceof AssistantApiError) return reply(response, error.statusCode, {error: error.message});
            throw error;
          }
        }
        if (url.pathname.startsWith('/api/sync/')) {
          const configuredToken = env.STUDIO_SYNC_TOKEN;
          if (configuredToken && request.headers['x-studio-sync-token'] !== configuredToken) return reply(response, 401, {error: 'Sync token is required'});
          const channel = assertSyncChannel(url.pathname.split('/').pop() ?? '');
          if (request.method === 'GET') {
            const record = await readSyncRecord(channel);
            return record ? reply(response, 200, record) : reply(response, 404, {error: 'No shared state yet'});
          }
          if (request.method === 'PUT') {
            const {baseRevision, data, updatedBy} = await readBody<{baseRevision:number;data:unknown;updatedBy?:string}>(request);
            if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new Error('A valid baseRevision is required');
            const result = await updateSyncRecord(channel, baseRevision, data, updatedBy ?? 'studio');
            return result.conflict ? reply(response, 409, result.current) : reply(response, 200, result.current);
          }
          return reply(response, 405, {error: 'Use GET or PUT'});
        }
        if (url.pathname === '/api/documents/pdf' && request.method === 'POST') {
          const {html, filename} = await readBody<{html: string; filename?: string}>(request);
          if (!html?.trim() || html.length > 4_500_000) throw new Error('Document HTML is empty or too large');
          const browser = await launchStudioBrowser();
          try {
            const page = await browser.newPage();
            await page.setContent(html, {waitUntil: 'networkidle', timeout: 60_000});
            const pdf = await page.pdf({format: 'A4', printBackground: true, preferCSSPageSize: true});
            const safeName = `${path.basename(filename || 'autocubes-document', path.extname(filename || '')).replace(/[^a-z0-9а-яё_-]+/gi, '-') || 'autocubes-document'}.pdf`;
            response.statusCode = 200;
            response.setHeader('content-type', 'application/pdf');
            response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
            response.setHeader('content-length', pdf.length);
            response.end(pdf);
            return;
          } finally {
            await browser.close();
          }
        }
        if (url.pathname === '/api/projects' && request.method === 'GET') {
          const projects = await listProjects();
          return reply(response, 200, projects.map(({id, title, url: projectUrl}) => ({id, title, url: projectUrl})));
        }
        if (url.pathname === '/api/projects' && request.method === 'POST') {
          const source = request.headers['content-type']?.includes('application/json') ? await readBody<EditorProject>(request) : undefined;
          return reply(response, 200, await createProject(source));
        }
        if (url.pathname === '/api/project' && request.method === 'GET') {
          const projects = await listProjects();
          const requested = url.searchParams.get('id');
          const project = projects.find((item) => item.id === requested) ?? projects[0];
          return project ? reply(response, 200, project) : reply(response, 404, {error: 'No editor projects found'});
        }
        if (url.pathname === '/api/project' && request.method === 'PUT') {
          const project = await readBody<EditorProject>(request);
          await saveProject(project);
          return reply(response, 200, {ok: true});
        }
        if (url.pathname === '/api/project' && request.method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (!id) throw new Error('Project id is required');
          await deleteProject(id);
          return reply(response, 200, {ok: true});
        }
        if (url.pathname === '/api/assets' && request.method === 'GET') {
          const audio = [
            ...(await listFiles(workspacePath('public/assets/sfx'), '/assets/sfx')),
            ...(await listFiles(workspacePath('public/assets/music'), '/assets/music')),
          ].filter((file) => /\.(wav|mp3|m4a|aac)$/i.test(file));
          const captures = await listFiles(capturesDirectory, '/captures');
          return reply(response, 200, {
            audio,
            images: captures.filter((file) => /\.(png|jpe?g|webp)$/i.test(file)),
            videos: captures.filter((file) => /\.(webm|mp4)$/i.test(file)),
          });
        }
        if (url.pathname === '/api/assets' && request.method === 'PUT') {
          const originalName = url.searchParams.get('name') ?? 'audio';
          const extension = path.extname(originalName).toLowerCase();
          if (!['.wav', '.mp3', '.m4a', '.aac'].includes(extension)) throw new Error('Use WAV, MP3, M4A, or AAC audio');
          const safeName = path.basename(originalName, extension).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'audio';
          const filename = `${Date.now()}-${safeName}${extension}`;
          const directory = workspacePath('public/assets/music/imported');
          await fs.mkdir(directory, {recursive: true});
          await fs.writeFile(path.join(directory, filename), await readBuffer(request, 50 * 1024 * 1024));
          return reply(response, 200, {path: `/assets/music/imported/${filename}`});
        }
        if (url.pathname === '/api/assets' && request.method === 'DELETE') {
          const assetPath = url.searchParams.get('path') ?? '';
          if (!assetPath.startsWith('/assets/music/imported/')) throw new Error('Only imported audio can be removed');
          const filename = path.basename(assetPath);
          await fs.unlink(path.join(workspacePath('public/assets/music/imported'), filename));
          return reply(response, 200, {ok: true});
        }
        if (url.pathname === '/api/frame' && request.method === 'POST') {
          const {project, frameId, scrollY} = await readBody<{project: EditorProject; frameId: string; scrollY: number}>(request);
          return reply(response, 200, await captureFrame(project, frameId, scrollY));
        }
        if (url.pathname === '/api/capture/analyze' && request.method === 'POST') {
          const {project}=await readBody<{project:EditorProject}>(request);
          return reply(response,200,await analyzePage(project));
        }
        if (url.pathname === '/api/jobs' && request.method === 'POST') {
          const {kind, projectId} = await readBody<{kind: JobState['kind']; projectId: string}>(request);
          if (kind !== 'capture' && kind !== 'render') throw new Error('Invalid job kind');
          return reply(response, 200, await startJob(kind, projectId));
        }
        if (url.pathname.match(/^\/api\/jobs\/[^/]+\/output$/) && request.method === 'GET') {
          const id = url.pathname.split('/')[3];
          const output = getJobOutput(id);
          const job = getJob(id);
          if (!output || job?.status !== 'complete') return reply(response, 404, {error: 'Render output is not ready'});
          const info = await fs.stat(output);
          response.statusCode = 200;
          response.setHeader('content-type', 'video/mp4');
          response.setHeader('content-disposition', `attachment; filename="${path.basename(output)}"`);
          response.setHeader('content-length', info.size);
          return createReadStream(output).pipe(response);
        }
        if (url.pathname.startsWith('/api/jobs/') && request.method === 'GET') {
          const job = getJob(url.pathname.split('/').pop() ?? '');
          return job ? reply(response, 200, job) : reply(response, 404, {error: 'Job not found'});
        }
        return reply(response, 404, {error: 'Unknown endpoint'});
      } catch (error) {
        return reply(response, 500, {error: error instanceof Error ? error.message : String(error)});
      }
  });
};

export const studioApi = ({env = process.env}: StudioApiOptions = {}): Plugin => ({
  name: 'autocubes-studio-api',
  configureServer: (server) => attachStudioApi(server, env),
  configurePreviewServer: (server) => attachStudioApi(server, env),
});
