import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  CircleStop,
  Copy,
  Film,
  FolderOpen,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Undo2,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {captureFrame, createProject, getJob, listProjects, loadAssets, loadProject, saveProject, startJob} from './api';
import {Inspector} from './Inspector';
import {Preview} from './Preview';
import {Timeline} from './Timeline';
import {AssetLibrary, EditorProject, JobState, ProjectSummary, Selection} from '../../packages/core/editor-project';

const emptyAssets: AssetLibrary = {audio: [], images: [], videos: []};
const clone = <T,>(value: T): T => structuredClone(value);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}:${Math.floor((value % 1) * 100).toString().padStart(2, '0')}`;

export const App = () => {
  const [project, setProject] = useState<EditorProject | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<AssetLibrary>(emptyAssets);
  const [selection, setSelection] = useState<Selection>({track: 'project'});
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState<'storyboard' | 'capture'>('storyboard');
  const [zoom, setZoom] = useState(72);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturingFrame, setCapturingFrame] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [activePanel, setActivePanel] = useState<'shots' | 'assets'>('shots');
  const history = useRef<EditorProject[]>([]);
  const future = useRef<EditorProject[]>([]);
  const playbackStart = useRef({clock: 0, time: 0});
  const audioInstances = useRef<HTMLAudioElement[]>([]);
  const previousTime = useRef(0);
  const refreshedJob = useRef<string | null>(null);

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get('project') ?? undefined;
    const savedId = requestedId ?? localStorage.getItem('motion-desk-project') ?? undefined;
    void Promise.all([loadProject(savedId), loadAssets(), listProjects()]).then(([loadedProject, loadedAssets, loadedProjects]) => {
      setProject(loadedProject);
      setAssets(loadedAssets);
      setProjects(loadedProjects);
      localStorage.setItem('motion-desk-project', loadedProject.id);
    });
  }, []);

  const commit = useCallback((updater: (current: EditorProject) => EditorProject) => {
    setProject((current) => {
      if (!current) return current;
      history.current.push(clone(current));
      history.current = history.current.slice(-80);
      future.current = [];
      setDirty(true);
      return updater(clone(current));
    });
  }, []);

  const undo = useCallback(() => {
    setProject((current) => {
      const previous = history.current.pop();
      if (!current || !previous) return current;
      future.current.push(clone(current));
      setDirty(true);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setProject((current) => {
      const next = future.current.pop();
      if (!current || !next) return current;
      history.current.push(clone(current));
      setDirty(true);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      await saveProject(project);
      setProjects(await listProjects());
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [project]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {event.preventDefault(); void save();}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {event.preventDefault(); undo();}
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {event.preventDefault(); redo();}
      if (event.code === 'Space' && !input) {event.preventDefault(); setPlaying((value) => !value);}
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [redo, save, undo]);

  useEffect(() => {
    if (!project || !playing) return;
    playbackStart.current = {clock: performance.now(), time: currentTime};
    let animation = 0;
    const tick = (clock: number) => {
      const next = playbackStart.current.time + (clock - playbackStart.current.clock) / 1000;
      if (next >= project.duration) {
        setCurrentTime(project.duration);
        setPlaying(false);
        return;
      }
      setCurrentTime(next);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [playing, project?.duration]);

  useEffect(() => {
    if (!project || !playing) {previousTime.current = currentTime; return;}
    project.audio.filter((item) => item.enabled && item.at > previousTime.current && item.at <= currentTime).forEach((item) => {
      const audio = new Audio(item.asset);
      audio.volume = Math.min(1, item.volume);
      void audio.play();
      audioInstances.current.push(audio);
    });
    previousTime.current = currentTime;
  }, [currentTime, playing, project]);

  useEffect(() => {
    if (playing) return;
    audioInstances.current.forEach((audio) => {audio.pause();});
    audioInstances.current = [];
  }, [playing]);

  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const timer = window.setInterval(() => {
      void getJob(job.id).then((next) => {
        setJob(next);
        if (next.status !== 'running') window.clearInterval(timer);
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!job || job.status !== 'complete' || job.kind !== 'capture' || refreshedJob.current === job.id) return;
    refreshedJob.current = job.id;
    void Promise.all([loadProject(project?.id), loadAssets(), listProjects()]).then(([loadedProject, loadedAssets, loadedProjects]) => {
      setProject(loadedProject);
      setAssets(loadedAssets);
      setProjects(loadedProjects);
      setDirty(false);
      setPreviewMode('capture');
    });
  }, [job, project?.id]);

  const changeItem = useCallback((patch: Record<string, unknown>) => {
    const track = selection.track;
    if (track === 'project' || !selection.id) return;
    commit((draft) => {
      const list = draft[track];
      const index = list.findIndex((item) => item.id === selection.id);
      if (index >= 0) Object.assign(list[index], patch);
      return draft;
    });
  }, [commit, selection]);

  const addItem = useCallback((track: Exclude<Selection['track'], 'project'>, selectedAsset?: string) => {
    if (!project) return;
    const id = uid(track);
    commit((draft) => {
      if (track === 'frames') draft.frames.push({id, label: 'New frame', at: currentTime, scrollY: 0, duration: 1, hold: 1, easing: 'easeInOut', thumbnail: draft.frames[0]?.thumbnail});
      if (track === 'pointer') draft.pointer.push({id, label: 'Pointer action', at: currentTime, duration: 0.55, kind: 'move', x: draft.viewport.width / 2, y: draft.viewport.height / 2, easing: 'easeOut', visible: true});
      if (track === 'transitions') draft.transitions.push({id, label: 'Transition', at: currentTime, duration: 0.6, kind: 'fade', strength: 0.7});
      if (track === 'audio') {
        const asset = selectedAsset ?? assets.audio[0] ?? '';
        draft.audio.push({id, label: asset.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Audio cue', at: currentTime, duration: 1, asset, volume: 0.3, enabled: true});
      }
      return draft;
    });
    setSelection({track, id});
  }, [assets.audio, commit, currentTime, project]);

  const deleteSelected = useCallback(() => {
    const track = selection.track;
    if (track === 'project' || !selection.id) return;
    commit((draft) => {
      const list = draft[track];
      const index = list.findIndex((item) => item.id === selection.id);
      if (index >= 0) list.splice(index, 1);
      return draft;
    });
    setSelection({track: 'project'});
  }, [commit, selection]);

  const duplicateSelected = useCallback(() => {
    const track = selection.track;
    if (!project || track === 'project' || !selection.id) return;
    const source = project[track].find((item) => item.id === selection.id);
    if (!source) return;
    const id = uid(selection.track);
    commit((draft) => {
      const list = draft[track];
      list.push({...clone(source), id, at: Math.min(project.duration - 0.1, source.at + 0.5)} as never);
      return draft;
    });
    setSelection({track, id});
  }, [commit, project, selection]);

  const captureSelectedFrame = useCallback(async () => {
    if (!project || selection.track !== 'frames' || !selection.id) return;
    const frame = project.frames.find((item) => item.id === selection.id);
    if (!frame) return;
    setCapturingFrame(true);
    try {
      const result = await captureFrame(project, frame.id, frame.scrollY);
      commit((draft) => {
        const target = draft.frames.find((item) => item.id === frame.id);
        if (target) target.thumbnail = result.thumbnail;
        draft.pageHeight = result.pageHeight;
        return draft;
      });
      setAssets(await loadAssets());
    } finally {
      setCapturingFrame(false);
    }
  }, [commit, project, selection]);

  const runJob = useCallback(async (kind: 'capture' | 'render') => {
    if (!project) return;
    if (dirty) await save();
    setJob(await startJob(kind, project.id));
  }, [dirty, project, save]);

  const switchProject = useCallback(async (id: string) => {
    if (dirty) await save();
    const loaded = await loadProject(id);
    setProject(loaded);
    setSelection({track: 'project'});
    setCurrentTime(0);
    setPlaying(false);
    setDirty(false);
    history.current = [];
    future.current = [];
    localStorage.setItem('motion-desk-project', id);
  }, [dirty, save]);

  const addProject = useCallback(async () => {
    if (dirty) await save();
    const created = await createProject();
    setProjects(await listProjects());
    setProject(created);
    setSelection({track: 'project'});
    setCurrentTime(0);
    setDirty(false);
    history.current = [];
    future.current = [];
    localStorage.setItem('motion-desk-project', created.id);
  }, [dirty, save]);

  const overlaps = useMemo(() => {
    if (!project) return 0;
    const sorted = [...project.frames].sort((a, b) => a.at - b.at);
    return sorted.filter((item, index) => index > 0 && sorted[index - 1].at + sorted[index - 1].duration + sorted[index - 1].hold > item.at + 0.01).length;
  }, [project]);

  if (!project) return <div className="loading-screen"><LoaderCircle className="spin" /> Loading Motion Desk</div>;

  return (
    <div className="editor-app">
      <header className="topbar">
        <a className="brand" href="/"><img src="/assets/brand/autocubes.svg" /><div><strong>Motion Desk</strong><span>Autocubes</span></div></a>
        <div className="project-switcher"><span className={dirty ? 'dirty-dot' : 'saved-dot'} /><select value={project.id} onFocus={() => setSelection({track: 'project'})} onChange={(event) => void switchProject(event.target.value)} aria-label="Project">{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button onClick={() => void addProject()} title="New project"><Plus size={15} /></button></div>
        <div className="topbar-spacer" />
        <div className="history-actions">
          <button className="icon-button" onClick={undo} disabled={!history.current.length} title="Undo"><Undo2 size={16} /></button>
          <button className="icon-button" onClick={redo} disabled={!future.current.length} title="Redo"><Redo2 size={16} /></button>
        </div>
        <button className="toolbar-button" onClick={() => void save()} disabled={saving}><Save size={16} />{saving ? 'Saving' : 'Save'}</button>
        <button className="toolbar-button" onClick={() => void runJob('capture')} disabled={job?.status === 'running'}><Film size={16} />Capture</button>
        <button className="toolbar-button primary" onClick={() => void runJob('render')} disabled={job?.status === 'running'}><Video size={16} />Render</button>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className={activePanel === 'shots' ? 'active' : ''} onClick={() => setActivePanel('shots')}><FolderOpen size={15} />Shots</button>
            <button className={activePanel === 'assets' ? 'active' : ''} onClick={() => setActivePanel('assets')}><Volume2 size={15} />Audio</button>
          </div>
          {activePanel === 'shots' ? (
            <div className="shot-list">
              <div className="sidebar-section-head"><span>{project.frames.length} frames</span><button onClick={() => addItem('frames')} title="Add frame"><Plus size={15} /></button></div>
              {[...project.frames].sort((a, b) => a.at - b.at).map((frame, index) => (
                <button className={`shot-row ${selection.track === 'frames' && selection.id === frame.id ? 'selected' : ''}`} key={frame.id} onClick={() => {setSelection({track: 'frames', id: frame.id}); setCurrentTime(frame.at + frame.duration);}}>
                  <span className="shot-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="shot-thumb">{frame.thumbnail ? <img src={frame.thumbnail} /> : null}</span>
                  <span className="shot-copy"><strong>{frame.label}</strong><small>{frame.at.toFixed(1)}s · {Math.round((frame.scrollY / Math.max(1, project.pageHeight - project.viewport.height)) * 100)}%</small></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="asset-list">
              <div className="sidebar-section-head"><span>{assets.audio.length} files</span><button onClick={() => void loadAssets().then(setAssets)} title="Refresh"><RotateCcw size={14} /></button></div>
              {assets.audio.map((asset) => <button key={asset} onDoubleClick={() => addItem('audio', asset)} title="Double-click to add at playhead"><Volume2 size={14} /><span>{asset.split('/').pop()}</span></button>)}
            </div>
          )}
        </aside>

        <div className="center-column">
          <Preview project={project} currentTime={currentTime} playing={playing} mode={previewMode} selection={selection} onModeChange={setPreviewMode} onPickPointer={(x, y) => changeItem({x, y})} />
          <div className="transport">
            <button className="icon-button" onClick={() => {setPlaying(false); setCurrentTime(0);}} title="Stop"><CircleStop size={17} /></button>
            <button className="play-button" onClick={() => setPlaying((value) => !value)} title="Play / pause">{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
            <span className="timecode">{formatTime(currentTime)}</span><span className="time-divider">/</span><span className="duration-readout">{formatTime(project.duration)}</span>
            <div className="transport-spacer" />
            {overlaps ? <span className="warning-badge"><AlertTriangle size={14} />{overlaps} overlaps</span> : <span className="ready-badge">Timeline clear</span>}
            <label className="zoom-control"><span>Zoom</span><input type="range" min={38} max={150} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          </div>
        </div>

        <Inspector project={project} selection={selection} assets={assets} capturingFrame={capturingFrame} onChangeProject={(patch) => commit((draft) => Object.assign(draft, patch))} onChangeItem={changeItem} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCaptureFrame={() => void captureSelectedFrame()} />
      </main>

      <Timeline project={project} currentTime={currentTime} selection={selection} pixelsPerSecond={zoom} onSeek={(time) => {setPlaying(false); setCurrentTime(time);}} onSelect={setSelection} onMoveItem={(track, id, at) => {setSelection({track, id}); changeItemFor(track, id, {at});}} onAdd={addItem} />

      {job ? (
        <section className={`job-drawer ${job.status}`}>
          <div className="job-head"><span>{job.status === 'running' ? <LoaderCircle className="spin" size={15} /> : <Settings2 size={15} />}{job.kind === 'capture' ? 'Browser capture' : 'Remotion render'}</span><strong>{job.status}</strong><button onClick={() => setJob(null)} title="Close"><X size={14} /></button></div>
          <pre>{job.log.slice(-14).join('\n') || 'Starting…'}</pre>
        </section>
      ) : null}
    </div>
  );

  function changeItemFor(track: Exclude<Selection['track'], 'project'>, id: string, patch: Record<string, unknown>) {
    commit((draft) => {
      const item = draft[track].find((candidate) => candidate.id === id);
      if (item) Object.assign(item, patch);
      return draft;
    });
  }
};
