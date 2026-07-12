import {OperationsState, createProjectPhases} from '../../packages/core/operations';

const now = new Date().toISOString();
const dateFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const flowlinePhases = createProjectPhases();
flowlinePhases[0].done = true;
flowlinePhases[0].tasks.forEach((task) => { task.done = true; });
flowlinePhases[1].done = true;
flowlinePhases[1].tasks = [{id: 'task-flow-ref', title: 'Утвердить направление showcase', done: true, assignee: 'Стас', dueAt: dateFromNow(-5), priority: 'high'}];
flowlinePhases[2].done = true;
flowlinePhases[2].tasks = [{id: 'task-flow-story', title: 'Собрать сценарий ролика', done: true, assignee: 'Рома', dueAt: dateFromNow(-3), priority: 'medium'}];
flowlinePhases[3].tasks = [
  {id: 'task-flow-cover', title: 'Финализировать обложку карусели', done: true, assignee: 'Стас', dueAt: dateFromNow(-1), priority: 'medium'},
  {id: 'task-flow-timing', title: 'Проверить темп сцен', done: false, assignee: 'Рома', dueAt: dateFromNow(1), priority: 'high'},
];
flowlinePhases[4].tasks = [{id: 'task-flow-mobile', title: 'Проверить мобильное меню', done: false, assignee: 'Стас', dueAt: dateFromNow(2), priority: 'high'}];

