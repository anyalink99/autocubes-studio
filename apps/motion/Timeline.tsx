import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Captions, ChevronDown, ChevronRight, Eye, EyeOff, Flag, Layers3, Lock, Magnet, Maximize2, Music2, MousePointer2, Plus, ScanLine, Scissors, Sparkles, Unlock, ZoomIn, ZoomOut} from 'lucide-react';
import {EditorProject, Selection} from '../../packages/core/editor-project';
import {formatEditorTime, itemEnd, snapTime, TimelineTrack} from '../../packages/core/editor-operations';

type DragState = {mode: 'move' | 'resize'; track: TimelineTrack; id: string; startX: number; startScroll: number; startAt: number; startWidth: number; currentAt: number; currentWidth: number; snapAt?: number};

type Props = {
  project: EditorProject;
  currentTime: number;
  selection: Selection;
  pixelsPerSecond: number;
  onSeek: (time: number) => void;
  onSelect: (selection: Selection) => void;
  onMoveItem: (track: TimelineTrack, id: string, at: number) => void;
  onResizeItem: (track: TimelineTrack, id: string, duration: number) => void;
  onAdd: (track: TimelineTrack) => void;
  onToggleSnap: () => void;
  onZoom: (zoom: number) => void;
  onSplit: () => void;
  onAddMarker: (at: number) => void;
  onResizeHeight: (height: number) => void;
};

const trackMeta = [
  {id: 'frames' as const, label: 'Scroll', icon: ScanLine},
  {id: 'pointer' as const, label: 'Pointer', icon: MousePointer2},
  {id: 'transitions' as const, label: 'Transition', icon: Sparkles},
  {id: 'captions' as const, label: 'Captions', icon: Captions},
  {id: 'overlays' as const, label: 'Overlays', icon: Layers3},
  {id: 'audio' as const, label: 'Audio', icon: Music2},
];

