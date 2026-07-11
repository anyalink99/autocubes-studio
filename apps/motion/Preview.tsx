import React, {useEffect, useMemo, useRef, useState} from 'react';
import {toPng} from 'html-to-image';
import {Crosshair, Download, Film, Image as ImageIcon, LayoutGrid, Maximize2} from 'lucide-react';
import {EditorProject, Selection} from '../../packages/core/editor-project';
import {findMediaPreset, formatRatio, mediaPresets} from '../../packages/core/media-presets';

type Props = {
  project: EditorProject;
  currentTime: number;
  playing: boolean;
  mode: 'storyboard' | 'capture';
  selection: Selection;
  onModeChange: (mode: 'storyboard' | 'capture') => void;
  onPickPointer: (x: number, y: number) => void;
  onChangeViewport: (viewport: EditorProject['viewport']) => void;
  onToggleGuides: () => void;
};

const ease = (value: number) => value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;

export const Preview = ({project, currentTime, playing, mode, selection, onModeChange, onPickPointer, onChangeViewport, onToggleGuides}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [exportingFrame, setExportingFrame] = useState(false);
  const sortedFrames = useMemo(() => [...project.frames].sort((a, b) => a.at - b.at), [project.frames]);
  const preset = findMediaPreset(project.viewport.width, project.viewport.height);
  const safeArea = preset?.safeArea ?? {top: 5, right: 5, bottom: 5, left: 5};

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== 'capture') return;
    const target = (project.videoOffset ?? 0) + currentTime;
    if (Math.abs(video.currentTime - target) > 0.12) video.currentTime = target;
    if (playing) void video.play();
    else video.pause();
  }, [currentTime, mode, playing, project.videoOffset]);

  const frameState = useMemo(() => {
    let current = sortedFrames[0];
    let previous = current;
    let blend = 1;
    for (let index = 0; index < sortedFrames.length; index += 1) {
      const frame = sortedFrames[index];
      if (currentTime >= frame.at) {
        previous = sortedFrames[Math.max(0, index - 1)];
        current = frame;
        blend = frame.duration === 0 ? 1 : Math.max(0, Math.min(1, (currentTime - frame.at) / frame.duration));
      }
    }
    return {current, previous, blend: ease(blend)};
  }, [currentTime, sortedFrames]);

  const pointer = useMemo(() => {
    const events = [...project.pointer].filter((event) => event.visible).sort((a, b) => a.at - b.at);
    let position = {x: project.viewport.width * 0.86, y: project.viewport.height * 0.86, visible: false, click: false};
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const previous = events[index - 1];
      if (currentTime < event.at) break;
      const end = event.at + Math.max(0.01, event.duration);
      const fromX = previous?.x ?? position.x;
      const fromY = previous?.y ?? position.y;
      if (currentTime <= end) {
        const amount = ease(Math.max(0, Math.min(1, (currentTime - event.at) / (end - event.at))));
        return {x: fromX + (event.x - fromX) * amount, y: fromY + (event.y - fromY) * amount, visible: true, click: event.kind === 'click' && currentTime > end - 0.14};
      }
      position = {x: event.x, y: event.y, visible: true, click: false};
    }
    return position;
  }, [currentTime, project.pointer, project.viewport.height, project.viewport.width]);

  const transition = project.transitions.find((item) => currentTime >= item.at && currentTime <= item.at + item.duration);
  const transitionProgress = transition ? (currentTime - transition.at) / Math.max(0.01, transition.duration) : 0;
  const transitionOpacity = transition ? Math.sin(Math.PI * transitionProgress) * transition.strength : 0;
  const caption = project.captions.find((item) => currentTime >= item.at && currentTime <= item.at + item.duration);

  const handlePick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (selection.track !== 'pointer') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onPickPointer(
      Math.round(((event.clientX - bounds.left) / bounds.width) * project.viewport.width),
      Math.round(((event.clientY - bounds.top) / bounds.height) * project.viewport.height),
    );
  };

  const exportFrame = async () => {
    const stage = stageRef.current;
    if (!stage || mode === 'capture') return;
    setExportingFrame(true);
    try {
      const dataUrl = await toPng(stage, {
        canvasWidth: project.viewport.width,
        canvasHeight: project.viewport.height,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#050505',
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('safe-zone-overlay')),
        style: {border: '0', boxShadow: 'none'},
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${project.id}-cover-${currentTime.toFixed(1).replace('.', '-')}.png`;
      link.click();
    } catch (error) {
      console.error('Could not export storyboard frame', error);
    } finally {
      setExportingFrame(false);
    }
  };

  return (
    <section className="preview-panel">
      <div className="preview-toolbar">
        <div className="segmented-control" aria-label="Preview mode">
          <button className={mode === 'storyboard' ? 'active' : ''} onClick={() => onModeChange('storyboard')}><ImageIcon size={15}/>Storyboard</button>
          <button className={mode === 'capture' ? 'active' : ''} onClick={() => onModeChange('capture')}><Film size={15}/>Capture</button>
        </div>
        <div className="preview-readout">
          {selection.track === 'pointer' ? <><Crosshair size={14}/>Click preview to set target</> : `${project.viewport.width} × ${project.viewport.height} · ${preset?.shortLabel ?? formatRatio(project.viewport.width, project.viewport.height)}`}
        </div>
        <select className="preview-format" aria-label="Output format" value={preset?.id ?? 'custom'} onChange={(event) => {const next = mediaPresets.find((item) => item.id === event.target.value); if (next) onChangeViewport({width: next.width, height: next.height});}}>
          {mediaPresets.map((item) => <option key={item.id} value={item.id}>{item.shortLabel} · {item.label}</option>)}
          {!preset ? <option value="custom">Custom</option> : null}
        </select>
        <button className={`icon-button ${project.guides !== false ? 'is-active' : ''}`} title="Toggle safe zones" onClick={onToggleGuides}><LayoutGrid size={16}/></button>
        <button className="icon-button" disabled={mode === 'capture' || exportingFrame} title={mode === 'capture' ? 'Switch to Storyboard to export a cover' : 'Export current frame as PNG'} onClick={() => void exportFrame()}><Download size={16}/></button>
        <button className="icon-button" title="Preview fits automatically"><Maximize2 size={16}/></button>
      </div>

      <div className="stage-shell">
        <div ref={stageRef} className={`stage ${selection.track === 'pointer' ? 'is-picking' : ''}`} style={{aspectRatio: `${project.viewport.width} / ${project.viewport.height}`}} onClick={handlePick}>
          {mode === 'capture' && project.previewVideo ? <video ref={videoRef} src={project.previewVideo} muted playsInline/> : (
            <>
              {frameState.previous?.thumbnail ? <img src={frameState.previous.thumbnail} alt="" style={{opacity: 1 - frameState.blend}}/> : null}
              {frameState.current?.thumbnail ? <img src={frameState.current.thumbnail} alt="" style={{opacity: frameState.blend}}/> : <div className="stage-empty">Capture a frame to start the storyboard</div>}
            </>
          )}
          {pointer.visible ? <div className={`preview-cursor ${pointer.click ? 'clicking' : ''}`} style={{left: `${(pointer.x / project.viewport.width) * 100}%`, top: `${(pointer.y / project.viewport.height) * 100}%`}}><svg viewBox="0 0 34 40" aria-hidden="true"><path d="M4 3L29 26L18 28L14 38L4 3Z"/></svg></div> : null}
          {transition ? <div className={`transition-preview transition-${transition.kind}`} style={{opacity: transitionOpacity, backdropFilter: transition.kind === 'blur' ? `blur(${transitionOpacity * 14}px)` : undefined}}/> : null}
          {caption ? <div className={`preview-caption position-${caption.position} style-${caption.style}`} style={{fontSize:`${caption.size / project.viewport.width * 100}cqw`}}>{caption.text}</div> : null}
          {project.guides !== false ? <div className="safe-zone-overlay" style={{inset: `${safeArea.top}% ${safeArea.right}% ${safeArea.bottom}% ${safeArea.left}%`}}><span>safe area</span></div> : null}
        </div>
      </div>
    </section>
  );
};
