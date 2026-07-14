import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowRight, Check, Crosshair, Eye, Globe2, GripVertical, LoaderCircle, MousePointer2, Play, RefreshCw, ScanSearch, Sparkles, Video, X} from 'lucide-react';
import {CaptureAnalysis, CaptureSection, CaptureTarget, EditorProject, MotionProfile, ScrollFrame} from '../../packages/core/editor-project';
import {captureDirectionReport, clamp, formatEditorTime, maxScroll, scrollPercent} from '../../packages/core/editor-operations';

type Props = {
  project: EditorProject;
  analysis?: CaptureAnalysis;
  analyzing: boolean;
  recording: boolean;
  onChangeUrl: (url: string) => void;
  onAnalyze: () => void;
  onBuild: (sections: CaptureSection[], targets: CaptureTarget[], profile: MotionProfile) => void;
  onPolish: (profile: MotionProfile) => void;
  onChangeFrame: (id: string, patch: Partial<ScrollFrame>) => void;
  onRecord: () => void;
  onClose: () => void;
};

export const CaptureDirector = ({project, analysis, analyzing, recording, onChangeUrl, onAnalyze, onBuild, onPolish, onChangeFrame, onRecord, onClose}: Props) => {
  const [sectionIds, setSectionIds] = useState<Set<string>>(new Set());
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<'source' | 'plan' | 'ready'>(analysis ? project.frames.length ? 'ready' : 'plan' : 'source');
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(project.frames[0]?.id);
  const [profile, setProfile] = useState<MotionProfile>(project.motionProfile ?? 'balanced');
  const previousAnalysisAt = useRef(analysis?.analyzedAt);

  useEffect(() => {
    if (!analysis) return;
    setSectionIds(new Set(analysis.sections.slice(0, 8).map((item) => item.id)));
    setTargetIds(new Set());
    if (previousAnalysisAt.current !== analysis.analyzedAt) setStage('plan');
    previousAnalysisAt.current = analysis.analyzedAt;
  }, [analysis?.analyzedAt]);

  useEffect(() => {
    if (!project.frames.some((frame) => frame.id === selectedFrameId)) setSelectedFrameId(project.frames[0]?.id);
  }, [project.frames, selectedFrameId]);

  const selectedSections = useMemo(() => analysis?.sections.filter((item) => sectionIds.has(item.id)) ?? [], [analysis, sectionIds]);
  const selectedTargets = useMemo(() => analysis?.targets.filter((item) => targetIds.has(item.id)) ?? [], [analysis, targetIds]);
  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const build = () => {
    onBuild(selectedSections, selectedTargets, profile);
    setSelectedFrameId(undefined);
    setStage('ready');
  };
  const report=useMemo(()=>captureDirectionReport(project),[project]);

  return <div className="capture-director-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="capture-director">
      <header className="capture-director-head">
        <div><span>Режиссёр захвата</span><h2>{stage === 'ready' ? 'Проверьте, что именно будет записано' : 'Соберите шоукейс страницы до записи'}</h2></div>
        <button onClick={onClose} aria-label="Закрыть"><X size={18}/></button>
      </header>
      <nav className="capture-steps" aria-label="Этапы захвата">
        <span className={analysis ? 'done' : 'active'}><b>1</b>Источник</span><i/>
        <span className={analysis ? 'done' : analyzing ? 'active' : ''}><b>2</b>Разбор страницы</span><i/>
        <span className={stage === 'ready' ? 'done' : stage === 'plan' ? 'active' : ''}><b>3</b>Сценарий</span><i/>
        <span className={stage === 'ready' ? 'active' : ''}><b>4</b>Проверка и запись</span>
      </nav>

      <div className="capture-directing-strip">
        <div><span>Ритм ролика</span><small>Меняет скорость скролла, паузы и характер курсора — результат сразу пересчитывается при сборке сценария.</small></div>
        <div className="capture-profile-picker">
          {([
            ['cinematic','Кинематографично','Спокойнее, с воздухом'],
            ['balanced','Сбалансированно','Уверенный темп для Reels'],
            ['snappy','Динамично','Коротко и энергично'],
          ] as [MotionProfile,string,string][]).map(([id,label,help])=><button key={id} className={profile===id?'active':''} onClick={()=>setProfile(id)}><strong>{label}</strong><small>{help}</small></button>)}
        </div>
        {stage==='ready'?<div className={`capture-score score-${report.score>=85?'good':report.score>=65?'ok':'weak'}`}><b>{report.score}</b><span>качество сценария<small>{report.warnings[0]??'Ритм и действия согласованы'}</small></span></div>:null}
      </div>

      {!analysis ? <CaptureSource project={project} analyzing={analyzing} onChangeUrl={onChangeUrl} onAnalyze={onAnalyze}/> : stage === 'ready' ? (
        <CaptureReview project={project} analysis={analysis} selectedFrameId={selectedFrameId} onSelectFrame={setSelectedFrameId} onChangeFrame={onChangeFrame}/>
      ) : (
        <CapturePlanner analysis={analysis} sectionIds={sectionIds} targetIds={targetIds} selectedSections={selectedSections} selectedTargets={selectedTargets} analyzing={analyzing} onToggleSection={(id) => toggle(setSectionIds, id)} onToggleTarget={(id) => toggle(setTargetIds, id)} onAnalyze={onAnalyze}/>
      )}

      {analysis ? <footer className="capture-director-actions">
        <div><span>{stage === 'ready' ? `${project.frames.length} сцен · ${project.pointer.length} действий · ${project.duration.toFixed(1)} сек` : analysis.title}</span><small>{stage === 'ready' ? 'Preview и финальный MP4 используют одну кинематику' : `${analysis.sections.length} секций · ${analysis.targets.length} интерактивных целей`}</small></div>
        {stage === 'ready' ? <>
          <button onClick={() => onPolish(profile)}><Sparkles size={14}/>Применить ритм</button>
          <button onClick={() => setStage('plan')}>Пересобрать сценарий</button>
          <button onClick={onClose}><Eye size={14}/>Открыть основной монтаж</button>
          <button className="capture-primary" onClick={onRecord} disabled={recording}>{recording ? <LoaderCircle className="spin" size={15}/> : <Play size={15}/>}Записать показанное</button>
        </> : <button className="capture-primary" disabled={selectedSections.length < 2} onClick={build}><Sparkles size={15}/>Создать сценарий без записи</button>}
      </footer> : null}
    </section>
  </div>;
};

