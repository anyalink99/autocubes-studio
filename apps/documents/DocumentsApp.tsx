import React, {useEffect, useMemo, useState} from 'react';
import {ArrowDown, ArrowLeft, ArrowUp, Download, FilePlus2, Plus, Printer, Save, Trash2, X} from 'lucide-react';
import {createDocument, DocumentSection, StudioDocument, templates} from './templates';

const STORAGE_KEY = 'autocubes-documents-v1';
const INDEX_KEY = 'autocubes-documents-index';

const loadDocuments = (): StudioDocument[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
const paragraphs = (value: string) => value.split(/\n+/).filter(Boolean).map((line) => `<p>${escapeHTML(line)}</p>`).join('');
const logoPath = 'M633 1040H257a30 30 0 0 1-30-30V257a30 30 0 0 1 30-30h409a30 30 0 0 0 30-30v-44a30 30 0 0 0-30-30H153a30 30 0 0 0-30 30v630a30 30 0 0 1-30 30H30A30 30 0 0 1 0 783V30A30 30 0 0 1 30 0h753a30 30 0 0 1 30 30v753a30 30 0 0 1-30 30H374a30 30 0 0 0-30 30v44a30 30 0 0 0 30 30h513a30 30 0 0 0 30-30V257a30 30 0 0 1 30-30h63a30 30 0 0 1 30 30v753a30 30 0 0 1-30 30ZM519 349H379a30 30 0 0 0-30 30v282a30 30 0 0 0 30 30h281a30 30 0 0 0 30-30V379a30 30 0 0 0-30-30Z';

const documentHtml = (document: StudioDocument) => `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(document.title)}</title><style>*{box-sizing:border-box}body{margin:0;color:#171713;background:#fff;font:15px/1.65 Arial,sans-serif}.doc{max-width:800px;margin:auto;padding:54px 42px 70px}.head{display:flex;justify-content:space-between;align-items:center;padding-bottom:20px;border-bottom:1px solid #171713}.brand{display:flex;align-items:center;gap:10px;font-weight:700}.brand svg{width:27px;height:27px}.meta{color:#68685f;font-size:11px}h1{margin:38px 0 14px;font-size:31px;line-height:1.16}h2{margin:38px 0 12px;font-size:18px}p{margin:0 0 12px}.intro{font-size:17px}.client{margin:22px 0 0;padding:13px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;color:#555;font-size:12px}.foot{display:flex;justify-content:space-between;margin-top:60px;padding-top:14px;border-top:1px solid #ddd;color:#777;font-size:11px}@media(max-width:600px){.doc{padding:28px 20px}.head{align-items:flex-start;gap:18px}.meta{text-align:right}}@media print{.doc{max-width:none;padding:0}@page{margin:18mm}}</style></head><body><main class="doc"><header class="head"><div class="brand"><svg viewBox="0 0 1040 1040"><path d="${logoPath}"/></svg>autocubes</div><div class="meta">${escapeHTML(document.type)} · ${escapeHTML(document.date)}</div></header><h1>${escapeHTML(document.title)}</h1><p class="intro">${escapeHTML(document.intro)}</p><div class="client">${escapeHTML(document.client)} · ${escapeHTML(document.project)} · ${escapeHTML(document.status)}</div>${document.sections.map((section) => `<section><h2>${escapeHTML(section.heading)}</h2>${paragraphs(section.body)}</section>`).join('')}<footer class="foot"><span>autocubes.site</span><span>${escapeHTML(document.status)}</span></footer></main></body></html>`;

export const DocumentsApp = () => {
  const query = useMemo(() => new URLSearchParams(location.search), []);
  const [documents, setDocuments] = useState<StudioDocument[]>(() => {
    const stored = loadDocuments();
    if (stored.length) return stored;
    return [createDocument(query.get('new') || 'technical-specification')];
  });
  const [currentId, setCurrentId] = useState(() => query.get('id') || documents[0].id);
  const [showTemplates, setShowTemplates] = useState(false);
  const current = documents.find((document) => document.id === currentId) ?? documents[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    localStorage.setItem(INDEX_KEY, JSON.stringify(documents.map(({id,title,type,updatedAt}) => ({id,title,type,updatedAt}))));
  }, [documents]);

  const update = (patch: Partial<StudioDocument>) => setDocuments((items) => items.map((document) => document.id === current.id ? {...document, ...patch, updatedAt:new Date().toISOString()} : document));
  const updateSection = (id: string, patch: Partial<DocumentSection>) => update({sections:current.sections.map((section) => section.id === id ? {...section,...patch} : section)});
  const moveSection = (id: string, direction: -1 | 1) => {
    const sections = [...current.sections]; const index = sections.findIndex((section) => section.id === id); const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index],sections[target]]=[sections[target],sections[index]]; update({sections});
  };
  const addSection = () => update({sections:[...current.sections,{id:`section-${Date.now()}`,heading:'Новый раздел',body:'Содержание раздела.'}]});
  const removeSection = (id: string) => update({sections:current.sections.filter((section) => section.id !== id)});
  const addDocument = (templateId: string) => { const document = createDocument(templateId); setDocuments((items) => [...items,document]); setCurrentId(document.id); setShowTemplates(false); };
  const removeDocument = () => {
    if (documents.length === 1) return;
    const remaining = documents.filter((document) => document.id !== current.id); setDocuments(remaining); setCurrentId(remaining[0].id);
  };
  const download = () => {
    const blob = new Blob([documentHtml(current)],{type:'text/html;charset=utf-8'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`${current.templateId}-${current.project.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-')}.html`; link.click(); URL.revokeObjectURL(link.href);
  };

  return <div className="documents-app">
    <aside className="documents-sidebar">
      <a href="/" className="documents-brand"><ArrowLeft size={15}/><img src="/assets/brand/autocubes.svg" alt=""/><span>Documents</span></a>
      <button className="new-document" onClick={() => setShowTemplates(true)}><FilePlus2 size={16}/>New document</button>
      <div className="document-list"><span className="side-caption">Documents</span>{documents.map((document) => <button className={document.id===current.id?'active':''} key={document.id} onClick={()=>setCurrentId(document.id)}><FileTextIcon/><span><strong>{document.title}</strong><small>{document.type}</small></span></button>)}</div>
      <a className="example-link" target="_blank" href="/examples/documents/amavi-technical-specification.html">AMAVI example <ArrowUpRightIcon/></a>
    </aside>
    <main className="document-workspace">
      <header className="document-toolbar"><div><span>{current.type}</span><b>{current.status}</b></div><div><button onClick={()=>window.print()} title="Print"><Printer size={16}/></button><button onClick={download} title="Download HTML"><Download size={16}/></button><button className="save-state"><Save size={15}/>Saved locally</button></div></header>
      <div className="paper-stage"><article className="document-paper">
        <header className="paper-head"><div className="paper-brand"><img src="/assets/brand/autocubes.svg" alt=""/><b>autocubes</b></div><div className="paper-meta">{current.type} · {current.date}</div></header>
        <input className="paper-title" value={current.title} onChange={(event)=>update({title:event.target.value})}/>
        <textarea className="paper-intro" value={current.intro} onChange={(event)=>update({intro:event.target.value})}/>
        <div className="paper-client"><input value={current.client} onChange={(event)=>update({client:event.target.value})}/><span>·</span><input value={current.project} onChange={(event)=>update({project:event.target.value})}/><span>·</span><input value={current.status} onChange={(event)=>update({status:event.target.value})}/></div>
        <div className="paper-sections">{current.sections.map((section,index)=><section className="paper-section" key={section.id}><div className="section-controls"><button disabled={index===0} onClick={()=>moveSection(section.id,-1)}><ArrowUp size={13}/></button><button disabled={index===current.sections.length-1} onClick={()=>moveSection(section.id,1)}><ArrowDown size={13}/></button><button onClick={()=>removeSection(section.id)}><Trash2 size={13}/></button></div><input value={section.heading} onChange={(event)=>updateSection(section.id,{heading:event.target.value})}/><textarea value={section.body} onChange={(event)=>updateSection(section.id,{body:event.target.value})}/></section>)}</div>
        <button className="add-section" onClick={addSection}><Plus size={14}/>Добавить раздел</button>
        <footer className="paper-foot"><span>autocubes.site</span><span>{current.status}</span></footer>
      </article></div>
    </main>
    <aside className="document-inspector"><div className="inspector-head"><span>Document</span><button onClick={removeDocument} disabled={documents.length===1}><Trash2 size={14}/></button></div><label>Client<input value={current.client} onChange={(event)=>update({client:event.target.value})}/></label><label>Project<input value={current.project} onChange={(event)=>update({project:event.target.value})}/></label><label>Date<input value={current.date} onChange={(event)=>update({date:event.target.value})}/></label><label>Status<input value={current.status} onChange={(event)=>update({status:event.target.value})}/></label><div className="inspector-note"><b>Standalone output</b><span>Downloaded HTML includes its own layout and print styles.</span></div></aside>
    {showTemplates&&<div className="template-overlay" onMouseDown={(event)=>event.target===event.currentTarget&&setShowTemplates(false)}><div className="template-picker"><div className="picker-head"><div><span className="side-caption">New document</span><h2>Choose a template</h2></div><button onClick={()=>setShowTemplates(false)}><X size={18}/></button></div><div className="template-grid">{templates.map((template)=><button key={template.templateId} onClick={()=>addDocument(template.templateId)}><span>{template.short}</span><strong>{template.name}</strong><small>{template.sections.length} разделов</small></button>)}</div></div></div>}
  </div>;
};

const FileTextIcon=()=> <span className="file-icon">T</span>;
const ArrowUpRightIcon=()=> <span aria-hidden="true">↗</span>;
