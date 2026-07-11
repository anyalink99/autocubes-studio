import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {JobState} from '../../packages/core/editor-project';
import {generatedProjectFile, outputDirectory, projectFile, workspacePath} from './paths';

const jobs = new Map<string, JobState>();

export const getJob = (id: string) => jobs.get(id);

export const startJob = async (kind: JobState['kind'], projectId: string) => {
  const id = `${kind}-${Date.now()}`;
  const job: JobState = {id, kind, status: 'running', log: []};
  jobs.set(id, job);

  if (kind === 'render') await fs.copyFile(projectFile(projectId), generatedProjectFile);
  const args = kind === 'capture'
    ? [workspacePath('node_modules/tsx/dist/cli.mjs'), 'tooling/capture/run-editor-project.ts', projectFile(projectId)]
    : [
        workspacePath('node_modules/@remotion/cli/remotion-cli.js'),
        'render',
        'packages/video/index.ts',
        'EditorReel',
        `${outputDirectory}/${projectId}-reel.mp4`,
        '--codec=h264',
        '--pixel-format=yuv420p',
      ];
  const child = spawn(process.execPath, args, {cwd: process.cwd(), shell: false});
  const addLog = (chunk: Buffer) => {
    job.log.push(...chunk.toString().split(/\r?\n/).filter(Boolean));
    job.log = job.log.slice(-160);
  };
  child.stdout.on('data', addLog);
  child.stderr.on('data', addLog);
  child.on('error', (error) => {
    job.log.push(error.message);
    job.status = 'failed';
  });
  child.on('close', (code) => {
    job.status = code === 0 ? 'complete' : 'failed';
  });
  return job;
};
