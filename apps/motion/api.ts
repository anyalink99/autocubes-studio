import {AssetLibrary, EditorProject, JobState, ProjectSummary} from '../../packages/core/editor-project';

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
};

export const listProjects = () => fetch('/api/projects').then((response) => json<ProjectSummary[]>(response));

export const loadProject = (id?: string) => fetch(`/api/project${id ? `?id=${encodeURIComponent(id)}` : ''}`).then((response) => json<EditorProject>(response));

export const createProject = () => fetch('/api/projects', {method: 'POST'}).then((response) => json<EditorProject>(response));

export const saveProject = (project: EditorProject) =>
  fetch(`/api/project?id=${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(project),
  }).then((response) => json<{ok: true}>(response));

export const loadAssets = () => fetch('/api/assets').then((response) => json<AssetLibrary>(response));

export const captureFrame = (project: EditorProject, frameId: string, scrollY: number) =>
  fetch('/api/frame', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({project, frameId, scrollY}),
  }).then((response) => json<{thumbnail: string; pageHeight: number}>(response));

export const startJob = (kind: 'capture' | 'render', projectId: string) =>
  fetch('/api/jobs', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({kind, projectId}),
  }).then((response) => json<JobState>(response));

export const getJob = (id: string) => fetch(`/api/jobs/${id}`).then((response) => json<JobState>(response));
