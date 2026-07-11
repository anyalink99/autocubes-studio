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
    label: 'Capture / edit / render',
    href: '/editor.html',
    icon: Film,
    tone: 'orange',
    copy: 'Build site reels from real captures, frames, pointer actions, transitions, music, and SFX.',
  },
  {
    id: 'identity',
    title: 'Identity lab',
    label: '60 systems / 532 variants',
    href: '/apps/identity/identity-lab.html',
    icon: Palette,
    tone: 'blue',
    copy: 'Explore, edit, and shortlist identity compositions in one visual workspace.',
  },
  {
    id: 'documents',
    title: 'Documents',
    label: '6 studio templates',
    href: '/documents.html',
    icon: FileText,
    tone: 'paper',
    copy: 'Prepare technical specifications, briefs, proposals, estimates, acceptance, and handoff files.',
  },
  {
    id: 'canvas',
    title: 'Canvas',
    label: 'Collaborative design / planned',
    href: '',
    icon: Users,
    tone: 'muted',
    copy: 'A shared design surface for future Autocubes projects.',
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
      return JSON.parse(localStorage.getItem('autocubes-documents-index') || '[]') as Array<{id: string; title: string; type: string; updatedAt: string}>;
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <a className="studio-brand" href="/" aria-label="Autocubes Studio home">
          <img src="/assets/brand/autocubes.svg" alt="" />
          <span>autocubes</span>
        </a>
        <nav className="studio-nav" aria-label="Studio tools">
          <span className="nav-caption">Workspace</span>
          <a className="active" href="/"><Boxes size={16} />Overview</a>
          <a href="/editor.html"><Film size={16} />Motion</a>
          <a href="/apps/identity/identity-lab.html"><Palette size={16} />Identity</a>
          <a href="/documents.html"><FileText size={16} />Documents</a>
          <span className="nav-caption second">Library</span>
          <a href="/examples/documents/amavi-technical-specification.html" target="_blank"><LayoutTemplate size={16} />Examples</a>
        </nav>
        <div className="sidebar-status"><span><i />Local workspace</span><b>Autocubes Studio</b></div>
      </aside>

      <main className="studio-main">
        <header className="studio-topbar">
          <div><span>{formatDate()}</span><strong>{clock}</strong></div>
          <a className="top-action" href="/documents.html?new=technical-specification"><FileText size={15} />New document</a>
        </header>

        <section className="workspace-heading">
          <div><span className="eyebrow">Creative operations</span><h1>Studio workspace</h1></div>
          <p>Identity, motion, capture, and project documents in one working system.</p>
        </section>

        <section className="studio-metrics" aria-label="Workspace summary">
          <div><span>Tools</span><strong>04</strong></div>
          <div><span>Motion projects</span><strong>{String(projects.length).padStart(2, '0')}</strong></div>
          <div><span>Document templates</span><strong>06</strong></div>
          <div><span>Identity studies</span><strong>532</strong></div>
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
                {module.id === 'canvas' && <div className="canvas-grid" aria-hidden="true"><ScanLine size={28} /><span>Reserved</span></div>}
              </>
            );
            return module.href ? <a key={module.id} className={`module module-${module.tone} module-${module.id}`} href={module.href}>{content}</a> : <div key={module.id} className={`module module-${module.tone} module-${module.id}`} aria-disabled="true">{content}</div>;
          })}
        </section>

        <section className="work-register">
          <div className="section-title"><div><span className="eyebrow">Current work</span><h2>Project register</h2></div><a href="/editor.html">Open motion desk <ArrowRight size={15} /></a></div>
          <div className="register-table">
            {(projects.length ? projects : [{id:'flowline', title:'Flowline', url:'https://portfolio.autocubes.site/flowline'}]).slice(0, 5).map((project, index) => <a href={`/editor.html?project=${encodeURIComponent(project.id)}`} className="register-row" key={project.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{project.title}</strong><span>{project.url.replace(/^https?:\/\//, '')}</span><span>Motion</span><ArrowUpRight size={15} /></a>)}
            {recentDocuments.slice(0, 3).map((document, index) => <a href={`/documents.html?id=${encodeURIComponent(document.id)}`} className="register-row" key={document.id}><span>{String(projects.length + index + 1).padStart(2, '0')}</span><strong>{document.title}</strong><span>{document.type}</span><span>Document</span><ArrowUpRight size={15} /></a>)}
          </div>
        </section>
      </main>
    </div>
  );
};
