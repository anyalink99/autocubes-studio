import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ChevronDown, Music2, MousePointer2, Plus, ScanLine, Sparkles} from 'lucide-react';
import {EditorProject, Selection} from '../../packages/core/editor-project';

type TrackName = Selection['track'];

type Props = {
  project: EditorProject;
  currentTime: number;
  selection: Selection;
  pixelsPerSecond: number;
  onSeek: (time: number) => void;
  onSelect: (selection: Selection) => void;
  onMoveItem: (track: Exclude<TrackName, 'project'>, id: string, at: number) => void;
  onAdd: (track: Exclude<TrackName, 'project'>) => void;
};

const trackMeta = [
  {id: 'frames' as const, label: 'Scroll', icon: ScanLine},
  {id: 'pointer' as const, label: 'Pointer', icon: MousePointer2},
  {id: 'transitions' as const, label: 'Transition', icon: Sparkles},
  {id: 'audio' as const, label: 'Audio', icon: Music2},
];

export const Timeline = ({project, currentTime, selection, pixelsPerSecond, onSeek, onSelect, onMoveItem, onAdd}: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{track: Exclude<TrackName, 'project'>; id: string; startX: number; startAt: number; currentAt: number} | null>(null);
  const width = Math.max(project.duration * pixelsPerSecond + 120, 900);

  useEffect(() => {
    if (!drag) return;
    const initial = drag;
    let currentAt = initial.currentAt;
    const move = (event: PointerEvent) => {
      const delta = (event.clientX - initial.startX) / pixelsPerSecond;
      currentAt = Math.max(0, Math.min(project.duration - 0.05, initial.startAt + delta));
      setDrag((current) => current ? {...current, currentAt} : current);
    };
    const up = () => {
      onMoveItem(initial.track, initial.id, currentAt);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag?.id, drag?.track, onMoveItem, pixelsPerSecond, project.duration]);

  const ruler = useMemo(() => Array.from({length: Math.ceil(project.duration) + 1}, (_, index) => index), [project.duration]);

  const seek = (event: React.MouseEvent<HTMLElement>) => {
    const canvas = event.currentTarget.closest('.timeline-canvas');
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(project.duration, (event.clientX - bounds.left) / pixelsPerSecond)));
  };

  const items = {
    frames: project.frames.map((item) => ({...item, width: item.duration + item.hold, text: `${item.label} · ${Math.round(item.scrollY)}px`})),
    pointer: project.pointer.map((item) => ({...item, width: Math.max(item.duration, 0.24), text: item.label})),
    transitions: project.transitions.map((item) => ({...item, width: item.duration, text: item.label})),
    audio: project.audio.map((item) => ({...item, width: item.duration, text: item.label})),
  };

  return (
    <section className="timeline-panel">
      <div className="timeline-labels">
        <div className="timeline-label-head"><ChevronDown size={14} /> Tracks</div>
        {trackMeta.map(({id, label, icon: Icon}) => (
          <div className="track-label" key={id}>
            <Icon size={15} /><span>{label}</span>
            <button onClick={() => onAdd(id)} title={`Add ${label}`}><Plus size={14} /></button>
          </div>
        ))}
      </div>

      <div className="timeline-scroll" ref={scrollerRef}>
        <div className="timeline-canvas" style={{width}}>
          <div className="timeline-ruler" onClick={seek}>
            {ruler.map((second) => (
              <div className="ruler-mark" key={second} style={{left: second * pixelsPerSecond}}>
                <span>{second}s</span>
              </div>
            ))}
          </div>
          {trackMeta.map(({id}) => (
            <div className={`timeline-track track-${id}`} key={id} onClick={seek} onDoubleClick={() => onAdd(id)}>
              {items[id].map((item) => (
                <button
                  key={item.id}
                  className={`timeline-clip ${selection.track === id && selection.id === item.id ? 'selected' : ''} ${id === 'audio' && 'enabled' in item && !item.enabled ? 'disabled' : ''}`}
                  style={{left: (drag?.track === id && drag.id === item.id ? drag.currentAt : item.at) * pixelsPerSecond, width: Math.max(16, item.width * pixelsPerSecond)}}
                  onClick={(event) => {event.stopPropagation(); onSelect({track: id, id: item.id});}}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({track: id, id: item.id, startX: event.clientX, startAt: item.at, currentAt: item.at});
                  }}
                  title={`${item.text} · ${item.at.toFixed(2)}s`}
                >
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="playhead" style={{left: currentTime * pixelsPerSecond}}>
            <span />
          </div>
        </div>
      </div>
    </section>
  );
};
