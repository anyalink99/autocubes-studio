import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  FileText,
  Film,
  LayoutTemplate,
  Palette,
  Play,
  ScanLine,
  Users,
} from 'lucide-react';

type Project = {id: string; title: string; url: string};

const modules = [
  {
    id: 'motion',
    title: 'Motion desk',
    label: 'Захват / монтаж / экспорт',
    href: '/editor.html',
    icon: Film,
    tone: 'orange',
    copy: 'Собирайте шоукейсы сайтов из реальных сцен, действий курсора, текста, музыки и эффектов.',
  },
  {
    id: 'identity',
    title: 'Identity lab',
    label: '60 систем / 532 варианта',
    href: '/apps/identity/identity-lab.html',
    icon: Palette,
    tone: 'blue',
    copy: 'Исследуйте, редактируйте и собирайте айдентику и карусели в одном пространстве.',
  },
  {
    id: 'documents',
    title: 'Документы',
    label: '15 структурированных шаблонов',
    href: '/documents.html',
    icon: FileText,
    tone: 'paper',
    copy: 'Готовьте брифы, предложения, сметы, согласования и передачу проекта на двух языках.',
  },
  {
    id: 'canvas',
    title: 'Центр проектов',
    label: 'Материалы / статусы / передача',
    href: '#project-hub',
    icon: Users,
    tone: 'muted',
    copy: 'Связывайте motion-проекты, выбранную айдентику, документы и финальные материалы.',
  },
] as const;

const formatDate = () => new Intl.DateTimeFormat('en', {weekday: 'short', day: '2-digit', month: 'short'}).format(new Date());

