import React, {useMemo, useState} from 'react';
import {ArrowDownUp, Camera, CheckSquare2, Copy, Gauge, ListFilter, MoreHorizontal, Plus, Sparkles, Trash2, WandSparkles} from 'lucide-react';
import {EditorProject, ScrollFrame} from '../../packages/core/editor-project';
import {MotionRecipeId, maxScroll, scrollPercent} from '../../packages/core/editor-operations';
import {PageMap} from './PageMap';

type Props = {
  project: EditorProject;
  selectedId?: string;
  currentTime: number;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<ScrollFrame>) => void;
  onAdd: (scrollY?: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onCapture: (id: string) => void;
  onArrange: (pace: 'slow' | 'balanced' | 'punchy') => void;
  onRecipe: (recipe: MotionRecipeId) => void;
};

export const ShotLibrary = ({project, selectedId, currentTime, onSelect, onChange, onAdd, onDuplicate, onDelete, onCapture, onArrange, onRecipe}: Props) => {
  const [sort, setSort] = useState<'time' | 'page'>('time');
  const [filter, setFilter] = useState<'all' | 'missing'>('all');
  const [showRecipes, setShowRecipes] = useState(false);
  const currentFrame = [...project.frames].sort((a, b) => a.at - b.at).reduce((active, frame) => currentTime >= frame.at ? frame : active, project.frames[0]);
  const frames = useMemo(() => [...project.frames]
    .filter((frame) => filter === 'all' || !frame.thumbnail)
    .sort((a, b) => sort === 'page' ? a.scrollY - b.scrollY : a.at - b.at), [filter, project.frames, sort]);

  return <div className="shot-library">
    <PageMap
      project={project}
      selectedId={selectedId}
      currentScrollY={currentFrame?.scrollY ?? 0}
      onSelect={onSelect}
      onChange={(id, scrollY) => onChange(id, {scrollY})}
      onAdd={onAdd}
    />
    <div className="shot-toolbar">
      <span>{project.frames.length} shots</span>
      <button className={sort === 'page' ? 'active' : ''} onClick={() => setSort((value) => value === 'time' ? 'page' : 'time')} title="Sort by time or page position"><ArrowDownUp size={13}/></button>
      <button className={filter === 'missing' ? 'active' : ''} onClick={() => setFilter((value) => value === 'all' ? 'missing' : 'all')} title="Show uncaptured shots"><ListFilter size={13}/></button>
      <button onClick={() => setShowRecipes((value) => !value)} title="Build a story from a recipe"><Sparkles size={13}/></button>
      <button onClick={() => onAdd()} title="Add shot at playhead"><Plus size={14}/></button>
    </div>
    {showRecipes ? <div className="recipe-popover">
      <div><strong>Story builder</strong><button onClick={() => setShowRecipes(false)}>×</button></div>
      {([
        ['walkthrough','Site walkthrough'], ['case-study','Case study'], ['feature-reveal','Feature reveal'], ['portfolio','Portfolio reel'], ['typography','Typography reel'],
      ] as [MotionRecipeId,string][]).map(([id, label]) => <button key={id} onClick={() => {onRecipe(id); setShowRecipes(false);}}><WandSparkles size={13}/><span>{label}</span></button>)}
      <small>Recipes replace the shot structure. Undo stays available.</small>
    </div> : null}
    <div className="pace-bar"><span>Auto pace</span><button onClick={() => onArrange('slow')}>Slow</button><button onClick={() => onArrange('balanced')}>Balanced</button><button onClick={() => onArrange('punchy')}>Punchy</button></div>
    <div className="shot-cards">
      {frames.map((frame, index) => <article className={`shot-card ${selectedId === frame.id ? 'selected' : ''}`} key={frame.id} onClick={() => onSelect(frame.id)}>
        <button className="shot-card-main">
          <span className="shot-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="shot-thumb">{frame.thumbnail ? <img src={frame.thumbnail} alt=""/> : <Camera size={15}/>}</span>
          <span className="shot-copy"><strong>{frame.label}</strong><small>{frame.at.toFixed(1)}s · {Math.round(scrollPercent(project, frame.scrollY) * 100)}% · {Math.round(frame.scrollY)}px</small></span>
        </button>
        <div className="shot-card-meta"><span><Gauge size={11}/>{frame.duration.toFixed(1)}s + {frame.hold.toFixed(1)}s</span>{frame.thumbnail ? <span className="captured"><CheckSquare2 size={11}/>Captured</span> : <span>Needs capture</span>}</div>
        <div className="shot-card-actions"><button onClick={(event) => {event.stopPropagation(); onCapture(frame.id);}} title="Capture this position"><Camera size={12}/></button><button onClick={(event) => {event.stopPropagation(); onDuplicate(frame.id);}} title="Duplicate shot"><Copy size={12}/></button><button onClick={(event) => {event.stopPropagation(); onDelete(frame.id);}} title="Delete shot"><Trash2 size={12}/></button><button title="More shot actions"><MoreHorizontal size={13}/></button></div>
      </article>)}
      {!frames.length ? <div className="shot-empty">No shots match this filter.<button onClick={() => setFilter('all')}>Show every shot</button></div> : null}
    </div>
    <footer className="shot-summary"><span>Page range</span><strong>0–{Math.round(maxScroll(project))} px</strong></footer>
  </div>;
};