export const initialOperationsState: OperationsState = {
  version: 1,
  leads: [
    {
      id: 'lead-northline', company: 'Northline', contact: 'Анна, маркетинг', channel: 'Telegram', stage: 'replied', value: 240000,
      source: 'Рекомендация', nextAction: 'Отправить подборку релевантных кейсов', nextActionAt: dateFromNow(1), tags: ['сайт', 'айдентика'],
      notes: 'Нужен новый сайт к запуску продукта. Решение принимает основатель.', createdAt: now,
      activities: [{id: 'act-north-1', createdAt: now, text: 'Получен ответ, попросили кейсы из b2b', kind: 'email'}],
    },
    {
      id: 'lead-verde', company: 'Verde House', contact: 'Максим', channel: 'Instagram', stage: 'new', value: 160000,
      source: 'Исходящий контакт', nextAction: 'Написать первое сообщение', nextActionAt: dateFromNow(0), tags: ['e-commerce'],
      notes: 'У сайта слабая мобильная версия и нет внятной продуктовой подачи.', createdAt: now, activities: [],
    },
    {
      id: 'lead-sfera', company: 'Sfera Capital', contact: 'Олег', channel: 'WhatsApp', stage: 'proposal', value: 410000,
      source: 'Повторный клиент', nextAction: 'Уточнить решение по КП', nextActionAt: dateFromNow(2), tags: ['разработка', 'crm'],
      notes: 'КП v2 отправлено. Внутреннее согласование до пятницы.', createdAt: now,
      activities: [{id: 'act-sfera-1', createdAt: now, text: 'Отправлено КП v2 на разработку и интеграцию CRM', kind: 'email'}],
    },
    {
      id: 'lead-amavi', company: 'Amavi', contact: 'Елена', channel: 'Telegram', stage: 'meeting', value: 290000,
      source: 'Портфолио', nextAction: 'Подготовить вопросы к созвону', nextActionAt: dateFromNow(1), tags: ['сайт', 'motion'],
      notes: 'Созвон в 15:00, важно показать процесс работы с анимацией.', createdAt: now, activities: [],
    },
  ],
  projects: [
    {
      id: 'project-flowline', title: 'Flowline showcase', client: 'Flowline', stage: 'design', status: 'active', health: 'good', progress: 58,
      owner: 'Стас', deadline: dateFromNow(6), budget: 185000, description: 'Сайт, motion-showcase и social pack для обновлённого продукта.',
      phases: flowlinePhases,
      deliverables: [
        {id: 'del-flow-site', title: 'Главная страница', url: 'https://portfolio.autocubes.site/flowline', type: 'site', status: 'review', version: 3, updatedAt: now},
        {id: 'del-flow-motion', title: 'Showcase Reel', url: '/editor.html?project=flowline', type: 'motion', status: 'draft', version: 2, updatedAt: now},
      ],
      activity: [
        {id: 'act-flow-1', createdAt: now, text: 'Клиент оставил 2 комментария к главной', kind: 'review'},
        {id: 'act-flow-2', createdAt: now, text: 'Обновлён motion-сценарий', kind: 'status'},
      ], createdAt: now,
    },
    {
      id: 'project-amavi', title: 'Amavi digital', client: 'Amavi', stage: 'prototype', status: 'active', health: 'attention', progress: 31,
      owner: 'Рома', deadline: dateFromNow(12), budget: 290000, description: 'Цифровая платформа и система контента для нового направления.',
      phases: createProjectPhases(), deliverables: [], activity: [], createdAt: now,
    },
    {
      id: 'project-autocubes', title: 'Autocubes studio', client: 'Autocubes', stage: 'development', status: 'active', health: 'good', progress: 64,
      owner: 'Стас', deadline: dateFromNow(18), budget: 0, description: 'Внутренняя операционная система и инструменты производства.',
      phases: createProjectPhases(), deliverables: [], activity: [], createdAt: now,
    },
  ],
  reviews: [
    {
      id: 'review-flow-home', projectId: 'project-flowline', title: 'Главная страница — desktop', description: 'Проверяем структуру, тексты и финальный CTA.',
      url: 'https://portfolio.autocubes.site/flowline', preview: '/editor-frames/flowline/page-analysis.png', version: 3, status: 'review', updatedAt: now,
      comments: [
        {id: 'comment-1', author: 'Анна', text: 'Здесь нужен более конкретный результат для клиента.', createdAt: now, resolved: false, x: 39, y: 24},
        {id: 'comment-2', author: 'Рома', text: 'Проверить контраст подписи на мобильном.', createdAt: now, resolved: true, x: 67, y: 71},
      ],
    },
    {
      id: 'review-flow-reel', projectId: 'project-flowline', title: 'Showcase Reel', description: 'Темп, курсор и финальный экран.',
      url: '/editor.html?project=flowline', preview: '/captures/flowline/stills/10-final.png', version: 2, status: 'changes', updatedAt: now,
      comments: [{id: 'comment-3', author: 'Стас', text: 'Ускорить переход между вторым и третьим экраном.', createdAt: now, resolved: false, x: 50, y: 48}],
    },
  ],
  library: [
    {
      id: 'lib-editorial-grid', title: 'Editorial service grid', description: 'Плотная сетка услуг с крупной типографикой и спокойным hover.',
      url: 'https://portfolio.autocubes.site/flowline', preview: '/captures/flowline/stills/05-section-a-hover.png', category: 'section',
      technology: ['CSS Grid', 'React'], tags: ['services', 'editorial', 'dark'], code: '.service-grid { display: grid; grid-template-columns: repeat(12, 1fr); }',
      license: 'Внутренний компонент', favorite: true, projects: ['project-flowline'], createdAt: now,
    },
    {
      id: 'lib-cursor', title: 'Magnetic cursor focus', description: 'Курсор мягко притягивается к интерактивной цели и раскрывает подпись.',
      url: '/editor.html?project=flowline', preview: '/captures/flowline/stills/09-real-click.png', category: 'animation',
      technology: ['Motion', 'Pointer events'], tags: ['cursor', 'microinteraction'], code: 'const x = mix(pointer.x, target.x, 0.18);',
      license: 'Внутренний компонент', favorite: true, projects: ['project-flowline'], createdAt: now,
    },
    {
      id: 'lib-identity-card', title: 'Process card 4:5', description: 'Процесс из четырёх этапов для Instagram-карусели.',
      url: '/apps/identity/identity-lab.html', preview: '/apps/identity/autocubes-cover.png', category: 'identity',
      technology: ['HTML', 'Identity Lab'], tags: ['instagram', 'process', '4:5'], code: '', license: 'Autocubes', favorite: false, projects: ['project-autocubes'], createdAt: now,
    },
  ],
};

export const storageKey = 'autocubes-operations-v1';

export const loadOperationsState = (): OperationsState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null') as OperationsState | null;
    return parsed?.version === 1 ? parsed : initialOperationsState;
  } catch {
    return initialOperationsState;
  }
};
