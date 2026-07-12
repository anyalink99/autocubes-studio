import React, {useEffect, useMemo, useState} from 'react';
import {ArrowRight, Check, Crosshair, Globe2, LoaderCircle, MousePointer2, Play, RefreshCw, ScanSearch, Sparkles, Video, X} from 'lucide-react';
import {CaptureAnalysis, CaptureSection, CaptureTarget, EditorProject} from '../../packages/core/editor-project';

type Props={project:EditorProject;analysis?:CaptureAnalysis;analyzing:boolean;recording:boolean;onChangeUrl:(url:string)=>void;onAnalyze:()=>void;onBuild:(sections:CaptureSection[],targets:CaptureTarget[])=>void;onRecord:()=>void;onClose:()=>void};

export const CaptureDirector=({project,analysis,analyzing,recording,onChangeUrl,onAnalyze,onBuild,onRecord,onClose}:Props)=>{
  const[sectionIds,setSectionIds]=useState<Set<string>>(new Set());
  const[targetIds,setTargetIds]=useState<Set<string>>(new Set());
  const[stage,setStage]=useState<'source'|'plan'|'ready'>(analysis?'plan':'source');
  useEffect(()=>{if(!analysis)return;setSectionIds(new Set(analysis.sections.slice(0,8).map((item)=>item.id)));setTargetIds(new Set());setStage('plan');},[analysis?.analyzedAt]);
  const selectedSections=useMemo(()=>analysis?.sections.filter((item)=>sectionIds.has(item.id))??[],[analysis,sectionIds]);
  const selectedTargets=useMemo(()=>analysis?.targets.filter((item)=>targetIds.has(item.id))??[],[analysis,targetIds]);
  const toggle=(setter:React.Dispatch<React.SetStateAction<Set<string>>>,id:string)=>setter((current)=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});
  const build=()=>{onBuild(selectedSections,selectedTargets);setStage('ready');};
  return <div className="capture-director-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&onClose()}>
    <section className="capture-director">
      <header className="capture-director-head"><div><span>Режиссёр захвата</span><h2>Соберите шоукейс страницы до записи</h2></div><button onClick={onClose} aria-label="Закрыть"><X size={18}/></button></header>
      <nav className="capture-steps" aria-label="Этапы захвата"><span className={analysis?'done':'active'}><b>1</b>Источник</span><i/><span className={analysis?'done':analyzing?'active':''}><b>2</b>Разбор страницы</span><i/><span className={stage==='ready'?'done':stage==='plan'?'active':''}><b>3</b>Сценарий</span><i/><span className={stage==='ready'?'active':''}><b>4</b>Запись</span></nav>
      {!analysis?<div className="capture-source">
        <div className="source-copy"><span><Globe2 size={16}/>Страница в браузере</span><h3>Сначала посмотрим, что находится на странице</h3><p>Быстрый разбор делает длинный снимок, находит смысловые секции, кнопки и ссылки. Видео на этом этапе не записывается.</p><label>Адрес страницы<input value={project.url} onChange={(event)=>onChangeUrl(event.target.value)} placeholder="https://example.com"/></label><button className="capture-primary" disabled={analyzing||!project.url} onClick={onAnalyze}>{analyzing?<LoaderCircle className="spin" size={16}/>:<ScanSearch size={16}/>} {analyzing?'Разбираем страницу…':'Разобрать страницу'}</button></div>
        <div className="source-diagram"><div><Globe2/><span>URL</span></div><ArrowRight/><div><ScanSearch/><span>Секции</span></div><ArrowRight/><div><Crosshair/><span>Цели</span></div><ArrowRight/><div><Video/><span>Сценарий</span></div></div>
      </div>:<div className="capture-planner">
        <aside className="page-atlas"><div className="atlas-head"><span>Карта страницы</span><b>{analysis.pageHeight}px</b></div><div className="atlas-image"><img src={analysis.fullPageImage} alt="Полный снимок страницы"/>{analysis.sections.map((section)=><i key={section.id} className={sectionIds.has(section.id)?'selected':''} style={{top:`${section.scrollY/analysis.pageHeight*100}%`}}/>)}</div><button onClick={onAnalyze} disabled={analyzing}><RefreshCw size={13}/>Обновить разбор</button></aside>
        <div className="capture-choices">
          <section><div className="choice-head"><div><span>Сцены</span><strong>{selectedSections.length} выбрано</strong></div><p>Каждая сцена — понятная остановка камеры на странице. Перемещение между сценами станет скроллом.</p></div><div className="choice-list">{analysis.sections.map((section,index)=><button className={sectionIds.has(section.id)?'selected':''} key={section.id} onClick={()=>toggle(setSectionIds,section.id)}><span>{sectionIds.has(section.id)?<Check size={12}/>:String(index+1).padStart(2,'0')}</span><div><strong>{section.label}</strong><small>{section.scrollY}px от начала</small></div></button>)}</div></section>
          <section><div className="choice-head"><div><span>Действия курсора</span><strong>{selectedTargets.length} выбрано</strong></div><p>Выберите только те кнопки и ссылки, которые помогают рассказать историю продукта.</p></div><div className="target-list">{analysis.targets.slice(0,30).map((target)=><button className={targetIds.has(target.id)?'selected':''} key={target.id} onClick={()=>toggle(setTargetIds,target.id)}><span>{targetIds.has(target.id)?<Check size={11}/>:<MousePointer2 size={11}/>}</span><div><strong>{target.label}</strong><small>{target.role} · {target.selector}</small></div></button>)}</div></section>
        </div>
      </div>}
      {analysis?<footer className="capture-director-actions"><div><span>{analysis.title}</span><small>{analysis.sections.length} секций · {analysis.targets.length} интерактивных целей</small></div>{stage==='ready'?<><button onClick={()=>setStage('plan')}>Изменить сценарий</button><button className="capture-primary" onClick={onRecord} disabled={recording}>{recording?<LoaderCircle className="spin" size={15}/>:<Play size={15}/>}Записать готовый шоукейс</button></>:<button className="capture-primary" disabled={selectedSections.length<2} onClick={build}><Sparkles size={15}/>Создать сценарий без записи</button>}</footer>:null}
    </section>
  </div>;
};
