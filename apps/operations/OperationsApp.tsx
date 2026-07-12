import React, {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookMarked, BriefcaseBusiness, CalendarDays, Check, CheckCircle2,
  ChevronDown, CircleAlert, CircleDot, ClipboardCheck, Clock3, Code2, Copy, Download, ExternalLink, Eye,
  Filter, FolderKanban, Heart, LayoutDashboard, Library, Link2, ListChecks, MessageSquare, MoreHorizontal,
  Plus, Search, Send, Settings2, Sparkles, Trash2, Upload, UserRound, UsersRound, X,
} from 'lucide-react';
import {
  Activity, calculateProgress, Lead, LeadStage, LibraryItem, leadStages, OperationsState, projectStages,
  ReviewItem, ReviewStatus, StudioProject, Task, uid, today,
} from '../../packages/core/operations';
import {initialOperationsState, loadOperationsState, storageKey} from './data';

type View = 'overview' | 'crm' | 'projects' | 'reviews' | 'library';

const money = (value: number) => value ? new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0}).format(value) : 'Внутренний';
const shortDate = (value: string) => value ? new Intl.DateTimeFormat('ru-RU', {day: '2-digit', month: 'short'}).format(new Date(`${value}T12:00:00`)) : 'Без срока';
const relativeDate = (value: string) => {
  const diff = Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `Просрочено ${Math.abs(diff)} д.`;
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  return `Через ${diff} д.`;
};
const reviewLabels: Record<ReviewStatus, string> = {draft: 'Черновик', review: 'На проверке', changes: 'Нужны правки', approved: 'Согласовано'};

const useOperations = () => {
  const [state, setState] = useState<OperationsState>(loadOperationsState);
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(state)), [state]);
  return [state, setState] as const;
};

const IconButton = ({label, children, onClick}: {label: string; children: React.ReactNode; onClick?: () => void}) => (
  <button className="ops-icon-button" title={label} aria-label={label} onClick={onClick}>{children}</button>
);

const Empty = ({title, text, action}: {title: string; text: string; action?: React.ReactNode}) => (
  <div className="ops-empty"><CircleDot size={28}/><strong>{title}</strong><p>{text}</p>{action}</div>
);

const Modal = ({title, eyebrow, children, onClose}: {title: string; eyebrow: string; children: React.ReactNode; onClose: () => void}) => (
  <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="ops-modal" role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span>{eyebrow}</span><h2>{title}</h2></div><IconButton label="Закрыть" onClick={onClose}><X size={18}/></IconButton></header>
      {children}
    </section>
  </div>
);

const Header = ({view, title, description, action}: {view: string; title: string; description: string; action?: React.ReactNode}) => (
  <header className="ops-page-header">
    <div><span className="ops-eyebrow">{view}</span><h1>{title}</h1><p>{description}</p></div>
    {action && <div className="ops-header-action">{action}</div>}
  </header>
);

const Overview = ({state, openView}: {state: OperationsState; openView: (view: View) => void}) => {
  const tasks = state.projects.flatMap((project) => project.phases.flatMap((phase) => phase.tasks.map((task) => ({...task, project: project.title}))));
  const upcoming = tasks.filter((task) => !task.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 6);
  const activeValue = state.leads.filter((lead) => !['lost', 'won'].includes(lead.stage)).reduce((sum, lead) => sum + lead.value, 0);
  const unresolved = state.reviews.reduce((sum, item) => sum + item.comments.filter((comment) => !comment.resolved).length, 0);
  return <>
    <Header view="Сегодня в студии" title="Работа без потерянного контекста" description="Лиды, проекты, согласования и рабочие находки связаны в одном пространстве."/>
    <section className="ops-stat-grid">
      <button onClick={() => openView('crm')}><span>Активный пайплайн</span><strong>{money(activeValue)}</strong><small>{state.leads.filter((lead) => !['lost', 'won'].includes(lead.stage)).length} потенциальных проектов <ArrowUpRight size={13}/></small></button>
      <button onClick={() => openView('projects')}><span>Проекты в работе</span><strong>{String(state.projects.filter((project) => project.status === 'active').length).padStart(2, '0')}</strong><small>{state.projects.filter((project) => project.health !== 'good').length} требуют внимания <ArrowUpRight size={13}/></small></button>
      <button onClick={() => openView('reviews')}><span>Открытые комментарии</span><strong>{String(unresolved).padStart(2, '0')}</strong><small>{state.reviews.filter((review) => review.status === 'review').length} материалов на проверке <ArrowUpRight size={13}/></small></button>
      <button onClick={() => openView('library')}><span>Библиотека</span><strong>{String(state.library.length).padStart(2, '0')}</strong><small>{state.library.filter((item) => item.favorite).length} избранных решений <ArrowUpRight size={13}/></small></button>
    </section>
    <section className="ops-overview-grid">
      <div className="ops-panel ops-focus-panel">
        <div className="ops-panel-heading"><div><span className="ops-eyebrow">Фокус</span><h2>Следующие действия</h2></div><button onClick={() => openView('projects')}>Все задачи <ArrowRight size={14}/></button></div>
        <div className="ops-task-list">
          {upcoming.map((task) => <div className="ops-task-row" key={task.id}><span className={`ops-priority ${task.priority}`}/><div><strong>{task.title}</strong><small>{task.project} · {task.assignee}</small></div><time className={new Date(task.dueAt) < new Date(today()) ? 'overdue' : ''}>{relativeDate(task.dueAt)}</time></div>)}
          {!upcoming.length && <Empty title="На сегодня всё" text="Новых задач со сроком пока нет."/>}
        </div>
      </div>
      <div className="ops-panel ops-pulse-panel">
        <div className="ops-panel-heading"><div><span className="ops-eyebrow">Пульс</span><h2>Проекты</h2></div></div>
        {state.projects.filter((project) => project.status === 'active').slice(0, 4).map((project) => <button className="ops-project-pulse" key={project.id} onClick={() => openView('projects')}>
          <span className={`ops-health ${project.health}`}/><div><strong>{project.title}</strong><small>{project.client} · {projectStages.find((stage) => stage.id === project.stage)?.title}</small></div><div className="ops-progress"><i style={{width: `${calculateProgress(project)}%`}}/></div><b>{calculateProgress(project)}%</b>
        </button>)}
      </div>
    </section>
    <section className="ops-panel ops-next-actions">
      <div className="ops-panel-heading"><div><span className="ops-eyebrow">Продажи</span><h2>Кому нужно ответить</h2></div><button onClick={() => openView('crm')}>Открыть CRM <ArrowRight size={14}/></button></div>
      <div className="ops-action-strip">
        {state.leads.filter((lead) => lead.nextAction).sort((a, b) => a.nextActionAt.localeCompare(b.nextActionAt)).slice(0, 4).map((lead) => <button key={lead.id} onClick={() => openView('crm')}><span>{shortDate(lead.nextActionAt)}</span><strong>{lead.company}</strong><p>{lead.nextAction}</p><small>{lead.channel} · {money(lead.value)}</small></button>)}
      </div>
    </section>
  </>;
};

