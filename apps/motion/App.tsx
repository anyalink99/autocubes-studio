import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Copy,
  Download,
  Film,
  FolderOpen,
  Keyboard,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat2,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  WandSparkles,
  Undo2,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {captureFrame, createProject, deleteAudio, deleteProject as deleteProjectRequest, getJob, listProjects, loadAssets, loadProject, saveProject, startJob, uploadAudio} from './api';
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
  const [loadError, setLoadError] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<AssetLibrary>(emptyAssets);
  const [selection, setSelection] = useState<Selection>({track: 'project'});
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [previewMode, setPreviewMode] = useState<'storyboard' | 'capture'>('storyboard');
  const [zoom, setZoom] = useState(72);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturingFrame, setCapturingFrame] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [activePanel, setActivePanel] = useState<'shots' | 'assets'>('shots');
  const [assetQuery, setAssetQuery] = useState('');
  const [notice, setNotice] = useState<{tone: 'ok' | 'error'; message: string} | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const history = useRef<EditorProject[]>([]);
  const future = useRef<EditorProject[]>([]);
  const playbackStart = useRef({clock: 0, time: 0});
  const audioInstances = useRef<HTMLAudioElement[]>([]);
  const assetPreview = useRef<HTMLAudioElement | null>(null);
  const previousTime = useRef(0);
  const refreshedJob = useRef<string | null>(null);
  const saveFailed = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get('project') ?? undefined;
    const savedId = requestedId ?? localStorage.getItem('motion-desk-project') ?? undefined;
    void Promise.all([loadProject(savedId), loadAssets(), listProjects()]).then(([loadedProject, loadedAssets, loadedProjects]) => {
      setProject(loadedProject);
      setAssets(loadedAssets);
      setProjects(loadedProjects);
      localStorage.setItem('motion-desk-project', loadedProject.id);
    }).catch((error) => setLoadError(error instanceof Error ? error.message : 'Could not load Motion Desk'));
  }, []);

  const commit = useCallback((updater: (current: EditorProject) => EditorProject) => {
    setProject((current) => {
      if (!current) return current;
      history.current.push(clone(current));
      history.current = history.current.slice(-80);
      future.current = [];
      setDirty(true);
      saveFailed.current = false;
      revision.current += 1;
      return updater(clone(current));
    });
  }, []);

  const undo = useCallback(() => {
    setProject((current) => {
      const previous = history.current.pop();
      if (!current || !previous) return current;
      future.current.push(clone(current));
      setDirty(true);
      saveFailed.current = false;
      revision.current += 1;
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setProject((current) => {
      const next = future.current.pop();
      if (!current || !next) return current;
      history.current.push(clone(current));
      setDirty(true);
      saveFailed.current = false;
      revision.current += 1;
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!project) return false;
    setSaving(true);
    saveFailed.current = false;
    const savingRevision = revision.current;
    try {
      await saveProject(project);
      setProjects(await listProjects());
      if (savingRevision === revision.current) setDirty(false);
      setLastSavedAt(Date.now());
      setNotice({tone: 'ok', message: savingRevision === revision.current ? 'Project saved' : 'New edits are queued for autosave'});
      return savingRevision === revision.current;
    } catch (error) {
      saveFailed.current = true;
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Could not save project'});
      return false;
    } finally {
      setSaving(false);
    }
  }, [project]);

  const togglePlayback = useCallback(() => {
    setPlaying((value) => {
      if (!value && project && currentTime >= project.duration - .01) setCurrentTime(0);
      return !value;
    });
  }, [currentTime, project]);

  useEffect(() => {
    if (!dirty || saving || saveFailed.current || job?.status === 'running') return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, job?.status, project, save, saving]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.tone === 'error' ? 5000 : 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (showShortcuts) {if (event.key === 'Escape' || event.key === '?') setShowShortcuts(false); return;}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {event.preventDefault(); void save();}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {event.preventDefault(); undo();}
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {event.preventDefault(); redo();}
      if (event.code === 'Space' && !input) {event.preventDefault(); togglePlayback();}
      if (!input && event.key === 'ArrowLeft') {event.preventDefault(); setPlaying(false); setCurrentTime((time) => Math.max(0, time - (event.shiftKey ? 1 : 1 / (project?.fps ?? 30))));}
      if (!input && event.key === 'ArrowRight') {event.preventDefault(); setPlaying(false); setCurrentTime((time) => Math.min(project?.duration ?? time, time + (event.shiftKey ? 1 : 1 / (project?.fps ?? 30))));}
      if (!input && event.key === 'Home') {event.preventDefault(); setPlaying(false); setCurrentTime(0);}
      if (!input && event.key === 'End') {event.preventDefault(); setPlaying(false); setCurrentTime(project?.duration ?? 0);}
      if (!input && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'l') setLooping((value) => !value);
      if (!input && (event.key === '+' || event.key === '=')) {event.preventDefault(); setZoom((value) => Math.min(150, value + 8));}
      if (!input && event.key === '-') {event.preventDefault(); setZoom((value) => Math.max(38, value - 8));}
      if (!input && event.key === '?') {event.preventDefault(); setShowShortcuts((value) => !value);}
      if (!input && event.key === 'Escape') setShowShortcuts(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [project?.duration, project?.fps, redo, save, showShortcuts, togglePlayback, undo]);

  useEffect(() => {
    if (!project || !playing) return;
    playbackStart.current = {clock: performance.now(), time: currentTime};
    let animation = 0;
    const tick = (clock: number) => {
      const next = playbackStart.current.time + (clock - playbackStart.current.clock) / 1000;
      if (next >= project.duration) {
        if (looping) {
          audioInstances.current.forEach((audio) => audio.pause());
          audioInstances.current = [];
          playbackStart.current = {clock, time: 0};
          setCurrentTime(0);
          animation = requestAnimationFrame(tick);
          return;
        }
        setCurrentTime(project.duration);
        setPlaying(false);
        return;
      }
      setCurrentTime(next);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [looping, playing, project?.duration]);

  useEffect(() => {
    if (!project || !playing) {previousTime.current = currentTime; return;}
    const starting = Math.abs(currentTime - previousTime.current) < .001;
    const looped = currentTime < previousTime.current;
    const from = looped || starting ? currentTime - .001 : previousTime.current;
    project.audio.filter((item) => item.enabled && (starting
      ? item.at <= currentTime && item.at + item.duration > currentTime
      : item.at > from && item.at <= currentTime)).forEach((item) => {
      const audio = new Audio(item.asset);
      audio.volume = Math.min(1, item.volume);
      if (starting) audio.currentTime = Math.max(0, currentTime - item.at);
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

  useEffect(() => () => assetPreview.current?.pause(), []);

  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const timer = window.setInterval(() => {
      void getJob(job.id).then((next) => {
        setJob(next);
        if (next.status !== 'running') {
          window.clearInterval(timer);
          setNotice({tone: next.status === 'complete' ? 'ok' : 'error', message: next.status === 'complete' ? `${next.kind === 'render' ? 'MP4 render' : 'Browser capture'} complete` : `${next.kind} failed — open the job log`});
        }
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
      if (track === 'captions') draft.captions.push({id, label: 'Caption', text: 'Your message', at: currentTime, duration: 2.5, position: 'bottom', style: 'boxed', size: 54});
      if (track === 'audio') {
        const asset = selectedAsset ?? assets.audio[0] ?? '';
        draft.audio.push({id, label: asset.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Audio cue', at: currentTime, duration: 1, asset, volume: 0.3, enabled: true});
      }
      return draft;
    });
    setSelection({track, id});
  }, [assets.audio, commit, currentTime, project]);

  const importAudio = useCallback(async (file: File) => {
    setUploadingAudio(true);
    try {
      const uploaded = await uploadAudio(file);
      setAssets(await loadAssets());
      addItem('audio', uploaded.path);
      setNotice({tone: 'ok', message: `${file.name} added at the playhead`});
    } catch (error) {
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Could not import audio'});
    } finally {
      setUploadingAudio(false);
    }
  }, [addItem]);

  const removeImportedAudio = useCallback(async (asset: string) => {
    if (!window.confirm(`Remove ${asset.split('/').pop()}?`)) return;
    try {
      await deleteAudio(asset);
      setAssets(await loadAssets());
      setNotice({tone: 'ok', message: 'Imported audio removed'});
    } catch (error) {
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Could not remove audio'});
    }
  }, []);

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

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (input || showShortcuts) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {event.preventDefault(); duplicateSelected();}
      if (event.key === 'Delete' || event.key === 'Backspace') {event.preventDefault(); deleteSelected();}
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c') {event.preventDefault(); addItem('captions');}
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [addItem, deleteSelected, duplicateSelected, showShortcuts]);

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
    try {
      if (dirty && !(await save())) return;
      setJob(await startJob(kind, project.id));
      setNotice({tone: 'ok', message: kind === 'capture' ? 'Browser capture started' : 'MP4 render started'});
    } catch (error) {
      setNotice({tone: 'error', message: error instanceof Error ? error.message : `Could not start ${kind}`});
    }
  }, [dirty, project, save]);

  const autoArrangeFrames = useCallback(() => {
    commit((draft) => {
      let at = 0;
      draft.frames.sort((a, b) => a.scrollY - b.scrollY).forEach((frame) => {
        frame.at = Math.round(at * 10) / 10;
        at += frame.duration + frame.hold;
      });
      draft.duration = Math.max(draft.duration, Math.ceil(at));
      return draft;
    });
    setNotice({tone: 'ok', message: 'Frames arranged by page position'});
  }, [commit]);

  const switchProject = useCallback(async (id: string) => {
    if (dirty && !(await save())) return;
    const loaded = await loadProject(id);
    setProject(loaded);
    setSelection({track: 'project'});
    setCurrentTime(0);
    setPlaying(false);
    setDirty(false);
    history.current = [];
    future.current = [];
    revision.current = 0;
    localStorage.setItem('motion-desk-project', id);
  }, [dirty, save]);

  const addProject = useCallback(async () => {
    if (dirty && !(await save())) return;
    const created = await createProject();
    setProjects(await listProjects());
    setProject(created);
    setSelection({track: 'project'});
    setCurrentTime(0);
    setDirty(false);
    history.current = [];
    future.current = [];
    revision.current = 0;
    localStorage.setItem('motion-desk-project', created.id);
  }, [dirty, save]);

  const duplicateProject = useCallback(async () => {
    if (!project) return;
    if (dirty && !(await save())) return;
    const created = await createProject(project);
    setProjects(await listProjects());
    setProject(created);
    setSelection({track: 'project'});
    setCurrentTime(0);
    setDirty(false);
    history.current = [];
    future.current = [];
    revision.current = 0;
    localStorage.setItem('motion-desk-project', created.id);
    setNotice({tone: 'ok', message: 'Project duplicated for a new variant'});
  }, [dirty, project, save]);

  const exportProjectFile = useCallback(() => {
    if (!project) return;
    const blob = new Blob([`${JSON.stringify(project, null, 2)}\n`], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.id}.editor.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [project]);

  const importProjectFile = useCallback(async (file: File) => {
    try {
      const source = JSON.parse(await file.text()) as EditorProject;
      if (!source.title || !source.url || !source.viewport || !Array.isArray(source.frames)) throw new Error('This is not a Motion Desk project');
      const created = await createProject({...source, captions: source.captions ?? []});
      setProjects(await listProjects());
      setProject(created);
      setSelection({track:'project'});
      setCurrentTime(0);
      setDirty(false);
      history.current = [];
      future.current = [];
      revision.current = 0;
      localStorage.setItem('motion-desk-project', created.id);
      setNotice({tone:'ok', message:`${source.title} imported as a new project`});
    } catch (error) {
      setNotice({tone:'error', message:error instanceof Error ? error.message : 'Could not import project'});
    }
  }, []);

  const deleteCurrentProject = useCallback(async () => {
    if (!project) return;
    if (saving) {setNotice({tone:'error', message:'Wait for the current save to finish'}); return;}
    if (!window.confirm(`Delete “${project.title}”? This removes its timeline JSON.`)) return;
    const wasDirty = dirty;
    setDirty(false);
    try {
      await deleteProjectRequest(project.id);
      const remaining = await listProjects();
      const next = await loadProject(remaining[0]?.id);
      setProjects(remaining);
      setProject(next);
      setSelection({track:'project'});
      setCurrentTime(0);
      history.current = [];
      future.current = [];
      revision.current = 0;
      localStorage.setItem('motion-desk-project', next.id);
      setNotice({tone:'ok', message:'Project deleted'});
    } catch (error) {
      setDirty(wasDirty);
      setNotice({tone:'error', message:error instanceof Error ? error.message : 'Could not delete project'});
    }
  }, [dirty, project, saving]);

  const overlaps = useMemo(() => {
    if (!project) return 0;
    const sorted = [...project.frames].sort((a, b) => a.at - b.at);
    return sorted.filter((item, index) => index > 0 && sorted[index - 1].at + sorted[index - 1].duration + sorted[index - 1].hold > item.at + 0.01).length;
  }, [project]);

  const missingFrames = useMemo(() => project?.frames.filter((frame) => !frame.thumbnail).length ?? 0, [project]);
  const outOfBounds = useMemo(() => {
    if (!project) return 0;
    return [...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio].filter((item) => item.at < 0 || item.at + ('hold' in item ? item.duration + item.hold : item.duration) > project.duration + .01).length;
  }, [project]);

  if (!project && loadError) return <div className="loading-screen error-screen"><AlertTriangle/><strong>Motion Desk could not start</strong><span>{loadError}</span><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (!project) return <div className="loading-screen"><LoaderCircle className="spin" /> Loading Motion Desk</div>;

  return (
    <div className="editor-app">
      <header className="topbar">
        <a className="brand" href="/"><img src="/assets/brand/autocubes.svg" /><div><strong>Motion Desk</strong><span>Autocubes</span></div></a>
        <div className="project-switcher"><span className={dirty ? 'dirty-dot' : 'saved-dot'} /><select value={project.id} onFocus={() => setSelection({track: 'project'})} onChange={(event) => void switchProject(event.target.value)} aria-label="Project">{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button onClick={exportProjectFile} title="Export project JSON"><Download size={13}/></button><label className="project-file-action" title="Import project JSON"><Upload size={13}/><input type="file" accept="application/json,.json" onChange={(event) => {const file=event.target.files?.[0]; if(file) void importProjectFile(file); event.target.value='';}}/></label><button onClick={() => void duplicateProject()} title="Duplicate project"><Copy size={14}/></button><button onClick={() => void addProject()} title="New project"><Plus size={15} /></button></div>
        <div className="topbar-spacer" />
        <span className="save-state">{saving ? 'Saving…' : dirty ? 'Autosave pending' : <><CheckCircle2 size={13}/>{lastSavedAt ? 'Saved automatically' : 'Ready'}</>}</span>
        <div className="history-actions">
          <button className="icon-button" onClick={undo} disabled={!history.current.length} title="Undo"><Undo2 size={16} /></button>
          <button className="icon-button" onClick={redo} disabled={!future.current.length} title="Redo"><Redo2 size={16} /></button>
        </div>
        <button className="icon-button" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts"><Keyboard size={16}/></button>
        <button className="toolbar-button" onClick={() => void save()} disabled={saving}><Save size={16} />{saving ? 'Saving' : 'Save'}</button>
        <button className="toolbar-button" onClick={() => void runJob('capture')} disabled={job?.status === 'running'}><Film size={16} />Capture</button>
        <button className="toolbar-button primary" onClick={() => void runJob('render')} disabled={job?.status === 'running'}><Video size={16} />Export MP4</button>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className={activePanel === 'shots' ? 'active' : ''} onClick={() => setActivePanel('shots')}><FolderOpen size={15} />Shots</button>
            <button className={activePanel === 'assets' ? 'active' : ''} onClick={() => setActivePanel('assets')}><Volume2 size={15} />Audio</button>
          </div>
          {activePanel === 'shots' ? (
            <div className="shot-list">
              <div className="sidebar-section-head"><span>{project.frames.length} frames</span><div><button onClick={autoArrangeFrames} title="Arrange by page position"><WandSparkles size={14}/></button><button onClick={() => addItem('frames')} title="Add frame at playhead"><Plus size={15} /></button></div></div>
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
              <div className="sidebar-section-head"><span>{assets.audio.length} files</span><div><label className="asset-upload" title="Import audio">{uploadingAudio ? <LoaderCircle className="spin" size={13}/> : <Upload size={13}/>}<input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/aac" disabled={uploadingAudio} onChange={(event) => {const file = event.target.files?.[0]; if (file) void importAudio(file); event.target.value = '';}}/></label><button onClick={() => void loadAssets().then(setAssets)} title="Refresh"><RotateCcw size={14} /></button></div></div>
              <input className="asset-search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Filter audio…" aria-label="Filter audio"/>
              {assets.audio.filter((asset) => asset.toLowerCase().includes(assetQuery.toLowerCase())).map((asset) => <div className="asset-row" key={asset}><button onClick={() => {assetPreview.current?.pause(); const audio = new Audio(asset); audio.volume = .45; assetPreview.current = audio; void audio.play();}} title="Preview audio"><Play size={12}/></button><span>{asset.split('/').pop()}</span><div><button onClick={() => addItem('audio', asset)} title="Add at playhead"><Plus size={13}/></button>{asset.includes('/imported/') ? <button onClick={() => void removeImportedAudio(asset)} title="Remove imported audio"><Trash2 size={12}/></button> : null}</div></div>)}
            </div>
          )}
        </aside>

        <div className="center-column">
          <Preview project={project} currentTime={currentTime} playing={playing} mode={previewMode} selection={selection} onModeChange={setPreviewMode} onPickPointer={(x, y) => changeItem({x, y})} onChangeViewport={(viewport) => commit((draft) => {draft.viewport = viewport; draft.guides = true; return draft;})} onToggleGuides={() => commit((draft) => {draft.guides = draft.guides === false; return draft;})} />
          <div className="transport">
            <button className="icon-button" onClick={() => {setPlaying(false); setCurrentTime(0);}} title="Stop"><CircleStop size={17} /></button>
            <button className="play-button" onClick={togglePlayback} title="Play / pause">{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
            <button className={`icon-button ${looping ? 'is-active' : ''}`} onClick={() => setLooping((value) => !value)} title="Loop playback (L)"><Repeat2 size={15}/></button>
            <span className="timecode">{formatTime(currentTime)}</span><span className="time-divider">/</span><span className="duration-readout">{formatTime(project.duration)}</span>
            <div className="transport-spacer" />
            {overlaps || missingFrames || outOfBounds ? <span className="warning-badge"><AlertTriangle size={14}/>{[overlaps && `${overlaps} overlaps`, missingFrames && `${missingFrames} uncaptured`, outOfBounds && `${outOfBounds} outside duration`].filter(Boolean).join(' · ')}</span> : <span className="ready-badge"><CheckCircle2 size={13}/>Ready to render</span>}
            <label className="zoom-control"><span>Zoom</span><input type="range" min={38} max={150} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          </div>
        </div>

        <Inspector project={project} selection={selection} assets={assets} capturingFrame={capturingFrame} onChangeProject={(patch) => commit((draft) => Object.assign(draft, patch))} onChangeItem={changeItem} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCaptureFrame={() => void captureSelectedFrame()} onDeleteProject={() => void deleteCurrentProject()} />
      </main>

      <Timeline project={project} currentTime={currentTime} selection={selection} pixelsPerSecond={zoom} onSeek={(time) => {setPlaying(false); setCurrentTime(time);}} onSelect={setSelection} onMoveItem={(track, id, at) => {setSelection({track, id}); changeItemFor(track, id, {at});}} onResizeItem={(track, id, duration) => {setSelection({track,id}); if (track === 'frames') {const frame = project.frames.find((item) => item.id === id); changeItemFor(track,id,{hold: Math.max(0, duration - (frame?.duration ?? 0))});} else changeItemFor(track,id,{duration});}} onAdd={addItem} onToggleSnap={() => commit((draft) => {draft.snap = draft.snap === false; return draft;})} />

      {notice ? <div className={`editor-toast ${notice.tone}`}>{notice.message}</div> : null}

      {showShortcuts ? <div className="shortcut-backdrop" onClick={() => setShowShortcuts(false)}><section className="shortcut-card" onClick={(event) => event.stopPropagation()}><div><span>Motion Desk</span><h2>Keyboard shortcuts</h2><button onClick={() => setShowShortcuts(false)}><X size={15}/></button></div><dl><dt><kbd>Space</kbd></dt><dd>Play or pause</dd><dt><kbd>L</kbd></dt><dd>Toggle playback loop</dd><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Move one frame</dd><dt><kbd>Shift</kbd> + <kbd>←</kbd>/<kbd>→</kbd></dt><dd>Move one second</dd><dt><kbd>+</kbd> / <kbd>−</kbd></dt><dd>Timeline zoom</dd><dt><kbd>C</kbd></dt><dd>Add caption at playhead</dd><dt><kbd>Ctrl</kbd> + <kbd>S</kbd></dt><dd>Save now</dd><dt><kbd>Ctrl</kbd> + <kbd>Z</kbd></dt><dd>Undo</dd><dt><kbd>Ctrl</kbd> + <kbd>D</kbd></dt><dd>Duplicate selected clip</dd><dt><kbd>Delete</kbd></dt><dd>Delete selected clip</dd><dt><kbd>Home</kbd> / <kbd>End</kbd></dt><dd>Timeline start or end</dd></dl></section></div> : null}

      {job ? (
        <section className={`job-drawer ${job.status}`}>
          <div className="job-head"><span>{job.status === 'running' ? <LoaderCircle className="spin" size={15} /> : <Settings2 size={15} />}{job.kind === 'capture' ? 'Browser capture' : 'Remotion render'}</span>{job.status === 'complete' && job.outputUrl ? <a href={job.outputUrl}>Download MP4</a> : null}<strong>{job.status}</strong><button onClick={() => setJob(null)} title="Close"><X size={14} /></button></div>
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
