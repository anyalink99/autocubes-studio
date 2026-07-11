import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {Plugin} from 'vite';
import {EditorProject, JobState} from '../../packages/core/editor-project';
import {getJob, startJob} from './job-manager';
import {capturesDirectory, editorFramesDirectory, workspacePath} from './paths';
import {createProject, listProjects, saveProject} from './project-repository';

const readBody = async <T>(request: NodeJS.ReadableStream): Promise<T> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
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
  const browser = await chromium.launch({headless: true});
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

export const studioApi = (): Plugin => ({
  name: 'autocubes-studio-api',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith('/api/')) return next();
      try {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/api/projects' && request.method === 'GET') {
          const projects = await listProjects();
          return reply(response, 200, projects.map(({id, title, url: projectUrl}) => ({id, title, url: projectUrl})));
        }
        if (url.pathname === '/api/projects' && request.method === 'POST') return reply(response, 200, await createProject());
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
        if (url.pathname === '/api/frame' && request.method === 'POST') {
          const {project, frameId, scrollY} = await readBody<{project: EditorProject; frameId: string; scrollY: number}>(request);
          return reply(response, 200, await captureFrame(project, frameId, scrollY));
        }
        if (url.pathname === '/api/jobs' && request.method === 'POST') {
          const {kind, projectId} = await readBody<{kind: JobState['kind']; projectId: string}>(request);
          if (kind !== 'capture' && kind !== 'render') throw new Error('Invalid job kind');
          return reply(response, 200, await startJob(kind, projectId));
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
  },
});
