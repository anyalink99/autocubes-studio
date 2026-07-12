import path from 'node:path';

export const workspacePath = (...segments: string[]) => path.resolve(...segments);
export const projectsDirectory = workspacePath('data/projects');
export const generatedProjectFile = workspacePath('data/generated/editor-project.json');
export const capturesDirectory = workspacePath('public/captures');
export const editorFramesDirectory = workspacePath('public/editor-frames');
export const outputDirectory = workspacePath('out');

export const projectFile = (id: string) => {
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(id)) throw new Error('Invalid project id');
  return path.join(projectsDirectory, `${id}.editor.json`);
};