export const StudioApp = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clock, setClock] = useState('');

  useEffect(() => {
    fetch('/api/projects').then((response) => response.ok ? response.json() : []).then(setProjects).catch(() => setProjects([]));
    const updateClock = () => setClock(new Intl.DateTimeFormat('en', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const recentDocuments = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('autocubes-documents-index') || '[]') as Array<{id: string; title: string; type: string; updatedAt: string; client?:string; project?:string; status?:string}>;
    } catch {
      return [];
    }
  }, []);
  const identityState=useMemo(()=>{try{return {brand:JSON.parse(localStorage.getItem('autocubes-identity-brand-kit-v1')||'null') as {name?:string}|null,picked:(JSON.parse(localStorage.getItem('autocubes-identity-v2-picked')||'[]') as number[]).length};}catch{return {brand:null,picked:0};}},[]);

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <a className="studio-brand" href="/" aria-label="Autocubes Studio home">
          <img src="/assets/brand/autocubes.svg" alt="" />
          <span>autocubes</span>
        </a>
        <nav className="studio-nav" aria-label="Studio tools">
          <span className="nav-caption">Студия</span>
          <a className="active" href="/"><Boxes size={16} />Обзор</a>
          <a href="/editor.html"><Film size={16} />Motion</a>
          <a href="/apps/identity/identity-lab.html"><Palette size={16} />Айдентика</a>
          <a href="/documents.html"><FileText size={16} />Документы</a>
          <span className="nav-caption second">Библиотека</span>
          <a href="/examples/documents/amavi-technical-specification.html" target="_blank"><LayoutTemplate size={16} />Примеры</a>
        </nav>
        <div className="sidebar-status"><span><i />Локальное пространство</span><b>Autocubes Studio</b></div>
      </aside>

      <main className="studio-main">
        <header className="studio-topbar">
          <div><span>{formatDate()}</span><strong>{clock}</strong></div>
          <a className="top-action" href="/documents.html?new=creative-brief"><FileText size={15} />Новый документ</a>
        </header>

        <section className="workspace-heading">
          <div><span className="eyebrow">Производство контента</span><h1>Рабочая студия</h1></div>
          <p>Айдентика, браузерные шоукейсы и проектные документы в одной системе.</p>
        </section>

        <section className="studio-metrics" aria-label="Workspace summary">
          <div><span>Инструменты</span><strong>04</strong></div>
          <div><span>Motion-проекты</span><strong>{String(projects.length).padStart(2, '0')}</strong></div>
          <div><span>Документы</span><strong>{String(recentDocuments.length).padStart(2,'0')}</strong></div>
          <div><span>Выбрано в айдентике</span><strong>{String(identityState.picked).padStart(2,'0')}</strong></div>
        </section>

        <section className="module-grid" aria-label="Studio modules">
          {modules.map((module) => {
            const Icon = module.icon;
            const content = (
              <>
                <div className="module-head"><span className="module-icon"><Icon size={18} /></span><span>{module.label}</span>{module.href && <ArrowUpRight size={17} />}</div>
                <div className="module-copy"><h2>{module.title}</h2><p>{module.copy}</p></div>
                {module.id === 'motion' && <div className="motion-monitor" aria-hidden="true"><div className="monitor-frame"><span>flowline / 00:08:14</span><Play size={18} fill="currentColor" /></div><div className="monitor-track"><i /><b /><em /></div><div className="monitor-playhead" /></div>}
                {module.id === 'identity' && <div className="identity-stack" aria-hidden="true"><i /><i /><i /><img src="/assets/brand/autocubes.svg" alt="" /></div>}
                {module.id === 'documents' && <div className="document-sheet" aria-hidden="true"><i /><b /><span /><span /><span /></div>}
                {module.id === 'canvas' && <div className="canvas-grid" aria-hidden="true"><ScanLine size={28} /><span>{projects.length + recentDocuments.length + identityState.picked} active objects</span></div>}
              </>
            );
            return <a key={module.id} className={`module module-${module.tone} module-${module.id}`} href={module.href}>{content}</a>;
          })}
        </section>

        <section className="production-flow" aria-label="Studio production flow">
          <a href="/apps/identity/identity-lab.html"><span>01</span><div><b>Определить визуальную систему</b><small>{identityState.brand?.name??'Brand Kit'} · {identityState.picked} выбранных направлений</small></div><ArrowRight size={15}/></a>
          <a href="/editor.html"><span>02</span><div><b>Собрать шоукейс</b><small>{projects.length} проектов · reels, stories и обзоры сайтов</small></div><ArrowRight size={15}/></a>
          <a href="/documents.html"><span>03</span><div><b>Оформить и передать</b><small>{recentDocuments.length} брифов, согласований и handoff-файлов</small></div><ArrowRight size={15}/></a>
        </section>

        <section className="work-register" id="project-hub">
          <div className="section-title"><div><span className="eyebrow">Текущая работа</span><h2>Проекты студии</h2></div><a href="/editor.html">Открыть Motion Desk <ArrowRight size={15} /></a></div>
          <div className="register-table">
            {(projects.length ? projects : [{id:'flowline', title:'Flowline', url:'https://portfolio.autocubes.site/flowline'}]).slice(0, 5).map((project, index) => <a href={`/editor.html?project=${encodeURIComponent(project.id)}`} className="register-row" key={project.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{project.title}</strong><span>{project.url.replace(/^https?:\/\//, '')}</span><span>Motion</span><ArrowUpRight size={15} /></a>)}
            {recentDocuments.slice(0, 3).map((document, index) => <a href={`/documents.html?id=${encodeURIComponent(document.id)}`} className="register-row" key={document.id}><span>{String(projects.length + index + 1).padStart(2, '0')}</span><strong>{document.title}</strong><span>{document.type}</span><span>Документ</span><ArrowUpRight size={15} /></a>)}
          </div>
          <div className="hub-actions"><a href="/editor.html"><Film size={14}/>Новый motion-проект</a><a href="/apps/identity/identity-lab.html"><Palette size={14}/>Открыть Brand Kit</a><a href="/documents.html?new=motion-brief"><FileText size={14}/>Создать motion-бриф</a><a href="/documents.html?new=social-pack"><LayoutTemplate size={14}/>Подготовить social pack</a></div>
        </section>
      </main>
    </div>
  );
};
