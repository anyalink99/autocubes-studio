import React from 'react';
import {Camera, Check, Copy, MousePointer2, Trash2} from 'lucide-react';
import {AssetLibrary, EditorProject, Selection} from '../../packages/core/editor-project';
import {findMediaPreset, formatRatio, mediaPresets} from '../../packages/core/media-presets';

type Props = {
  project: EditorProject;
  selection: Selection;
  assets: AssetLibrary;
  capturingFrame: boolean;
  onChangeProject: (patch: Partial<EditorProject>) => void;
  onChangeItem: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCaptureFrame: () => void;
  onDeleteProject: () => void;
};

const NumberField = ({label, value, min, max, step = 0.1, onChange}: {label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void}) => (
  <label className="field">
    <span>{label}</span>
    <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const TextField = ({label, value, onChange, placeholder}: {label: string; value: string; onChange: (value: string) => void; placeholder?: string}) => (
  <label className="field">
    <span>{label}</span>
    <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const TextAreaField = ({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) => (
  <label className="field"><span>{label}</span><textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)}/></label>
);

const SelectField = ({label, value, options, onChange}: {label: string; value: string; options: string[]; onChange: (value: string) => void}) => (
  <label className="field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

export const Inspector = ({project, selection, assets, capturingFrame, onChangeProject, onChangeItem, onDelete, onDuplicate, onCaptureFrame, onDeleteProject}: Props) => {
  const frameItem = selection.track === 'frames' ? project.frames.find((candidate) => candidate.id === selection.id) : undefined;
  const pointerItem = selection.track === 'pointer' ? project.pointer.find((candidate) => candidate.id === selection.id) : undefined;
  const transitionItem = selection.track === 'transitions' ? project.transitions.find((candidate) => candidate.id === selection.id) : undefined;
  const captionItem = selection.track === 'captions' ? project.captions.find((candidate) => candidate.id === selection.id) : undefined;
  const audioItem = selection.track === 'audio' ? project.audio.find((candidate) => candidate.id === selection.id) : undefined;
  const item = selection.track === 'project' ? project : frameItem ?? pointerItem ?? transitionItem ?? captionItem ?? audioItem;
  const projectChecks = [
    {label: 'Instagram canvas', ok: Boolean(findMediaPreset(project.viewport.width, project.viewport.height))},
    {label: 'All frames captured', ok: project.frames.length > 0 && project.frames.every((frame) => Boolean(frame.thumbnail))},
    {label: 'At least 30 FPS', ok: project.fps >= 30},
    {label: 'Caption clips contain text', ok: project.captions.every((caption) => Boolean(caption.text.trim()))},
    {label: 'Clips inside duration', ok: [...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio].every((entry) => entry.at + ('hold' in entry ? entry.duration + entry.hold : entry.duration) <= project.duration + .01)},
  ];

  if (!item) {
    return <aside className="inspector"><div className="inspector-empty">Select an item</div></aside>;
  }

  const title = selection.track === 'project' ? 'Project' : selection.track === 'frames' ? 'Scroll frame' : selection.track.slice(0, -1);
  const patch = (value: Record<string, unknown>) => selection.track === 'project'
    ? onChangeProject(value as Partial<EditorProject>)
    : onChangeItem(value);

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div><span>Inspector</span><strong>{title}</strong></div>
        {selection.track !== 'project' ? (
          <div className="inspector-actions">
            <button className="icon-button" title="Duplicate" onClick={onDuplicate}><Copy size={15} /></button>
            <button className="icon-button danger" title="Delete" onClick={onDelete}><Trash2 size={15} /></button>
          </div>
        ) : null}
      </div>

      <div className="inspector-body">
        {selection.track === 'project' ? (
          <>
            <section className="inspector-section">
              <div className="section-label"><span>Instagram format</span><b>{findMediaPreset(project.viewport.width, project.viewport.height)?.shortLabel ?? formatRatio(project.viewport.width, project.viewport.height)}</b></div>
              <div className="format-grid">
                {mediaPresets.map((preset) => {
                  const active = preset.width === project.viewport.width && preset.height === project.viewport.height;
                  return <button key={preset.id} className={active ? 'active' : ''} onClick={() => patch({viewport: {width: preset.width, height: preset.height}, guides: true})}><span>{preset.shortLabel}</span><strong>{preset.label}</strong>{active ? <Check size={12}/> : null}</button>;
                })}
              </div>
            </section>
            <TextField label="Title" value={project.title} onChange={(title) => patch({title})} />
            <TextField label="URL" value={project.url} onChange={(url) => patch({url})} />
            <div className="field-grid">
              <NumberField label="Duration" value={project.duration} min={1} step={0.5} onChange={(duration) => patch({duration})} />
              <NumberField label="FPS" value={project.fps} min={1} step={1} onChange={(fps) => patch({fps})} />
            </div>
            <div className="field-grid">
              <NumberField label="Width" value={project.viewport.width} min={320} step={1} onChange={(width) => patch({viewport: {...project.viewport, width}})} />
              <NumberField label="Height" value={project.viewport.height} min={320} step={1} onChange={(height) => patch({viewport: {...project.viewport, height}})} />
            </div>
            <NumberField label="Page height" value={project.pageHeight} min={project.viewport.height} step={1} onChange={(pageHeight) => patch({pageHeight})} />
            <TextField label="Capture video" value={project.previewVideo ?? ''} onChange={(previewVideo) => patch({previewVideo})} />
            <NumberField label="Video offset" value={project.videoOffset ?? 0} min={0} onChange={(videoOffset) => patch({videoOffset})} />
            <label className="toggle-field"><input type="checkbox" checked={project.guides !== false} onChange={(event) => patch({guides: event.target.checked})} /><span>Show Instagram safe zones</span></label>
            <label className="toggle-field"><input type="checkbox" checked={project.snap !== false} onChange={(event) => patch({snap: event.target.checked})} /><span>Snap clips to 0.1 seconds</span></label>
            <section className="output-checks">
              <div className="section-label"><span>Preflight</span><b>{projectChecks.filter((check) => check.ok).length}/{projectChecks.length}</b></div>
              {projectChecks.map((check) => <div className={check.ok ? 'ok' : 'pending'} key={check.label}><span>{check.ok ? '✓' : '–'}</span>{check.label}</div>)}
            </section>
            <button className="wide-button danger-button" onClick={onDeleteProject}><Trash2 size={15}/>Delete this project</button>
          </>
        ) : null}

        {frameItem ? (
          <>
            <TextField label="Label" value={frameItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <NumberField label="Start" value={frameItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
              <NumberField label="Move" value={frameItem.duration} min={0} max={project.duration} onChange={(duration) => patch({duration})} />
            </div>
            <div className="field-grid">
              <NumberField label="Hold" value={frameItem.hold} min={0} max={project.duration} onChange={(hold) => patch({hold})} />
              <NumberField label="Scroll Y" value={frameItem.scrollY} min={0} max={project.pageHeight - project.viewport.height} step={10} onChange={(scrollY) => patch({scrollY})} />
            </div>
            <label className="field range-field">
              <span>Page position <b>{Math.round((frameItem.scrollY / Math.max(1, project.pageHeight - project.viewport.height)) * 100)}%</b></span>
              <input type="range" min={0} max={Math.max(0, project.pageHeight - project.viewport.height)} step={10} value={frameItem.scrollY} onChange={(event) => patch({scrollY: Number(event.target.value)})} />
            </label>
            <SelectField label="Easing" value={frameItem.easing} options={['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring']} onChange={(easing) => patch({easing})} />
            <button className="wide-button" onClick={onCaptureFrame} disabled={capturingFrame}>
              <Camera size={16} /> {capturingFrame ? 'Capturing…' : 'Capture this position'}
            </button>
          </>
        ) : null}

        {pointerItem ? (
          <>
            <TextField label="Label" value={pointerItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <SelectField label="Action" value={pointerItem.kind} options={['move', 'hover', 'click']} onChange={(kind) => patch({kind})} />
              <NumberField label="Start" value={pointerItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
            </div>
            <div className="field-grid">
              <NumberField label="Duration" value={pointerItem.duration} min={0.05} onChange={(duration) => patch({duration})} />
              <SelectField label="Easing" value={pointerItem.easing} options={['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring']} onChange={(easing) => patch({easing})} />
            </div>
            <div className="field-grid">
              <NumberField label="X" value={pointerItem.x} min={0} max={project.viewport.width} step={1} onChange={(x) => patch({x})} />
              <NumberField label="Y" value={pointerItem.y} min={0} max={project.viewport.height} step={1} onChange={(y) => patch({y})} />
            </div>
            <TextField label="CSS selector" value={pointerItem.selector ?? ''} placeholder="Optional, preferred for capture" onChange={(selector) => patch({selector})} />
            <label className="toggle-field"><input type="checkbox" checked={pointerItem.visible} onChange={(event) => patch({visible: event.target.checked})} /><span>Show cursor</span></label>
            <div className="pick-hint"><MousePointer2 size={15} /> Click the preview to replace X and Y</div>
          </>
        ) : null}

        {transitionItem ? (
          <>
            <TextField label="Label" value={transitionItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <NumberField label="Start" value={transitionItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
              <NumberField label="Duration" value={transitionItem.duration} min={0.05} onChange={(duration) => patch({duration})} />
            </div>
            <SelectField label="Type" value={transitionItem.kind} options={['cut', 'fade', 'blur', 'dipBlack', 'dipWhite']} onChange={(kind) => patch({kind})} />
            <label className="field range-field"><span>Strength <b>{Math.round(transitionItem.strength * 100)}%</b></span><input type="range" min={0} max={1} step={0.01} value={transitionItem.strength} onChange={(event) => patch({strength: Number(event.target.value)})} /></label>
          </>
        ) : null}

        {captionItem ? (
          <>
            <TextField label="Label" value={captionItem.label} onChange={(label) => patch({label})}/>
            <TextAreaField label="On-screen text" value={captionItem.text} onChange={(text) => patch({text})}/>
            <div className="caption-tools"><span>{captionItem.text.length} characters</span><button onClick={() => patch({duration: Math.round(Math.max(1.5, captionItem.text.trim().split(/\s+/).filter(Boolean).length / 2.8) * 10) / 10})}>Fit reading time</button></div>
            <div className="field-grid"><NumberField label="Start" value={captionItem.at} min={0} max={project.duration} onChange={(at) => patch({at})}/><NumberField label="Duration" value={captionItem.duration} min={0.2} onChange={(duration) => patch({duration})}/></div>
            <div className="field-grid"><SelectField label="Position" value={captionItem.position} options={['top','center','bottom']} onChange={(position) => patch({position})}/><SelectField label="Style" value={captionItem.style} options={['clean','boxed','accent']} onChange={(style) => patch({style})}/></div>
            <label className="field range-field"><span>Text size <b>{captionItem.size}px</b></span><input type="range" min={24} max={110} step={1} value={captionItem.size} onChange={(event) => patch({size:Number(event.target.value)})}/></label>
          </>
        ) : null}

        {audioItem ? (
          <>
            <TextField label="Label" value={audioItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <NumberField label="Start" value={audioItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
              <NumberField label="Duration" value={audioItem.duration} min={0.05} onChange={(duration) => patch({duration})} />
            </div>
            <label className="field"><span>Asset</span><select value={audioItem.asset} onChange={(event) => patch({asset: event.target.value})}>{assets.audio.map((asset) => <option key={asset} value={asset}>{asset.split('/').pop()}</option>)}</select></label>
            <label className="field range-field"><span>Volume <b>{Math.round(audioItem.volume * 100)}%</b></span><input type="range" min={0} max={1.5} step={0.01} value={audioItem.volume} onChange={(event) => patch({volume: Number(event.target.value)})} /></label>
            <label className="toggle-field"><input type="checkbox" checked={audioItem.enabled} onChange={(event) => patch({enabled: event.target.checked})} /><span>Enabled</span></label>
          </>
        ) : null}
      </div>
    </aside>
  );
};