const CaptureSource = ({project, analyzing, onChangeUrl, onAnalyze}: Pick<Props, 'project' | 'analyzing' | 'onChangeUrl' | 'onAnalyze'>) => <div className="capture-source">
  <div className="source-copy"><span><Globe2 size={16}/>Страница в браузере</span><h3>Сначала посмотрим, что находится на странице</h3><p>Быстрый разбор делает длинный снимок, находит смысловые секции, кнопки и ссылки. Видео на этом этапе не записывается.</p><label>Адрес страницы<input value={project.url} onChange={(event) => onChangeUrl(event.target.value)} placeholder="https://example.com"/></label><button className="capture-primary" disabled={analyzing || !project.url} onClick={onAnalyze}>{analyzing ? <LoaderCircle className="spin" size={16}/> : <ScanSearch size={16}/>} {analyzing ? 'Разбираем страницу…' : 'Разобрать страницу'}</button></div>
  <div className="source-diagram"><div><Globe2/><span>URL</span></div><ArrowRight/><div><ScanSearch/><span>Секции</span></div><ArrowRight/><div><Crosshair/><span>Цели</span></div><ArrowRight/><div><Video/><span>Сценарий</span></div></div>
</div>;

type PlannerProps = {analysis: CaptureAnalysis; sectionIds: Set<string>; targetIds: Set<string>; selectedSections: CaptureSection[]; selectedTargets: CaptureTarget[]; analyzing: boolean; onToggleSection: (id: string) => void; onToggleTarget: (id: string) => void; onAnalyze: () => void};
const CapturePlanner = ({analysis, sectionIds, targetIds, selectedSections, selectedTargets, analyzing, onToggleSection, onToggleTarget, onAnalyze}: PlannerProps) => <div className="capture-planner">
  <aside className="page-atlas"><div className="atlas-head"><span>Карта страницы</span><b>{analysis.pageHeight}px</b></div><div className="atlas-image"><img src={analysis.fullPageImage} alt="Полный снимок страницы"/>{analysis.sections.map((section) => <i key={section.id} className={sectionIds.has(section.id) ? 'selected' : ''} style={{top: `${section.scrollY / analysis.pageHeight * 100}%`}}/>)}</div><button onClick={onAnalyze} disabled={analyzing}><RefreshCw size={13}/>Обновить разбор</button></aside>
  <div className="capture-choices">
    <section><div className="choice-head"><div><span>Сцены</span><strong>{selectedSections.length} выбрано</strong></div><p>Каждая сцена — остановка камеры. Перемещение между ними станет скроллом.</p></div><div className="choice-list">{analysis.sections.map((section, index) => <button className={sectionIds.has(section.id) ? 'selected' : ''} key={section.id} onClick={() => onToggleSection(section.id)}><span>{sectionIds.has(section.id) ? <Check size={12}/> : String(index + 1).padStart(2, '0')}</span><div><strong>{section.label}</strong><small>{section.scrollY}px от начала</small></div></button>)}</div></section>
    <section><div className="choice-head"><div><span>Действия курсора</span><strong>{selectedTargets.length} выбрано</strong></div><p>Кнопки будут нажаты, а ссылки — аккуратно подсвечены наведением, чтобы запись случайно не ушла с нужной страницы.</p></div><div className="target-list">{analysis.targets.slice(0, 30).map((target) => <button className={targetIds.has(target.id) ? 'selected' : ''} key={target.id} onClick={() => onToggleTarget(target.id)}><span>{targetIds.has(target.id) ? <Check size={11}/> : <MousePointer2 size={11}/>}</span><div><strong>{target.label}</strong><small>{/button|tab|switch|checkbox/i.test(target.role)?'клик':'наведение'} · {target.role} · {target.selector}</small></div></button>)}</div></section>
  </div>