const LeadForm = ({onSave, onClose}: {onSave: (lead: Lead) => void; onClose: () => void}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lead: Lead = {
      id: uid('lead'), company: String(form.get('company')), contact: String(form.get('contact')), channel: String(form.get('channel')),
      source: String(form.get('source')), stage: 'new', value: Number(form.get('value')) || 0, nextAction: String(form.get('nextAction')),
      nextActionAt: String(form.get('nextActionAt')), tags: String(form.get('tags')).split(',').map((tag) => tag.trim()).filter(Boolean),
      notes: String(form.get('notes')), activities: [], createdAt: new Date().toISOString(),
    };
    onSave(lead);
  };
  return <Modal title="Новый контакт" eyebrow="CRM" onClose={onClose}><form className="ops-form" onSubmit={submit}>
    <label className="wide"><span>Компания *</span><input name="company" required autoFocus placeholder="Название компании"/></label>
    <label><span>Контакт</span><input name="contact" placeholder="Имя и роль"/></label><label><span>Канал</span><select name="channel"><option>Telegram</option><option>Instagram</option><option>WhatsApp</option><option>Email</option><option>Сайт</option></select></label>
    <label><span>Источник</span><input name="source" placeholder="Рекомендация, исходящий..."/></label><label><span>Потенциал, ₽</span><input name="value" type="number" min="0" placeholder="200000"/></label>
    <label className="wide"><span>Следующее действие</span><input name="nextAction" placeholder="Отправить кейсы"/></label><label><span>Когда</span><input name="nextActionAt" type="date" defaultValue={today()}/></label><label><span>Теги через запятую</span><input name="tags" placeholder="сайт, айдентика"/></label>
    <label className="wide"><span>Контекст</span><textarea name="notes" rows={4} placeholder="Что важно не потерять после разговора"/></label>
    <footer><button type="button" className="ops-button ghost" onClick={onClose}>Отмена</button><button className="ops-button primary"><Plus size={15}/>Добавить контакт</button></footer>
  </form></Modal>;
};

const LeadDrawer = ({lead, update, convert, close}: {lead: Lead; update: (lead: Lead) => void; convert: () => void; close: () => void}) => {
  const [note, setNote] = useState('');
  const addActivity = () => {
    if (!note.trim()) return;
    update({...lead, activities: [{id: uid('activity'), text: note.trim(), kind: 'note', createdAt: new Date().toISOString()}, ...lead.activities]});
    setNote('');
  };
  return <div className="ops-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><aside className="ops-drawer">
    <header><span className="ops-eyebrow">Карточка контакта</span><IconButton label="Закрыть" onClick={close}><X size={18}/></IconButton><h2>{lead.company}</h2><p>{lead.contact || 'Контакт не указан'} · {lead.channel}</p></header>
    <div className="ops-drawer-stage"><label><span>Этап</span><select value={lead.stage} onChange={(event) => update({...lead, stage: event.target.value as LeadStage})}>{leadStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.title}</option>)}</select></label><div><span>Потенциал</span><strong>{money(lead.value)}</strong></div></div>
    <section><h3>Следующий шаг</h3><input value={lead.nextAction} onChange={(event) => update({...lead, nextAction: event.target.value})}/><input type="date" value={lead.nextActionAt} onChange={(event) => update({...lead, nextActionAt: event.target.value})}/></section>
    <section><h3>Контекст</h3><textarea rows={5} value={lead.notes} onChange={(event) => update({...lead, notes: event.target.value})}/><div className="ops-tags">{lead.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>
    <section className="ops-activity"><h3>История</h3><div className="ops-note-input"><input value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addActivity()} placeholder="Добавить заметку..."/><button onClick={addActivity}><Send size={15}/></button></div>{lead.activities.map((activity) => <div className="ops-activity-row" key={activity.id}><i/><div><p>{activity.text}</p><time>{new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(activity.createdAt))}</time></div></div>)}</section>
    <footer><button className="ops-button primary" onClick={convert}><BriefcaseBusiness size={15}/>Создать проект</button></footer>
  </aside></div>;
};