export const Timeline = ({project, currentTime, selection, pixelsPerSecond, onSeek, onSelect, onMoveItem, onResizeItem, onAdd, onToggleSnap, onZoom, onSplit, onAddMarker, onResizeHeight}: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [locked, setLocked] = useState<Set<TimelineTrack>>(new Set());
  const [muted, setMuted] = useState<Set<TimelineTrack>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<TimelineTrack>>(new Set());
  const width = Math.max(project.duration * pixelsPerSecond + 160, 900);
  const selectedIds = new Set(selection.ids?.length ? selection.ids : selection.id ? [selection.id] : []);
  const rulerStep = pixelsPerSecond >= 100 ? .5 : pixelsPerSecond < 50 ? 2 : 1;
  const ruler = useMemo(() => Array.from({length: Math.floor(project.duration / rulerStep) + 1}, (_, index) => index * rulerStep), [project.duration, rulerStep]);

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<TimelineTrack>>>, track: TimelineTrack) => setter((current) => {
    const next = new Set(current);
    next.has(track) ? next.delete(track) : next.add(track);
    return next;
  });

  useEffect(() => {
    if (!drag) return;
    const initial = drag;
    let currentAt = initial.currentAt;
    let currentWidth = initial.currentWidth;
    const move = (event: PointerEvent) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        if (event.clientX > bounds.right - 34) scroller.scrollLeft += 18;
        if (event.clientX < bounds.left + 34) scroller.scrollLeft -= 18;
      }
      const delta = (event.clientX - initial.startX + (scroller?.scrollLeft ?? 0) - initial.startScroll) / pixelsPerSecond;
      if (initial.mode === 'move') currentAt = event.altKey ? Math.max(0, initial.startAt + delta) : snapTime(project, Math.max(0, initial.startAt + delta), pixelsPerSecond, initial.id);
      else {
        const end = event.altKey ? initial.startAt + initial.startWidth + delta : snapTime(project, initial.startAt + initial.startWidth + delta, pixelsPerSecond, initial.id);
        currentWidth = Math.max(1 / project.fps, Math.min(project.duration - initial.startAt, end - initial.startAt));
      }
      setDrag((current) => current ? {...current, currentAt, currentWidth, snapAt: initial.mode === 'move' ? currentAt : initial.startAt + currentWidth} : current);
    };
    const up = () => {
      if (initial.mode === 'move') onMoveItem(initial.track, initial.id, currentAt);
      else onResizeItem(initial.track, initial.id, currentWidth);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);};
  }, [drag?.id, drag?.mode, drag?.track, onMoveItem, onResizeItem, pixelsPerSecond, project]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const x = currentTime * pixelsPerSecond;
    if (x < scroller.scrollLeft + 30 || x > scroller.scrollLeft + scroller.clientWidth - 40) scroller.scrollTo({left: Math.max(0, x - scroller.clientWidth * .35), behavior: 'smooth'});
  }, [currentTime, pixelsPerSecond]);

  const seek = (event: React.MouseEvent<HTMLElement>) => {
    const canvas = event.currentTarget.closest('.timeline-canvas');
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    onSeek(snapTime(project, (event.clientX - bounds.left) / pixelsPerSecond, pixelsPerSecond));
  };

  const items = {
    frames: project.frames.map((item) => ({...item, width: item.duration + item.hold, text: `${item.label} · ${Math.round(item.scrollY)}px`})),
    pointer: project.pointer.map((item) => ({...item, width: Math.max(item.duration, .24), text: item.label})),
    transitions: project.transitions.map((item) => ({...item, width: item.duration, text: item.label})),
    captions: project.captions.map((item) => ({...item, width: item.duration, text: item.text || item.label})),
    overlays: (project.overlays ?? []).map((item) => ({...item, width: item.duration, text: item.text || item.label})),
    audio: project.audio.map((item) => ({...item, width: item.duration, text: item.label})),
  };

  const selectClip = (event: React.MouseEvent, track: TimelineTrack, id: string) => {
    event.stopPropagation();
    if (event.shiftKey && selection.track === track) {
      const ids = new Set(selection.ids ?? (selection.id ? [selection.id] : []));
      ids.has(id) ? ids.delete(id) : ids.add(id);
      onSelect({track, id, ids: [...ids]});
    } else onSelect({track, id, ids: [id]});
  };

  const beginHeightResize=(event:React.PointerEvent)=>{event.preventDefault();const startY=event.clientY;const startHeight=event.currentTarget.closest('.timeline-panel')?.getBoundingClientRect().height??368;const move=(next:PointerEvent)=>onResizeHeight(Math.max(250,Math.min(560,startHeight+startY-next.clientY)));const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);};

  return <section className="timeline-panel">
    <button className="timeline-height-handle" onPointerDown={beginHeightResize} title="Drag to resize timeline" aria-label="Resize timeline"/>
    <div className="timeline-labels">
      <div className="timeline-label-head"><span>Timeline</span><button onClick={() => onZoom(Math.max(30, pixelsPerSecond - 12))} title="Zoom out"><ZoomOut size={13}/></button><button onClick={() => onZoom(Math.min(220, pixelsPerSecond + 12))} title="Zoom in"><ZoomIn size={13}/></button><button onClick={() => onZoom(Math.max(30, (scrollerRef.current?.clientWidth ?? 900) / project.duration))} title="Fit timeline"><Maximize2 size={13}/></button><button className={project.snap !== false ? 'snap-active' : ''} onClick={onToggleSnap} title="Toggle frame and edge snapping"><Magnet size={13}/></button></div>
      {trackMeta.map(({id, label, icon: Icon}) => <div className={`track-label ${collapsed.has(id) ? 'collapsed' : ''}`} key={id}><button onClick={() => toggleSet(setCollapsed, id)} title="Collapse track">{collapsed.has(id) ? <ChevronRight size={13}/> : <ChevronDown size={13}/>}</button><Icon size={14}/><span>{label}</span><button onClick={() => toggleSet(setMuted, id)} title="Show or hide track">{muted.has(id) ? <EyeOff size={12}/> : <Eye size={12}/>}</button><button onClick={() => toggleSet(setLocked, id)} title="Lock track">{locked.has(id) ? <Lock size={12}/> : <Unlock size={12}/>}</button><button onClick={() => onAdd(id)} title={`Add ${label} at playhead`}><Plus size={13}/></button></div>)}
    </div>
    <div className="timeline-scroll" ref={scrollerRef} onWheel={(event) => {if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); onZoom(Math.max(30, Math.min(220, pixelsPerSecond - event.deltaY * .15)));}}>
      <div className="timeline-canvas" style={{width}}>
        <div className="timeline-ruler" onClick={seek} onDoubleClick={(event) => {seek(event); onAddMarker(currentTime);}}>{ruler.map((second) => <div className="ruler-mark" key={second} style={{left: second * pixelsPerSecond}}><span>{formatEditorTime(second, project.fps, project.timeDisplay)}</span></div>)}</div>
        {(project.markers ?? []).map((marker) => <button className="timeline-marker" key={marker.id} style={{left:marker.at * pixelsPerSecond, '--marker-color':marker.color ?? '#ffb35c'} as React.CSSProperties} title={`${marker.label} · ${formatEditorTime(marker.at, project.fps, project.timeDisplay)}`} onClick={() => onSeek(marker.at)}><Flag size={10}/></button>)}
        {trackMeta.map(({id}) => <div className={`timeline-track track-${id} ${collapsed.has(id) ? 'collapsed' : ''} ${muted.has(id) ? 'muted' : ''}`} key={id} onClick={seek} onDoubleClick={() => onAdd(id)}>
          {items[id].map((item) => {
            const activeDrag = drag?.track === id && drag.id === item.id ? drag : null;
            const at = activeDrag?.currentAt ?? item.at;
            const clipWidth = activeDrag?.mode === 'resize' ? activeDrag.currentWidth : item.width;
            return <button key={item.id} className={`timeline-clip ${selectedIds.has(item.id) ? 'selected' : ''} ${id === 'audio' && 'enabled' in item && !item.enabled ? 'disabled' : ''}`} style={{left:at * pixelsPerSecond, width:Math.max(16, clipWidth * pixelsPerSecond)}} onClick={(event) => selectClip(event,id,item.id)} onPointerDown={(event) => {if (locked.has(id) || event.shiftKey) return; event.preventDefault(); onSelect({track:id,id:item.id,ids:[item.id]}); setDrag({mode:'move',track:id,id:item.id,startX:event.clientX,startScroll:scrollerRef.current?.scrollLeft ?? 0,startAt:item.at,startWidth:item.width,currentAt:item.at,currentWidth:item.width});}} title={`${item.text} · ${formatEditorTime(item.at,project.fps,project.timeDisplay)} → ${formatEditorTime(itemEnd(item),project.fps,project.timeDisplay)}`}>
              <span>{item.text}</span><small>{formatEditorTime(at,project.fps,project.timeDisplay)}</small>{'beatInterval' in item && Number(item.beatInterval)>0?<div className="clip-beats">{Array.from({length:Math.floor(item.width/Number(item.beatInterval))},(_,index)=><i key={index} style={{left:`${(index+1)*Number(item.beatInterval)/item.width*100}%`}}/>)}</div>:null}<i className="clip-handle" onPointerDown={(event) => {if (locked.has(id)) return; event.stopPropagation(); event.preventDefault(); onSelect({track:id,id:item.id,ids:[item.id]}); setDrag({mode:'resize',track:id,id:item.id,startX:event.clientX,startScroll:scrollerRef.current?.scrollLeft ?? 0,startAt:item.at,startWidth:item.width,currentAt:item.at,currentWidth:item.width});}}/>
            </button>;
          })}
        </div>)}
        {(drag?.snapAt !== undefined) ? <div className="snap-guide" style={{left:drag.snapAt * pixelsPerSecond}}><span>{formatEditorTime(drag.snapAt,project.fps,project.timeDisplay)}</span></div> : null}
        <div className="playhead" style={{left:currentTime * pixelsPerSecond}}><span/></div>
      </div>
    </div>
    <div className="timeline-quick-actions"><button onClick={onSplit} title="Split selected clip at playhead"><Scissors size={13}/></button><button onClick={() => onAddMarker(currentTime)} title="Add marker at playhead"><Flag size={13}/></button></div>
  </section>;
};