</div>;

type ReviewProps = {project: EditorProject; analysis: CaptureAnalysis; selectedFrameId?: string; onSelectFrame: (id: string) => void; onChangeFrame: (id: string, patch: Partial<ScrollFrame>) => void};
const CaptureReview = ({project, analysis, selectedFrameId, onSelectFrame, onChangeFrame}: ReviewProps) => {
  const frames = useMemo(() => [...project.frames].sort((a, b) => a.at - b.at), [project.frames]);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? frames[0];
  if (!selectedFrame) return <div className="capture-review-empty">Сначала создайте хотя бы одну сцену.</div>;
  return <div className="capture-review">
    <aside className="review-scene-list"><header><span>Что будет записано</span><strong>{frames.length} сцен</strong></header>{frames.map((frame, index) => <button key={frame.id} className={frame.id === selectedFrame.id ? 'selected' : ''} onClick={() => onSelectFrame(frame.id)}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{frame.label}</strong><small>{formatEditorTime(frame.at, project.fps, project.timeDisplay)} · {Math.round(scrollPercent(project, frame.scrollY) * 100)}% страницы</small></span><Eye size={13}/></button>)}</aside>
    <CaptureViewport project={project} analysis={analysis} frame={selectedFrame} onChange={(patch) => onChangeFrame(selectedFrame.id, patch)}/>
  </div>;
};

const CaptureViewport = ({project, analysis, frame, onChange}: {project: EditorProject; analysis: CaptureAnalysis; frame: ScrollFrame; onChange: (patch: Partial<ScrollFrame>) => void}) => {
  const maximum = maxScroll(project);
  const drag = useRef<{y: number; scrollY: number} | null>(null);
  const beginDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    drag.current = {y: event.clientY, scrollY: frame.scrollY};
    const move = (next: PointerEvent) => {
      if (!drag.current) return;
      onChange({scrollY:clamp(drag.current.scrollY + (drag.current.y - next.clientY) * (analysis.pageHeight / 620), 0, maximum)});
    };
    const up = () => {drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);};
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const pointers = project.pointer.filter((item) => item.at >= frame.at && item.at < frame.at + frame.duration + frame.hold);
  const livePreview=analysis.previewFrames?.reduce((nearest,candidate)=>Math.abs(candidate.scrollY-frame.scrollY)<Math.abs(nearest.scrollY-frame.scrollY)?candidate:nearest,analysis.previewFrames[0]);
  return <section className="review-canvas">
    <header><div><span>Точный viewport записи</span><strong>{frame.label}</strong></div><div><b>{project.viewport.width} × {project.viewport.height}</b><span>{Math.round(frame.scrollY)}px</span></div></header>
    <div className="browser-capture-shell">
      <div className="browser-capture-bar"><i/><i/><i/><span>{project.url}</span></div>
      <div className="browser-capture-viewport" style={{aspectRatio: `${project.viewport.width} / ${project.viewport.height}`}} onPointerDown={beginDrag} onWheel={(event) => {event.preventDefault(); onChange({scrollY:clamp(frame.scrollY + event.deltaY * 2, 0, maximum)});}}>
        <img src={analysis.fullPageImage} alt="Копия страницы для настройки захвата" draggable={false} style={{transform: `translateY(-${frame.scrollY / analysis.pageHeight * 100}%)`}}/>
        {livePreview?<img className="capture-live-preview" src={livePreview.image} alt={`Живое состояние: ${livePreview.label}`} draggable={false}/>:null}
        <div className="review-safe-frame"/>
        {pointers.map((pointer) => <i key={pointer.id} className={`review-pointer ${pointer.kind}`} style={{left: `${pointer.x / project.viewport.width * 100}%`, top: `${pointer.y / project.viewport.height * 100}%`}}><MousePointer2 size={15}/></i>)}
        <div className="review-drag-hint"><GripVertical size={14}/>Тяните страницу или прокручивайте колесом</div>
      </div>
    </div>
    <div className="review-position"><span>Начало</span><input type="range" min={0} max={maximum} step={1} value={frame.scrollY} onChange={(event) => onChange({scrollY:Number(event.target.value)})}/><span>Конец</span><b>{Math.round(scrollPercent(project, frame.scrollY) * 100)}%</b></div>
    <div className="review-timing-controls">
      <label><span>Скролл к сцене <b>{frame.duration.toFixed(2)} сек</b></span><input type="range" min={0} max={3} step={.05} value={frame.duration} onChange={(event)=>onChange({duration:Number(event.target.value)})}/></label>
      <label><span>Время на просмотр <b>{frame.hold.toFixed(2)} сек</b></span><input type="range" min={.35} max={3.5} step={.05} value={frame.hold} onChange={(event)=>onChange({hold:Number(event.target.value)})}/></label>
    </div>
    <p>Это не приблизительная миниатюра: пропорции viewport и положение страницы совпадают с Playwright-записью. Изменение сразу сохраняется в выбранную сцену.</p>
  </section>;
};