const CRM = ({state, setState}: {state: OperationsState; setState: React.Dispatch<React.SetStateAction<OperationsState>>}) => {
  const [creating, setCreating] = useState(false); const [selectedId, setSelectedId] = useState<string>(); const [query, setQuery] = useState('');
  const selected = state.leads.find((lead) => lead.id === selectedId);
  const visible = state.leads.filter((lead) => `${lead.company} ${lead.contact} ${lead.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const updateLead = (next: Lead) => setState((current) => ({...current, leads: current.leads.map((lead) => lead.id === next.id ? next : lead)}));
  const convert = (lead: Lead) => {
    const project: StudioProject = {id: uid('project'), title: lead.company, client: lead.company, stage: 'brief', status: 'active', health: 'good', progress: 0, owner: 'Стас', deadline: '', budget: lead.value, description: lead.notes, phases: projectStages.map((phase, index) => ({...phase, done: false, tasks: index ? [] : [{id: uid('task'), title: 'Провести стартовый созвон', done: false, assignee: 'Стас', dueAt: lead.nextActionAt || today(), priority: 'high'}]})), deliverables: [], activity: [{id: uid('activity'), text: 'Проект создан из CRM', createdAt: new Date().toISOString(), kind: 'status'}], createdAt: new Date().toISOString()};
    setState((current) => ({...current, projects: [project, ...current.projects], leads: current.leads.map((item) => item.id === lead.id ? {...item, stage: 'won'} : item)})); setSelectedId(undefined);
  };
  return <>
    <Header view="Продажи" title="CRM" description="Следующий шаг важнее длинной истории. Каждый контакт должен двигаться или закрываться." action={<button className="ops-button primary" onClick={() => setCreating(true)}><Plus size={15}/>Новый контакт</button>}/>
    <div className="ops-toolbar"><label className="ops-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Компания, контакт или тег"/></label><span>{visible.length} контактов · {money(visible.reduce((sum, lead) => sum + lead.value, 0))}</span></div>
    <section className="ops-pipeline">
      {leadStages.map((stage) => { const leads = visible.filter((lead) => lead.stage === stage.id); return <div className={`ops-pipeline-column stage-${stage.id}`} key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {const id = event.dataTransfer.getData('text/lead-id'); setState((current) => ({...current, leads: current.leads.map((lead) => lead.id === id ? {...lead, stage: stage.id} : lead)}));}}>
        <header><span>{stage.title}</span><b>{leads.length}</b></header><div className="ops-lead-stack">{leads.map((lead) => <button draggable onDragStart={(event) => event.dataTransfer.setData('text/lead-id', lead.id)} className="ops-lead-card" key={lead.id} onClick={() => setSelectedId(lead.id)}><div><strong>{lead.company}</strong><MoreHorizontal size={16}/></div><p>{lead.nextAction || 'Добавьте следующий шаг'}</p><span className={lead.nextActionAt && new Date(lead.nextActionAt) < new Date(today()) ? 'overdue' : ''}><Clock3 size={12}/>{lead.nextActionAt ? relativeDate(lead.nextActionAt) : 'Без срока'}</span><footer><b>{money(lead.value)}</b><small>{lead.channel}</small></footer></button>)}</div>
      </div>;})}
    </section>
    {creating && <LeadForm onClose={() => setCreating(false)} onSave={(lead) => {setState((current) => ({...current, leads: [lead, ...current.leads]})); setCreating(false);}}/>}
    {selected && <LeadDrawer lead={selected} update={updateLead} convert={() => convert(selected)} close={() => setSelectedId(undefined)}/>} 
  </>;
};

const ProjectForm = ({onSave, onClose}: {onSave: (project: StudioProject) => void; onClose: () => void}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {event.preventDefault(); const form = new FormData(event.currentTarget); onSave({id: uid('project'), title: String(form.get('title')), client: String(form.get('client')), stage: 'brief', status: 'active', health: 'good', progress: 0, owner: String(form.get('owner')), deadline: String(form.get('deadline')), budget: Number(form.get('budget')) || 0, description: String(form.get('description')), phases: projectStages.map((phase) => ({...phase, done: false, tasks: []})), deliverables: [], activity: [], createdAt: new Date().toISOString()});};
  return <Modal title="Новый проект" eyebrow="Project OS" onClose={onClose}><form className="ops-form" onSubmit={submit}><label className="wide"><span>Название *</span><input name="title" required autoFocus placeholder="Название проекта"/></label><label><span>Клиент</span><input name="client"/></label><label><span>Владелец</span><input name="owner" defaultValue="Стас"/></label><label><span>Дедлайн</span><input name="deadline" type="date"/></label><label><span>Бюджет, ₽</span><input name="budget" type="number"/></label><label className="wide"><span>Задача проекта</span><textarea name="description" rows={4}/></label><footer><button type="button" className="ops-button ghost" onClick={onClose}>Отмена</button><button className="ops-button primary"><Plus size={15}/>Создать проект</button></footer></form></Modal>;
};

const ProjectWorkspace = ({project, update, close}: {project: StudioProject; update: (project: StudioProject) => void; close: () => void}) => {
  const [phaseId, setPhaseId] = useState(project.stage); const [taskTitle, setTaskTitle] = useState('');
  const phase = project.phases.find((item) => item.id === phaseId) || project.phases[0];
  const updateTask = (task: Task) => update({...project, phases: project.phases.map((item) => item.id === phase.id ? {...item, tasks: item.tasks.map((entry) => entry.id === task.id ? task : entry)} : item)});
  const addTask = () => {if (!taskTitle.trim()) return; update({...project, phases: project.phases.map((item) => item.id === phase.id ? {...item, tasks: [...item.tasks, {id: uid('task'), title: taskTitle.trim(), done: false, assignee: project.owner, dueAt: project.deadline || today(), priority: 'medium'}]} : item)}); setTaskTitle('');};
  return <div className="ops-workspace">
    <header className="ops-workspace-header"><button onClick={close}><ArrowLeft size={16}/>Все проекты</button><div className="ops-workspace-actions"><a className="ops-button ghost" href={`/?review=${project.id}`} target="_blank"><Eye size={15}/>Клиентский вид</a><IconButton label="Настройки"><Settings2 size={17}/></IconButton></div></header>
    <section className="ops-project-hero"><div><span className="ops-eyebrow">{project.client}</span><h1>{project.title}</h1><p>{project.description}</p></div><div className="ops-project-facts"><div><span>Владелец</span><strong>{project.owner}</strong></div><div><span>Дедлайн</span><strong>{shortDate(project.deadline)}</strong></div><div><span>Бюджет</span><strong>{money(project.budget)}</strong></div><div><span>Готовность</span><strong>{calculateProgress(project)}%</strong></div></div></section>
    <nav className="ops-phase-rail" aria-label="Этапы проекта">{project.phases.map((item, index) => <button className={`${item.id === phase.id ? 'active' : ''} ${item.done ? 'done' : ''}`} key={item.id} onClick={() => setPhaseId(item.id)}><i>{item.done ? <Check size={12}/> : String(index + 1).padStart(2, '0')}</i><span>{item.title}</span><small>{item.tasks.filter((task) => task.done).length}/{item.tasks.length}</small></button>)}</nav>
    <div className="ops-project-columns">
      <section className="ops-panel ops-phase-work"><div className="ops-panel-heading"><div><span className="ops-eyebrow">Текущий этап</span><h2>{phase.title}</h2></div><button onClick={() => update({...project, stage: phase.id, phases: project.phases.map((item) => item.id === phase.id ? {...item, done: !item.done} : item)})}>{phase.done ? 'Вернуть в работу' : 'Завершить этап'} <CheckCircle2 size={14}/></button></div>
        <div className="ops-project-task-list">{phase.tasks.map((task) => <div className={`ops-project-task ${task.done ? 'done' : ''}`} key={task.id}><button onClick={() => updateTask({...task, done: !task.done})}>{task.done ? <Check size={14}/> : null}</button><input value={task.title} onChange={(event) => updateTask({...task, title: event.target.value})}/><select value={task.assignee} onChange={(event) => updateTask({...task, assignee: event.target.value})}><option>Стас</option><option>Рома</option><option>Команда</option></select><input type="date" value={task.dueAt} onChange={(event) => updateTask({...task, dueAt: event.target.value})}/><select value={task.priority} onChange={(event) => updateTask({...task, priority: event.target.value as Task['priority']})}><option value="low">Низкий</option><option value="medium">Средний</option><option value="high">Высокий</option></select><IconButton label="Удалить" onClick={() => update({...project, phases: project.phases.map((item) => item.id === phase.id ? {...item, tasks: item.tasks.filter((entry) => entry.id !== task.id)} : item)})}><Trash2 size={14}/></IconButton></div>)}</div>
        <div className="ops-add-task"><Plus size={15}/><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTask()} placeholder="Добавить задачу на этот этап"/><button onClick={addTask}>Добавить</button></div>
      </section>
      <aside className="ops-project-side"><section className="ops-panel"><div className="ops-panel-heading"><div><span className="ops-eyebrow">Материалы</span><h2>Результаты</h2></div><a href="/?view=reviews"><Plus size={14}/></a></div>{project.deliverables.map((item) => <a className="ops-deliverable" href={item.url} key={item.id}><span><Link2 size={15}/></span><div><strong>{item.title}</strong><small>v{item.version} · {reviewLabels[item.status]}</small></div><ArrowUpRight size={14}/></a>)}{!project.deliverables.length && <p className="ops-small-empty">Ссылки на макеты, документы и сборки появятся здесь.</p>}</section>
      <section className="ops-panel"><div className="ops-panel-heading"><div><span className="ops-eyebrow">Журнал</span><h2>Последние события</h2></div></div>{project.activity.map((item) => <div className="ops-mini-activity" key={item.id}><i/><p>{item.text}</p></div>)}{!project.activity.length && <p className="ops-small-empty">История проекта пока пуста.</p>}</section></aside>
    </div>
  </div>;
};

const Projects = ({state, setState}: {state: OperationsState; setState: React.Dispatch<React.SetStateAction<OperationsState>>}) => {
  const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<string>(); const [mode, setMode] = useState<'cards'|'board'>('cards');
  const project = state.projects.find((item) => item.id === selected);
  const update = (next: StudioProject) => setState((current) => ({...current, projects: current.projects.map((item) => item.id === next.id ? next : item)}));
  if (project) return <ProjectWorkspace project={project} update={update} close={() => setSelected(undefined)}/>;
  return <>
    <Header view="Производство" title="Проекты" description="Понятный маршрут от брифа до запуска, ответственные и результаты каждого этапа." action={<button className="ops-button primary" onClick={() => setCreating(true)}><Plus size={15}/>Новый проект</button>}/>
    <div className="ops-toolbar"><div className="ops-segment"><button className={mode === 'cards' ? 'active' : ''} onClick={() => setMode('cards')}><LayoutDashboard size={14}/>Обзор</button><button className={mode === 'board' ? 'active' : ''} onClick={() => setMode('board')}><FolderKanban size={14}/>По этапам</button></div><span>{state.projects.filter((item) => item.status === 'active').length} активных · {state.projects.filter((item) => item.health !== 'good').length} требуют внимания</span></div>
    {mode === 'cards' ? <section className="ops-project-grid">{state.projects.map((item) => <button className="ops-project-card" key={item.id} onClick={() => setSelected(item.id)}><header><span className={`ops-health ${item.health}`}/><span>{item.client}</span><ArrowUpRight size={16}/></header><h2>{item.title}</h2><p>{item.description}</p><div className="ops-project-meta"><span><UserRound size={13}/>{item.owner}</span><span><CalendarDays size={13}/>{shortDate(item.deadline)}</span></div><div className="ops-card-progress"><div><i style={{width: `${calculateProgress(item)}%`}}/></div><b>{calculateProgress(item)}%</b></div><footer><span>{projectStages.find((stage) => stage.id === item.stage)?.title}</span><strong>{money(item.budget)}</strong></footer></button>)}</section> : <section className="ops-project-board">{projectStages.map((stage) => <div key={stage.id}><header><span>{stage.title}</span><b>{state.projects.filter((item) => item.stage === stage.id).length}</b></header>{state.projects.filter((item) => item.stage === stage.id).map((item) => <button key={item.id} onClick={() => setSelected(item.id)}><strong>{item.title}</strong><small>{item.owner} · {shortDate(item.deadline)}</small><div><i style={{width: `${calculateProgress(item)}%`}}/></div></button>)}</div>)}</section>}
    {creating && <ProjectForm onClose={() => setCreating(false)} onSave={(item) => {setState((current) => ({...current, projects: [item, ...current.projects]})); setCreating(false); setSelected(item.id);}}/>}
  </>;
};

const ReviewForm = ({projects, onSave, onClose}: {projects: StudioProject[]; onSave: (item: ReviewItem) => void; onClose: () => void}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {event.preventDefault(); const form = new FormData(event.currentTarget); onSave({id: uid('review'), projectId: String(form.get('projectId')), title: String(form.get('title')), description: String(form.get('description')), url: String(form.get('url')), preview: String(form.get('preview')), version: 1, status: 'draft', comments: [], updatedAt: new Date().toISOString()});};
  return <Modal title="Добавить материал" eyebrow="Согласование" onClose={onClose}><form className="ops-form" onSubmit={submit}><label className="wide"><span>Название *</span><input name="title" required autoFocus/></label><label><span>Проект</span><select name="projectId">{projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label><label><span>Ссылка на работу</span><input name="url" placeholder="https://..."/></label><label className="wide"><span>Превью</span><input name="preview" placeholder="URL изображения или локальный путь"/></label><label className="wide"><span>Что проверяем</span><textarea name="description" rows={3}/></label><footer><button type="button" className="ops-button ghost" onClick={onClose}>Отмена</button><button className="ops-button primary"><Plus size={15}/>Добавить</button></footer></form></Modal>;
};

const ReviewWorkspace = ({item, project, update, close}: {item: ReviewItem; project?: StudioProject; update: (item: ReviewItem) => void; close: () => void}) => {
  const [comment, setComment] = useState(''); const [pin, setPin] = useState<{x:number;y:number}>();
  const previewRef = useRef<HTMLDivElement>(null);
  const addComment = () => {if (!comment.trim()) return; update({...item, comments: [...item.comments, {id: uid('comment'), author: 'Стас', text: comment.trim(), createdAt: new Date().toISOString(), resolved: false, x: pin?.x, y: pin?.y}], updatedAt: new Date().toISOString()}); setComment(''); setPin(undefined);};
  return <div className="ops-review-workspace"><header><button onClick={close}><ArrowLeft size={16}/>Все материалы</button><div><select value={item.status} onChange={(event) => update({...item, status: event.target.value as ReviewStatus})}>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><a className="ops-button ghost" href={item.url} target="_blank"><ExternalLink size={15}/>Открыть оригинал</a></div></header>
    <div className="ops-review-layout"><main><div className="ops-review-title"><div><span className="ops-eyebrow">{project?.title || 'Проект'} · Версия {item.version}</span><h1>{item.title}</h1><p>{item.description}</p></div><span className={`ops-review-status ${item.status}`}>{reviewLabels[item.status]}</span></div>
      <div className="ops-review-canvas" ref={previewRef} onClick={(event) => {const rect = previewRef.current?.getBoundingClientRect(); if (rect) setPin({x: Math.round(((event.clientX - rect.left) / rect.width) * 100), y: Math.round(((event.clientY - rect.top) / rect.height) * 100)});}}>{item.preview ? <img src={item.preview} alt={item.title}/> : <div className="ops-review-placeholder"><Upload size={30}/><strong>Добавьте ссылку на превью</strong></div>}{item.comments.filter((entry) => entry.x !== undefined && entry.y !== undefined).map((entry, index) => <button title={entry.text} className={`ops-review-pin ${entry.resolved ? 'resolved' : ''}`} style={{left: `${entry.x}%`, top: `${entry.y}%`}} key={entry.id}>{index + 1}</button>)}{pin && <i className="ops-review-new-pin" style={{left: `${pin.x}%`, top: `${pin.y}%`}}><Plus size={13}/></i>}</div><p className="ops-canvas-help"><CircleDot size={13}/>Нажмите на макет, чтобы привязать комментарий к точке.</p>
    </main><aside><header><div><span className="ops-eyebrow">Обсуждение</span><h2>{item.comments.filter((entry) => !entry.resolved).length} открытых</h2></div><MessageSquare size={18}/></header><div className="ops-comment-list">{item.comments.map((entry, index) => <article className={entry.resolved ? 'resolved' : ''} key={entry.id}><header><b>{entry.x !== undefined ? index + 1 : '—'}</b><div><strong>{entry.author}</strong><time>{new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(entry.createdAt))}</time></div><button onClick={() => update({...item, comments: item.comments.map((comment) => comment.id === entry.id ? {...comment, resolved: !comment.resolved} : comment)})}>{entry.resolved ? 'Вернуть' : 'Решено'}</button></header><p>{entry.text}</p></article>)}{!item.comments.length && <Empty title="Комментариев нет" text="Нажмите на превью или напишите общий комментарий."/>}</div><div className="ops-comment-compose">{pin && <span>Точка {pin.x}% × {pin.y}% <button onClick={() => setPin(undefined)}><X size={12}/></button></span>}<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Что нужно изменить?"/><button className="ops-button primary" onClick={addComment}><Send size={14}/>Отправить</button></div></aside></div>
  </div>;
};

const Reviews = ({state, setState}: {state: OperationsState; setState: React.Dispatch<React.SetStateAction<OperationsState>>}) => {
  const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<string>(); const item = state.reviews.find((entry) => entry.id === selected);
  const update = (next: ReviewItem) => setState((current) => ({...current, reviews: current.reviews.map((entry) => entry.id === next.id ? next : entry)}));
  if (item) return <ReviewWorkspace item={item} project={state.projects.find((project) => project.id === item.projectId)} update={update} close={() => setSelected(undefined)}/>;
  return <><Header view="Клиентский портал" title="Согласования" description="Версии, комментарии прямо на макете и однозначный статус каждого результата." action={<button className="ops-button primary" onClick={() => setCreating(true)}><Plus size={15}/>Добавить материал</button>}/><section className="ops-review-summary"><div><span>На проверке</span><strong>{state.reviews.filter((review) => review.status === 'review').length}</strong></div><div><span>Нужны правки</span><strong>{state.reviews.filter((review) => review.status === 'changes').length}</strong></div><div><span>Согласовано</span><strong>{state.reviews.filter((review) => review.status === 'approved').length}</strong></div><div><span>Комментарии</span><strong>{state.reviews.reduce((sum, review) => sum + review.comments.filter((comment) => !comment.resolved).length, 0)}</strong></div></section><section className="ops-review-grid">{state.reviews.map((review) => <button className="ops-review-card" key={review.id} onClick={() => setSelected(review.id)}><div className="ops-review-thumb">{review.preview ? <img src={review.preview} alt=""/> : <Eye size={25}/>}<span className={`ops-review-status ${review.status}`}>{reviewLabels[review.status]}</span></div><div><span>{state.projects.find((project) => project.id === review.projectId)?.title || 'Проект'} · v{review.version}</span><h2>{review.title}</h2><p>{review.description}</p><footer><span><MessageSquare size={13}/>{review.comments.filter((comment) => !comment.resolved).length} открытых</span><ArrowUpRight size={15}/></footer></div></button>)}</section>{creating && <ReviewForm projects={state.projects} onClose={() => setCreating(false)} onSave={(review) => {setState((current) => ({...current, reviews: [review, ...current.reviews]})); setCreating(false); setSelected(review.id);}}/>}</>;
};

const LibraryForm = ({onSave, onClose}: {onSave: (item: LibraryItem) => void; onClose: () => void}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {event.preventDefault(); const form = new FormData(event.currentTarget); onSave({id: uid('library'), title: String(form.get('title')), description: String(form.get('description')), url: String(form.get('url')), preview: String(form.get('preview')), category: String(form.get('category')) as LibraryItem['category'], technology: String(form.get('technology')).split(',').map((value) => value.trim()).filter(Boolean), tags: String(form.get('tags')).split(',').map((value) => value.trim()).filter(Boolean), code: String(form.get('code')), license: String(form.get('license')), favorite: false, projects: [], createdAt: new Date().toISOString()});};
  return <Modal title="Сохранить решение" eyebrow="Библиотека" onClose={onClose}><form className="ops-form" onSubmit={submit}><label className="wide"><span>Название *</span><input name="title" required autoFocus/></label><label><span>Тип</span><select name="category"><option value="site">Сайт</option><option value="section">Секция</option><option value="animation">Анимация</option><option value="component">Компонент</option><option value="identity">Айдентика</option><option value="form">Форма</option><option value="3d">3D</option></select></label><label><span>Источник</span><input name="url" placeholder="https://..."/></label><label className="wide"><span>Превью</span><input name="preview" placeholder="URL изображения"/></label><label className="wide"><span>Почему сохранили</span><textarea name="description" rows={3}/></label><label><span>Технологии</span><input name="technology" placeholder="React, GSAP"/></label><label><span>Теги</span><input name="tags" placeholder="hero, b2b, light"/></label><label className="wide"><span>Код или заметка</span><textarea name="code" rows={5}/></label><label className="wide"><span>Лицензия</span><input name="license" placeholder="Источник / условия использования"/></label><footer><button type="button" className="ops-button ghost" onClick={onClose}>Отмена</button><button className="ops-button primary"><BookMarked size={15}/>Сохранить</button></footer></form></Modal>;
};

const LibraryView = ({state, setState}: {state: OperationsState; setState: React.Dispatch<React.SetStateAction<OperationsState>>}) => {
  const [creating, setCreating] = useState(false); const [query, setQuery] = useState(''); const [category, setCategory] = useState('all'); const [selected, setSelected] = useState<string>();
  const item = state.library.find((entry) => entry.id === selected); const categories: Array<{id: string; label: string}> = [{id:'all',label:'Все'}, {id:'site',label:'Сайты'}, {id:'section',label:'Секции'}, {id:'animation',label:'Анимации'}, {id:'component',label:'Компоненты'}, {id:'identity',label:'Айдентика'}, {id:'form',label:'Формы'}, {id:'3d',label:'3D'}];
  const visible = state.library.filter((entry) => (category === 'all' || entry.category === category) && `${entry.title} ${entry.description} ${entry.tags.join(' ')} ${entry.technology.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const update = (next: LibraryItem) => setState((current) => ({...current, library: current.library.map((entry) => entry.id === next.id ? next : entry)}));
  return <><Header view="Рабочая память" title="Библиотека" description="Не коллекция случайных ссылок, а переиспользуемые решения с контекстом, кодом и источником." action={<button className="ops-button primary" onClick={() => setCreating(true)}><Plus size={15}/>Сохранить решение</button>}/><div className="ops-library-toolbar"><label className="ops-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по идее, технологии или тегу"/></label><div className="ops-chip-row">{categories.map((entry) => <button className={category === entry.id ? 'active' : ''} key={entry.id} onClick={() => setCategory(entry.id)}>{entry.label}</button>)}</div></div><section className="ops-library-grid">{visible.map((entry) => <article className="ops-library-card" key={entry.id}><button className="ops-library-preview" onClick={() => setSelected(entry.id)}>{entry.preview ? <img src={entry.preview} alt=""/> : <Code2 size={30}/>}<span>{categories.find((item) => item.id === entry.category)?.label}</span></button><div className="ops-library-card-body"><header><button onClick={() => setSelected(entry.id)}><h2>{entry.title}</h2></button><IconButton label={entry.favorite ? 'Убрать из избранного' : 'В избранное'} onClick={() => update({...entry, favorite: !entry.favorite})}><Heart size={16} fill={entry.favorite ? 'currentColor' : 'none'}/></IconButton></header><p>{entry.description}</p><div className="ops-tags">{entry.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><footer><span>{entry.technology.join(' · ') || 'Без технологии'}</span><button onClick={() => setSelected(entry.id)}>Подробнее <ArrowRight size={13}/></button></footer></div></article>)}</section>{!visible.length && <Empty title="Ничего не найдено" text="Измените запрос или сохраните новое решение."/>}{creating && <LibraryForm onClose={() => setCreating(false)} onSave={(entry) => {setState((current) => ({...current, library: [entry, ...current.library]})); setCreating(false); setSelected(entry.id);}}/>}{item && <Modal title={item.title} eyebrow={categories.find((entry) => entry.id === item.category)?.label || 'Библиотека'} onClose={() => setSelected(undefined)}><div className="ops-library-detail">{item.preview && <img src={item.preview} alt=""/>}<p>{item.description}</p><div className="ops-detail-grid"><div><span>Технологии</span><strong>{item.technology.join(', ') || 'Не указаны'}</strong></div><div><span>Лицензия</span><strong>{item.license || 'Не указана'}</strong></div></div>{item.code && <div className="ops-code"><header><span>Код / заметка</span><button onClick={() => navigator.clipboard.writeText(item.code)}><Copy size={13}/>Копировать</button></header><pre>{item.code}</pre></div>}<footer><a className="ops-button ghost" href={item.url} target="_blank"><ExternalLink size={15}/>Открыть источник</a><button className="ops-button primary" onClick={() => update({...item, favorite: !item.favorite})}><Heart size={15} fill={item.favorite ? 'currentColor' : 'none'}/>{item.favorite ? 'В избранном' : 'В избранное'}</button></footer></div></Modal>}</>;
};

const ClientPortal = ({project, reviews, setState}: {project: StudioProject; reviews: ReviewItem[]; setState: React.Dispatch<React.SetStateAction<OperationsState>>}) => {
  const [selectedId, setSelectedId] = useState(reviews[0]?.id); const [author, setAuthor] = useState('Клиент'); const [text, setText] = useState('');
  const selected = reviews.find((item) => item.id === selectedId);
  const update = (next: ReviewItem) => setState((current) => ({...current, reviews: current.reviews.map((item) => item.id === next.id ? next : item)}));
  const send = () => {if (!selected || !text.trim()) return; update({...selected, status: selected.status === 'approved' ? 'changes' : selected.status, comments: [...selected.comments, {id: uid('comment'), author: author.trim() || 'Клиент', text: text.trim(), createdAt: new Date().toISOString(), resolved: false}], updatedAt: new Date().toISOString()}); setText('');};
  return <div className="client-portal"><header><a href="/"><img src="/assets/brand/autocubes.svg" alt=""/><span>autocubes</span></a><div><span>Пространство согласования</span><b>{project.client}</b></div></header><main><section className="client-portal-heading"><span>Проект / {project.title}</span><h1>Материалы<br/>на согласование</h1><p>Посмотрите актуальные версии, оставьте комментарий или согласуйте результат. Все решения сохраняются в истории проекта.</p></section><nav>{reviews.map((item, index) => <button className={item.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(item.id)} key={item.id}><i>{String(index + 1).padStart(2, '0')}</i><span>{item.title}<small>Версия {item.version}</small></span><b className={`ops-review-status ${item.status}`}>{reviewLabels[item.status]}</b></button>)}</nav>{selected ? <section className="client-review"><div className="client-review-preview">{selected.preview ? <img src={selected.preview} alt={selected.title}/> : <Eye size={32}/>}</div><aside><span className="ops-eyebrow">Версия {selected.version}</span><h2>{selected.title}</h2><p>{selected.description}</p><div className="client-review-actions"><button className="ops-button primary" onClick={() => update({...selected, status: 'approved', updatedAt: new Date().toISOString()})}><CheckCircle2 size={15}/>{selected.status === 'approved' ? 'Согласовано' : 'Согласовать'}</button><a className="ops-button ghost" href={selected.url} target="_blank"><ExternalLink size={15}/>Открыть</a></div><div className="client-comments"><header><strong>Обсуждение</strong><span>{selected.comments.filter((item) => !item.resolved).length} открытых</span></header>{selected.comments.map((comment) => <article key={comment.id}><div><b>{comment.author.slice(0, 1).toUpperCase()}</b><span><strong>{comment.author}</strong><time>{new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'short'}).format(new Date(comment.createdAt))}</time></span></div><p>{comment.text}</p></article>)}<div className="client-compose"><input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Ваше имя"/><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Напишите, что нужно изменить..."/><button onClick={send}><Send size={14}/>Отправить комментарий</button></div></div></aside></section> : <Empty title="Материалов пока нет" text="Команда добавит сюда актуальные версии."/>}</main></div>;
};

export const OperationsApp = () => {
  const [state, setState] = useOperations();
  const params = new URLSearchParams(location.search);
  const initialView = (params.get('view') as View) || 'overview';
  const [view, setView] = useState<View>(['overview','crm','projects','reviews','library'].includes(initialView) ? initialView : 'overview');
  const [commandOpen, setCommandOpen] = useState(false);
  useEffect(() => {const listener = (event: KeyboardEvent) => {if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); setCommandOpen((value) => !value);}}; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);}, []);
  const navigate = (next: View) => {setView(next); history.replaceState(null, '', next === 'overview' ? '/' : `/?view=${next}`); window.scrollTo(0, 0);};
  const exportData = () => {const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'})); link.download = `autocubes-operations-${today()}.json`; link.click(); URL.revokeObjectURL(link.href);};
  const reviewProjectId = params.get('review');
  const reviewProject = state.projects.find((project) => project.id === reviewProjectId);
  if (reviewProject) return <ClientPortal project={reviewProject} reviews={state.reviews.filter((review) => review.projectId === reviewProject.id)} setState={setState}/>;
  return <div className="ops-shell"><aside className="ops-sidebar"><a className="ops-brand" href="/"><img src="/assets/brand/autocubes.svg" alt=""/><span>autocubes</span><b>studio</b></a><nav><span>Управление</span><button className={view === 'overview' ? 'active' : ''} onClick={() => navigate('overview')}><LayoutDashboard size={16}/>Обзор</button><button className={view === 'crm' ? 'active' : ''} onClick={() => navigate('crm')}><UsersRound size={16}/>CRM<b>{state.leads.filter((lead) => lead.stage === 'new').length}</b></button><button className={view === 'projects' ? 'active' : ''} onClick={() => navigate('projects')}><FolderKanban size={16}/>Проекты</button><button className={view === 'reviews' ? 'active' : ''} onClick={() => navigate('reviews')}><MessageSquare size={16}/>Согласования<b>{state.reviews.reduce((sum, item) => sum + item.comments.filter((comment) => !comment.resolved).length, 0)}</b></button><button className={view === 'library' ? 'active' : ''} onClick={() => navigate('library')}><Library size={16}/>Библиотека</button><span>Инструменты</span><a href="/editor.html"><Sparkles size={16}/>Motion Desk<ArrowUpRight size={13}/></a><a href="/apps/identity/identity-lab.html"><ClipboardCheck size={16}/>Identity Lab<ArrowUpRight size={13}/></a><a href="/documents.html"><ListChecks size={16}/>Документы<ArrowUpRight size={13}/></a></nav><footer><button onClick={exportData}><Download size={15}/>Экспорт данных</button><span><i/>Сохранено локально</span></footer></aside><main className="ops-main"><div className="ops-topbar"><button className="ops-command-trigger" onClick={() => setCommandOpen(true)}><Search size={14}/>Найти или открыть...<kbd>Ctrl K</kbd></button><div><span>{new Intl.DateTimeFormat('ru-RU', {weekday:'long', day:'numeric', month:'long'}).format(new Date())}</span><span className="ops-avatar">AC</span></div></div><div className="ops-content">{view === 'overview' && <Overview state={state} openView={navigate}/>} {view === 'crm' && <CRM state={state} setState={setState}/>} {view === 'projects' && <Projects state={state} setState={setState}/>} {view === 'reviews' && <Reviews state={state} setState={setState}/>} {view === 'library' && <LibraryView state={state} setState={setState}/>}</div></main>{commandOpen && <div className="ops-command-backdrop" onMouseDown={() => setCommandOpen(false)}><div className="ops-command" onMouseDown={(event) => event.stopPropagation()}><label><Search size={17}/><input autoFocus placeholder="Проект, клиент или инструмент..."/></label><span>Перейти</span>{([['overview','Обзор',LayoutDashboard],['crm','CRM',UsersRound],['projects','Проекты',FolderKanban],['reviews','Согласования',MessageSquare],['library','Библиотека',Library]] as const).map(([id,title,Icon]) => <button key={id} onClick={() => {navigate(id); setCommandOpen(false);}}><Icon size={16}/>{title}<ArrowRight size={14}/></button>)}<span>Действия</span><button onClick={exportData}><Download size={16}/>Экспортировать рабочие данные</button><button onClick={() => {if (confirm('Вернуть демонстрационные данные? Текущие изменения будут удалены.')) {setState(initialOperationsState); setCommandOpen(false);}}}><Trash2 size={16}/>Сбросить локальные данные</button></div></div>}</div>;
};
