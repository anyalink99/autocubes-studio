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
      <span>{project.frames.length} сцен</span>
      <button className={sort === 'page' ? 'active' : ''} onClick={() => setSort((value) => value === 'time' ? 'page' : 'time')} title="Сортировать по времени или странице"><ArrowDownUp size={13}/></button>
      <button className={filter === 'missing' ? 'active' : ''} onClick={() => setFilter((value) => value === 'all' ? 'missing' : 'all')} title="Показать сцены без снимков"><ListFilter size={13}/></button>
      <button onClick={() => setShowRecipes((value) => !value)} title="Создать структуру истории"><Sparkles size={13}/></button>
      <button onClick={() => onAdd()} title="Добавить сцену"><Plus size={14}/></button>
    </div>
    {showRecipes ? <div className="recipe-popover">
      <div><strong>Готовая структура</strong><button onClick={() => setShowRecipes(false)}>×</button></div>
      {([
        ['walkthrough','Обзор сайта'], ['case-study','История кейса'], ['feature-reveal','Демонстрация функции'], ['portfolio','Портфолио'], ['typography','Типографический ролик'],
      ] as [MotionRecipeId,string][]).map(([id, label]) => <button key={id} onClick={() => {onRecipe(id); setShowRecipes(false);}}><WandSparkles size={13}/><span>{label}</span></button>)}
      <small>Структура заменит текущие сцены. Изменение можно отменить.</small>
    </div> : null}
    <div className="pace-bar"><span>Темп</span><button onClick={() => onArrange('slow')}>Спокойно</button><button onClick={() => onArrange('balanced')}>Ровно</button><button onClick={() => onArrange('punchy')}>Динамично</button></div>
    <div className="shot-cards">
      {frames.map((frame, index) => <article className={`shot-card ${selectedId === frame.id ? 'selected' : ''}`} key={frame.id} onClick={() => onSelect(frame.id)}>
        <button className="shot-card-main">
          <span className="shot-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="shot-thumb">{frame.thumbnail ? <img src={frame.thumbnail} alt=""/> : <Camera size={15}/>}</span>
          <span className="shot-copy"><strong>{frame.label}</strong><small>{frame.at.toFixed(1)}s · {Math.round(scrollPercent(project, frame.scrollY) * 100)}% · {Math.round(frame.scrollY)}px</small></span>
        </button>
        <div className="shot-card-meta"><span><Gauge size={11}/>{frame.duration.toFixed(1)}с + {frame.hold.toFixed(1)}с</span>{frame.thumbnail ? <span className="captured"><CheckSquare2 size={11}/>Снимок готов</span> : <span>Нужен снимок</span>}</div>
        <div className="shot-card-actions"><button onClick={(event) => {event.stopPropagation(); onCapture(frame.id);}} title="Обновить снимок"><Camera size={12}/></button><button onClick={(event) => {event.stopPropagation(); onDuplicate(frame.id);}} title="Создать копию сцены"><Copy size={12}/></button><button onClick={(event) => {event.stopPropagation(); onDelete(frame.id);}} title="Удалить сцену"><Trash2 size={12}/></button><button title="Другие действия"><MoreHorizontal size={13}/></button></div>
      </article>)}
      {!frames.length ? <div className="shot-empty">Нет сцен по этому фильтру.<button onClick={() => setFilter('all')}>Показать все</button></div> : null}
    </div>
    <footer className="shot-summary"><span>Диапазон страницы</span><strong>0–{Math.round(maxScroll(project))} px</strong></footer>
  </div>;
};
