import fs from 'node:fs/promises';
import path from 'node:path';
import {EditorProject} from '../../packages/core/editor-project';
import {migrateEditorProject} from '../../packages/core/editor-operations';
import {generatedProjectFile, projectFile, projectsDirectory} from './paths';

const createEmptyProject = (): EditorProject => ({
  version: 3,
  id: `project-${Date.now()}`,
  title: 'Untitled project',
  url: 'https://example.com',
  fps: 30,
  duration: 15,
  viewport: {width: 1080, height: 1920},
  guides: true,
  snap: true,
  pageHeight: 1920,
  frames: [{id: 'frame-hero', label: 'Hero', at: 0, scrollY: 0, duration: 1, hold: 2, easing: 'easeInOut'}],
  pointer: [],
  transitions: [],
  captions: [],
  audio: [],
  overlays: [],
  markers: [],
});

export const listProjects = async (): Promise<EditorProject[]> => {
  await fs.mkdir(projectsDirectory, {recursive: true});
  const files = (await fs.readdir(projectsDirectory)).filter((file) => file.endsWith('.editor.json'));
  const projects = await Promise.all(
    files.map(async (file) => {
      const project = JSON.parse(await fs.readFile(path.join(projectsDirectory, file), 'utf8')) as EditorProject;
      return migrateEditorProject(project);
    }),
  );
  return projects.sort((a, b) => a.title.localeCompare(b.title));
};

export const createProject = async (source?: EditorProject) => {
  const project = source ? {
    ...structuredClone(source),
    version: 3,
    id: `project-${Date.now()}`,
    title: `${source.title} copy`,
    captions: source.captions ?? [],
    guides: source.guides ?? true,
    snap: source.snap ?? true,
    overlays: source.overlays ?? [],
    markers: source.markers ?? [],
  } : createEmptyProject();
  await saveProject(project, false);
  return project;
};

export const saveProject = async (project: EditorProject, updateGenerated = true) => {
  if (!project.id || !project.title || !project.url) throw new Error('Project is missing required fields');
  const serialized = `${JSON.stringify(project, null, 2)}\n`;
  await fs.mkdir(projectsDirectory, {recursive: true});
  await fs.writeFile(projectFile(project.id), serialized, 'utf8');
  if (updateGenerated) {
    await fs.mkdir(path.dirname(generatedProjectFile), {recursive: true});
    await fs.writeFile(generatedProjectFile, serialized, 'utf8');
  }
};

export const deleteProject = async (id: string) => {
  const projects = await listProjects();
  if (projects.length <= 1) throw new Error('Keep at least one Motion Desk project');
  await fs.unlink(projectFile(id));
};
