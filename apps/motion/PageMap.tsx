import React, {useMemo, useRef, useState} from 'react';
import {Crosshair, Map, Plus} from 'lucide-react';
import {EditorProject} from '../../packages/core/editor-project';
import {clamp, maxScroll, scrollPercent} from '../../packages/core/editor-operations';

type Props = {
  project: EditorProject;
  selectedId?: string;
  currentScrollY: number;
  onSelect: (id: string) => void;
  onChange: (id: string, scrollY: number) => void;
  onAdd: (scrollY: number) => void;
};

export const PageMap = ({project, selectedId, currentScrollY, onSelect, onChange, onAdd}: Props) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const maximum = maxScroll(project);
  const viewportRatio = clamp(project.viewport.height / project.pageHeight, .045, 1);
  const sorted = useMemo(() => [...project.frames].sort((a, b) => a.scrollY - b.scrollY), [project.frames]);

  const fromPointer = (clientY: number) => {
    const bounds = railRef.current?.getBoundingClientRect();
    if (!bounds) return 0;
    const usable = Math.max(1, bounds.height * (1 - viewportRatio));
    return Math.round(clamp((clientY - bounds.top - bounds.height * viewportRatio / 2) / usable, 0, 1) * maximum);
  };

  const beginDrag = (event: React.PointerEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(id);
  };

  return <section className="page-map-panel" aria-label="Page map">
    <div className="page-map-heading"><span><Map size={13}/>Page map</span><strong>{Math.round(project.pageHeight)} px</strong></div>
    <div
      className={`page-map ${dragging ? 'is-dragging' : ''}`}
      ref={railRef}
      onDoubleClick={(event) => onAdd(fromPointer(event.clientY))}
      onPointerMove={(event) => {if (dragging) onChange(dragging, fromPointer(event.clientY));}}
      onPointerUp={(event) => {if (dragging) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(null);}}
      onPointerCancel={() => setDragging(null)}
    >
      <div className="page-map-sheet">
        {Array.from({length: 7}, (_, index) => <i key={index} style={{top: `${8 + index * 14}%`, width: `${index % 3 === 0 ? 68 : 42 + index * 3}%`}}/>)}
      </div>
      <svg className="page-map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={sorted.map((frame, index) => `${index % 2 ? 65 : 35},${8 + scrollPercent(project, frame.scrollY) * 84}`).join(' ')} />
      </svg>
      {sorted.map((frame, index) => {
        const selected = frame.id === selectedId;
        return <button
          key={frame.id}
          className={`page-map-stop ${selected ? 'selected' : ''}`}
          style={{top: `${scrollPercent(project, frame.scrollY) * (1 - viewportRatio) * 100}%`, height: `${viewportRatio * 100}%`}}
          onPointerDown={(event) => beginDrag(event, frame.id)}
          onClick={() => onSelect(frame.id)}
          title={`${frame.label}: ${Math.round(frame.scrollY)}px`}
        ><span>{String(index + 1).padStart(2, '0')}</span><b>{Math.round(scrollPercent(project, frame.scrollY) * 100)}%</b></button>;
      })}
      <div className="page-map-current" style={{top: `${scrollPercent(project, currentScrollY) * (1 - viewportRatio) * 100}%`, height: `${viewportRatio * 100}%`}}><Crosshair size={11}/></div>
      <button className="page-map-add" onClick={() => onAdd(currentScrollY)} title="Add a shot at the current page position"><Plus size={12}/></button>
    </div>
    <div className="page-map-legend"><span><i/>Viewport</span><span>Double-click to add</span></div>
  </section>;
};
