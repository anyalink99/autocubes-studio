import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Captions, ChevronDown, Magnet, Music2, MousePointer2, Plus, ScanLine, Sparkles} from 'lucide-react';
import {EditorProject, Selection} from '../../packages/core/editor-project';

type Track = Exclude<Selection['track'], 'project'>;
type DragState = {mode: 'move' | 'resize'; track: Track; id: string; startX: number; startScroll: number; startAt: number; startWidth: number; currentAt: number; currentWidth: number};

type Props = {
  project: EditorProject;
  currentTime: number;
  selection: Selection;
  pixelsPerSecond: number;
  onSeek: (time: number) => void;
  onSelect: (selection: Selection) => void;
  onMoveItem: (track: Track, id: string, at: number) => void;
  onResizeItem: (track: Track, id: string, duration: number) => void;
  onAdd: (track: Track) => void;
  onToggleSnap: () => void;
};

const trackMeta = [
  {id: 'frames' as const, label: 'Scroll', icon: ScanLine},
  {id: 'pointer' as const, label: 'Pointer', icon: MousePointer2},
  {id: 'transitions' as const, label: 'Transition', icon: Sparkles},
  {id: 'captions' as const, label: 'Captions', icon: Captions},
  {id: 'audio' as const, label: 'Audio', icon: Music2},
];

export const Timeline = ({project, currentTime, selection, pixelsPerSecond, onSeek, onSelect, onMoveItem, onResizeItem, onAdd, onToggleSnap}: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const width = Math.max(project.duration * pixelsPerSecond + 120, 900);
  const snap = (value: number, excludedId?: string) => {
    if (project.snap === false) return value;
    const rounded = Math.round(value * 10) / 10;
    const points = [0, currentTime, project.duration, ...[...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio]
      .filter((item) => item.id !== excludedId)
      .flatMap((item) => [item.at, item.at + ('hold' in item ? item.duration + item.hold : item.duration)])];
    const nearest = points.reduce((best, point) => Math.abs(point - value) < Math.abs(best - value) ? point : best, rounded);
    return Math.abs(nearest - value) <= Math.max(.08, 8 / pixelsPerSecond) ? nearest : rounded;
  };

  useEffect(() => {
    if (!drag) return;
    const initial = drag;
    let currentAt = initial.currentAt;
    let currentWidth = initial.currentWidth;
    const move = (event: PointerEvent) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        if (event.clientX > bounds.right - 34) scroller.scrollLeft += 14;
        if (event.clientX < bounds.left + 34) scroller.scrollLeft -= 14;
      }
      const delta = (event.clientX - initial.startX + (scroller?.scrollLeft ?? 0) - initial.startScroll) / pixelsPerSecond;
      if (initial.mode === 'move') currentAt = snap(Math.max(0, Math.min(project.duration - 0.05, initial.startAt + delta)), initial.id);
      else {
        const end = snap(Math.max(initial.startAt + .1, Math.min(project.duration, initial.startAt + initial.startWidth + delta)), initial.id);
        currentWidth = Math.max(.1, end - initial.startAt);
      }
      setDrag((current) => current ? {...current, currentAt, currentWidth} : current);
    };
    const up = () => {
      if (initial.mode === 'move') onMoveItem(initial.track, initial.id, currentAt);
      else onResizeItem(initial.track, initial.id, currentWidth);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);};
  }, [drag?.id, drag?.mode, drag?.track, onMoveItem, onResizeItem, pixelsPerSecond, project.duration, project.snap]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const x = currentTime * pixelsPerSecond;
    if (x < scroller.scrollLeft + 30 || x > scroller.scrollLeft + scroller.clientWidth - 40) scroller.scrollTo({left: Math.max(0, x - scroller.clientWidth * .35), behavior: 'smooth'});
  }, [currentTime, pixelsPerSecond]);

  const ruler = useMemo(() => Array.from({length: Math.ceil(project.duration) + 1}, (_, index) => index), [project.duration]);
  const seek = (event: React.MouseEvent<HTMLElement>) => {
    const canvas = event.currentTarget.closest('.timeline-canvas');
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    onSeek(snap(Math.max(0, Math.min(project.duration, (event.clientX - bounds.left) / pixelsPerSecond))));
  };
  const items = {
    frames: project.frames.map((item) => ({...item, width: item.duration + item.hold, text: `${item.label} · ${Math.round(item.scrollY)}px`})),
    pointer: project.pointer.map((item) => ({...item, width: Math.max(item.duration, 0.24), text: item.label})),
    transitions: project.transitions.map((item) => ({...item, width: item.duration, text: item.label})),
    captions: project.captions.map((item) => ({...item, width: item.duration, text: item.text || item.label})),
    audio: project.audio.map((item) => ({...item, width: item.duration, text: item.label})),
  };

  return <section className="timeline-panel">
    <div className="timeline-labels">
      <div className="timeline-label-head"><ChevronDown size={14}/><span>Timeline</span><button className={project.snap !== false ? 'snap-active' : ''} onClick={onToggleSnap} title="Toggle 0.1 second snapping"><Magnet size={13}/></button></div>
      {trackMeta.map(({id, label, icon: Icon}) => <div className="track-label" key={id}><Icon size={15}/><span>{label}</span><button onClick={() => onAdd(id)} title={`Add ${label} at playhead`}><Plus size={14}/></button></div>)}
    </div>
    <div className="timeline-scroll" ref={scrollerRef}>
      <div className="timeline-canvas" style={{width}}>
        <div className="timeline-ruler" onClick={seek}>{ruler.map((second) => <div className="ruler-mark" key={second} style={{left: second * pixelsPerSecond}}><span>{second}s</span></div>)}</div>
        {trackMeta.map(({id}) => <div className={`timeline-track track-${id}`} key={id} onClick={seek} onDoubleClick={() => onAdd(id)}>
          {items[id].map((item) => {
            const activeDrag = drag?.track === id && drag.id === item.id ? drag : null;
            const at = activeDrag?.currentAt ?? item.at;
            const clipWidth = activeDrag?.mode === 'resize' ? activeDrag.currentWidth : item.width;
            return <button key={item.id} className={`timeline-clip ${selection.track === id && selection.id === item.id ? 'selected' : ''} ${id === 'audio' && 'enabled' in item && !item.enabled ? 'disabled' : ''}`} style={{left: at * pixelsPerSecond, width: Math.max(16, clipWidth * pixelsPerSecond)}} onClick={(event) => {event.stopPropagation(); onSelect({track: id, id: item.id});}} onPointerDown={(event) => {event.preventDefault(); setDrag({mode:'move', track:id, id:item.id, startX:event.clientX, startScroll:scrollerRef.current?.scrollLeft ?? 0, startAt:item.at, startWidth:item.width, currentAt:item.at, currentWidth:item.width});}} title={`${item.text} · ${item.at.toFixed(2)}s`}>
              <span>{item.text}</span><i className="clip-handle" onPointerDown={(event) => {event.stopPropagation(); event.preventDefault(); onSelect({track:id,id:item.id}); setDrag({mode:'resize', track:id, id:item.id, startX:event.clientX, startScroll:scrollerRef.current?.scrollLeft ?? 0, startAt:item.at, startWidth:item.width, currentAt:item.at, currentWidth:item.width});}}/>
            </button>;
          })}
        </div>)}
        <div className="playhead" style={{left: currentTime * pixelsPerSecond}}><span/></div>
      </div>
    </div>
  </section>;
};
