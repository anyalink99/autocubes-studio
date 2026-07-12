export type LeadStage = 'new' | 'contacted' | 'replied' | 'meeting' | 'proposal' | 'won' | 'lost';
export type ProjectStage = 'brief' | 'references' | 'prototype' | 'design' | 'development' | 'content' | 'revision' | 'launch' | 'support';
export type Priority = 'low' | 'medium' | 'high';
export type ReviewStatus = 'draft' | 'review' | 'changes' | 'approved';

export type Activity = {
  id: string;
  createdAt: string;
  text: string;
  kind: 'note' | 'call' | 'email' | 'status' | 'task' | 'review';
};

export type Lead = {
  id: string;
  company: string;
  contact: string;
  channel: string;
  stage: LeadStage;
  value: number;
  source: string;
  nextAction: string;
  nextActionAt: string;
  tags: string[];
  notes: string;
  activities: Activity[];
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  done: boolean;
  assignee: string;
  dueAt: string;
  priority: Priority;
};

export type ProjectPhase = {
  id: ProjectStage;
  title: string;
  done: boolean;
  tasks: Task[];
};

export type Deliverable = {
  id: string;
  title: string;
  url: string;
  type: 'site' | 'identity' | 'motion' | 'document' | 'other';
  status: ReviewStatus;
  version: number;
  updatedAt: string;
};

export type StudioProject = {
  id: string;
  title: string;
  client: string;
  stage: ProjectStage;
  status: 'active' | 'paused' | 'completed';
  health: 'good' | 'attention' | 'risk';
  progress: number;
  owner: string;
  deadline: string;
  budget: number;
  description: string;
  phases: ProjectPhase[];
  deliverables: Deliverable[];
  activity: Activity[];
  createdAt: string;
};

export type ReviewComment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  resolved: boolean;
  x?: number;
  y?: number;
};

export type ReviewItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  url: string;
  preview: string;
  version: number;
  status: ReviewStatus;
  comments: ReviewComment[];
  updatedAt: string;
};

export type LibraryItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  preview: string;
  category: 'site' | 'section' | 'animation' | 'component' | 'identity' | 'form' | '3d';
  technology: string[];
  tags: string[];
  code: string;
  license: string;
  favorite: boolean;
  projects: string[];
  createdAt: string;
};

export type OperationsState = {
  version: 1;
  leads: Lead[];
  projects: StudioProject[];
  reviews: ReviewItem[];
  library: LibraryItem[];
};

export const leadStages: Array<{id: LeadStage; title: string}> = [
  {id: 'new', title: 'Новые'},
  {id: 'contacted', title: 'Связались'},
  {id: 'replied', title: 'Ответили'},
  {id: 'meeting', title: 'Созвон'},
  {id: 'proposal', title: 'КП'},
  {id: 'won', title: 'В работе'},
  {id: 'lost', title: 'Отказ'},
];

export const projectStages: Array<{id: ProjectStage; title: string}> = [
  {id: 'brief', title: 'Бриф'},
  {id: 'references', title: 'Референсы'},
  {id: 'prototype', title: 'Прототип'},
  {id: 'design', title: 'Дизайн'},
  {id: 'development', title: 'Разработка'},
  {id: 'content', title: 'Контент'},
  {id: 'revision', title: 'Правки'},
  {id: 'launch', title: 'Запуск'},
  {id: 'support', title: 'Поддержка'},
];

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const today = () => new Date().toISOString().slice(0, 10);

export const createProjectPhases = (): ProjectPhase[] => projectStages.map((stage, index) => ({
  id: stage.id,
  title: stage.title,
  done: false,
  tasks: index === 0 ? [
    {id: uid('task'), title: 'Получить материалы и доступы', done: false, assignee: 'Стас', dueAt: today(), priority: 'high'},
    {id: uid('task'), title: 'Зафиксировать задачу и критерии успеха', done: false, assignee: 'Рома', dueAt: today(), priority: 'medium'},
  ] : [],
}));

export const calculateProgress = (project: StudioProject) => {
  const all = project.phases.flatMap((phase) => phase.tasks);
  if (!all.length) return project.progress;
  return Math.round((all.filter((task) => task.done).length / all.length) * 100);
};
