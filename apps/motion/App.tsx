import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Captions,
  CircleStop,
  Copy,
  Download,
  Film,
  FolderOpen,
  Keyboard,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat2,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import {analyzePage, captureFrame, createProject, deleteAudio, deleteProject as deleteProjectRequest, getJob, listProjects, loadAssets, loadProject, saveProject, startJob, uploadAudio} from './api';
import {Inspector} from './Inspector';
import {Preview} from './Preview';
import {Timeline} from './Timeline';
import {ShotLibrary} from './ShotLibrary';
import {CaptionLibrary} from './CaptionLibrary';
import {CaptureDirector} from './CaptureDirector';
import {AssetLibrary, CaptureSection, CaptureTarget, EditorProject, JobState, ProjectSummary, Selection} from '../../packages/core/editor-project';
import {applyRecipe, arrangeFrames, clamp, duplicateTimelineItem, formatEditorTime, migrateEditorProject, MotionRecipeId} from '../../packages/core/editor-operations';

const emptyAssets: AssetLibrary = {audio: [], images: [], videos: []};
const clone = <T,>(value: T): T => structuredClone(value);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
  const [timelineHeight, setTimelineHeight] = useState(() => Math.max(250, Math.min(560, Number(localStorage.getItem('motion-desk-timeline-height')) || 290)));
  const [previewFocus,setPreviewFocus]=useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturingFrame, setCapturingFrame] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [activePanel, setActivePanel] = useState<'shots' | 'captions' | 'assets'>('shots');
  const [assetQuery, setAssetQuery] = useState('');
  const [notice, setNotice] = useState<{tone: 'ok' | 'error'; message: string} | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [showCaptureDirector, setShowCaptureDirector] = useState(false);
  const [analyzingPage, setAnalyzingPage] = useState(false);
  const history = useRef<EditorProject[]>([]);
  const future = useRef<EditorProject[]>([]);
  const playbackStart = useRef({clock: 0, time: 0});
  const audioInstances = useRef<HTMLAudioElement[]>([]);
  const assetPreview = useRef<HTMLAudioElement | null>(null);
  const previousTime = useRef(0);
  const refreshedJob = useRef<string | null>(null);
  const saveFailed = useRef(false);
  const revision = useRef(0);
  const lastCommit = useRef<{key?:string; at:number}>({at:0});
  const clipboard = useRef<{track:Exclude<Selection['track'],'project'>; item:Record<string,unknown>&{id:string;at:number}}|null>(null);

  useEffect(() => {
    const requestedId = new URLSearchParams(window.location.search).get('project') ?? undefined;
    const savedId = requestedId ?? localStorage.getItem('motion-desk-project') ?? undefined;
    void Promise.all([loadProject(savedId), loadAssets(), listProjects()]).then(([loadedProject, loadedAssets, loadedProjects]) => {
      setProject(loadedProject);
      setAssets(loadedAssets);
      setProjects(loadedProjects);
      localStorage.setItem('motion-desk-project', loadedProject.id);
    }).catch((error) => setLoadError(error instanceof Error ? error.message : 'Не удалось открыть Motion Desk'));
  }, []);

  const commit = useCallback((updater: (current: EditorProject) => EditorProject, coalesceKey?: string) => {
    setProject((current) => {
      if (!current) return current;
      const now = performance.now();
      const coalesced = Boolean(coalesceKey && lastCommit.current.key === coalesceKey && now - lastCommit.current.at < 650);
      if (!coalesced) {
        history.current.push(clone(current));
        history.current = history.current.slice(-80);
      }
      lastCommit.current = {key:coalesceKey,at:now};
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
      setNotice({tone: 'ok', message: savingRevision === revision.current ? 'Проект сохранён' : 'Новые изменения ожидают автосохранения'});
      return savingRevision === revision.current;
    } catch (error) {
      saveFailed.current = true;
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Не удалось сохранить проект'});
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
      const next = playbackStart.current.time + (clock - playbackStart.current.clock) / 1000 * (project.playbackRate ?? 1);
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
      audio.volume = Math.min(1, item.volume * (project.masterVolume ?? 1));
      audio.playbackRate = project.playbackRate ?? 1;
      audio.loop = item.loop ?? false;
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
          setNotice({tone: next.status === 'complete' ? 'ok' : 'error', message: next.status === 'complete' ? `${next.kind === 'render' ? 'MP4' : 'Запись браузера'} готова` : 'Задача завершилась ошибкой — откройте журнал'});
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
      if (!list) return draft;
      const index = list.findIndex((item) => item.id === selection.id);
      if (index >= 0) Object.assign(list[index], patch);
      return draft;
    }, `${track}:${selection.id}:${Object.keys(patch).sort().join(',')}`);
  }, [commit, selection]);

  const addItem = useCallback((track: Exclude<Selection['track'], 'project'>, selectedAsset?: string) => {
    if (!project) return;
    const id = uid(track);
    commit((draft) => {
      if (track === 'frames') draft.frames.push({id, label: 'New frame', at: currentTime, scrollY: 0, duration: 1, hold: 1, easing: 'easeInOut', thumbnail: draft.frames[0]?.thumbnail});
      if (track === 'pointer') draft.pointer.push({id, label: 'Действие курсора', at: currentTime, duration: 0.55, kind: 'move', x: draft.viewport.width / 2, y: draft.viewport.height / 2, easing: 'easeOut', visible: true});
      if (track === 'transitions') draft.transitions.push({id, label: 'Смена сцены', at: currentTime, duration: 0.6, kind: 'fade', strength: 0.7});
      if (track === 'captions') draft.captions.push({id, label: 'Текст', text: draft.outputLanguage==='ru'?'Ваше сообщение':'Your message', textEn:'Your message', textRu:'Ваше сообщение', at: currentTime, duration: 2.5, position: 'bottom', style: 'boxed', size: 54});
      if (track === 'audio') {
        const asset = selectedAsset ?? assets.audio[0] ?? '';
        draft.audio.push({id, label: asset.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Звуковой акцент', at: currentTime, duration: 1, asset, volume: 0.3, enabled: true, fadeIn:0, fadeOut:0, category:'sfx', beatInterval:0});
      }
      if (track === 'overlays') draft.overlays?.push({id, label: 'Метка студии', text: 'AUTOCUBES', textEn:'AUTOCUBES', textRu:'АВТОКУБЫ', at: currentTime, duration: 2.5, kind: 'label', x: 8, y: 8, scale: 1, opacity: 1, color: '#ffffff'});
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
      setNotice({tone: 'ok', message: `${file.name} добавлен в текущий момент`});
    } catch (error) {
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Не удалось импортировать звук'});
    } finally {
      setUploadingAudio(false);
    }
  }, [addItem]);

  const removeImportedAudio = useCallback(async (asset: string) => {
    if (!window.confirm(`Удалить ${asset.split('/').pop()}?`)) return;
    try {
      await deleteAudio(asset);
      setAssets(await loadAssets());
      setNotice({tone: 'ok', message: 'Импортированный звук удалён'});
    } catch (error) {
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Не удалось удалить звук'});
    }
  }, []);

  const deleteSelected = useCallback(() => {
    const track = selection.track;
    if (track === 'project' || !selection.id) return;
    const ids = new Set(selection.ids?.length ? selection.ids : [selection.id]);
    commit((draft) => {
      const list = draft[track];
      if (!list) return draft;
      for (let index = list.length - 1; index >= 0; index -= 1) if (ids.has(list[index].id)) list.splice(index, 1);
      return draft;
    });
    setSelection({track: 'project'});
  }, [commit, selection]);

  const splitSelected = useCallback(() => {
    const track = selection.track;
    if (track === 'project' || !selection.id) return;
    commit((draft) => {
      const list = draft[track] as Array<Record<string, unknown> & {id:string; at:number; duration:number; hold?:number}> | undefined;
      const source = list?.find((item) => item.id === selection.id);
      if (!list || !source) return draft;
      const end = source.at + source.duration + (source.hold ?? 0);
      if (currentTime <= source.at + 1 / draft.fps || currentTime >= end - 1 / draft.fps) return draft;
      const next = clone(source);
      next.id = uid(track);
      next.at = currentTime;
      if (track === 'frames') {
        const firstLength = currentTime - source.at;
        const secondLength = end - currentTime;
        source.duration = Math.min(source.duration, firstLength);
        source.hold = Math.max(0, firstLength - source.duration);
        next.duration = Math.min(Number(next.duration), secondLength);
        next.hold = Math.max(0, secondLength - next.duration);
      } else {
        next.duration = end - currentTime;
        source.duration = currentTime - source.at;
      }
      list.push(next);
      return draft;
    });
    setNotice({tone:'ok', message:'Элемент разрезан в текущем моменте'});
  }, [commit, currentTime, selection]);

  const addMarker = useCallback((at: number) => commit((draft) => {
    draft.markers ??= [];
    draft.markers.push({id:uid('marker'), label:`Marker ${draft.markers.length + 1}`, at, color:'#ffb35c'});
    return draft;
  }), [commit]);

  const duplicateSelected = useCallback(() => {
    const track = selection.track;
    if (!project || track === 'project' || !selection.id) return;
    const source = project[track]?.find((item) => item.id === selection.id);
    if (!source) return;
    const id = uid(selection.track);
    commit((draft) => {
      return duplicateTimelineItem(draft, selection, id);
    });
    setSelection({track, id});
  }, [commit, project, selection]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (input || showShortcuts) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {event.preventDefault(); duplicateSelected();}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selection.track !== 'project' && selection.id && project) {
        const item=project[selection.track]?.find((candidate)=>candidate.id===selection.id);
        if(item){event.preventDefault();clipboard.current={track:selection.track,item:clone(item) as Record<string,unknown>&{id:string;at:number}};setNotice({tone:'ok',message:'Элемент скопирован'});}
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboard.current) {
        event.preventDefault(); const source=clipboard.current; const id=uid(source.track);
        commit((draft)=>{const list=draft[source.track]; if(list) list.push({...clone(source.item),id,at:currentTime} as never); return draft;});
        setSelection({track:source.track,id,ids:[id]}); setNotice({tone:'ok',message:'Элемент вставлен в текущий момент'});
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {event.preventDefault(); deleteSelected();}
      if (event.key === 'Escape') setSelection({track:'project'});
      if (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey) {event.preventDefault();splitSelected();}
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c') {event.preventDefault(); addItem('captions');}
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [addItem, commit, currentTime, deleteSelected, duplicateSelected, project, selection, showShortcuts, splitSelected]);

  const captureFrameById = useCallback(async (frameId: string) => {
    if (!project) return;
    const frame = project.frames.find((item) => item.id === frameId);
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
  }, [commit, project]);

  const captureSelectedFrame = useCallback(async () => {
    if (selection.track === 'frames' && selection.id) await captureFrameById(selection.id);
  }, [captureFrameById, selection]);

  const runJob = useCallback(async (kind: 'capture' | 'render') => {
    if (!project) return;
    try {
      if (dirty && !(await save())) return;
      setJob(await startJob(kind, project.id));
      setNotice({tone: 'ok', message: kind === 'capture' ? 'Запись браузера началась' : 'Сборка MP4 началась'});
    } catch (error) {
      setNotice({tone: 'error', message: error instanceof Error ? error.message : 'Не удалось запустить задачу'});
    }
  }, [dirty, project, save]);

  const analyzeCaptureSource = useCallback(async () => {
    if (!project) return;
    setAnalyzingPage(true);
    try {
      const analysis=await analyzePage(project);
      commit((draft)=>{draft.captureAnalysis=analysis;draft.pageHeight=analysis.pageHeight;return draft;});
      setNotice({tone:'ok',message:`Страница разобрана: ${analysis.sections.length} секций и ${analysis.targets.length} целей`});
    } catch(error) {
      setNotice({tone:'error',message:error instanceof Error?error.message:'Не удалось разобрать страницу'});
    } finally {setAnalyzingPage(false);}
  },[commit,project]);

  const buildCapturePlan=useCallback((sections:CaptureSection[],targets:CaptureTarget[])=>{
    if(!project)return;
    commit((draft)=>{
      const ordered=[...sections].sort((a,b)=>a.scrollY-b.scrollY);
      draft.frames=ordered.map((section,index)=>({id:`scene-${Date.now()}-${index}`,label:section.label,at:0,scrollY:section.scrollY,duration:index===0?0:.9,hold:1.1,easing:'easeInOut'}));
      arrangeFrames(draft,'balanced');
      draft.pointer=targets.map((target,index)=>{
        const section=ordered.reduce((nearest,candidate)=>Math.abs(candidate.scrollY-target.pageY)<Math.abs(nearest.scrollY-target.pageY)?candidate:nearest,ordered[0]);
        const scene=draft.frames[ordered.indexOf(section)];
        return {id:`cursor-${Date.now()}-${index}`,label:target.label,targetLabel:target.label,at:Math.min(draft.duration-.2,scene.at+scene.duration+Math.min(.55,scene.hold*.45)),duration:.5,kind:'click',x:clamp(target.x,20,draft.viewport.width-20),y:clamp(target.pageY-section.scrollY,20,draft.viewport.height-20),selector:target.selector,easing:'easeOut',visible:true,clickEffect:'ring'};
      });
      draft.transitions=[{id:`transition-finish-${Date.now()}`,label:'Мягкое завершение',at:Math.max(0,draft.duration-.7),duration:.7,kind:'fade',strength:.82}];
      return draft;
    });
    setCurrentTime(0);setSelection({track:'frames'});setPreviewMode('storyboard');
    setNotice({tone:'ok',message:'Сценарий готов. Проверьте сцены и курсор до записи.'});
  },[commit,project]);

  const autoArrangeFrames = useCallback((pace: 'slow' | 'balanced' | 'punchy' = 'balanced') => {
    commit((draft) => arrangeFrames(draft, pace));
    setNotice({tone: 'ok', message: `Сцены расставлены, темп: ${pace}`});
  }, [commit]);

  const applyMotionRecipe = useCallback((recipe: MotionRecipeId) => {
    commit((draft) => applyRecipe(draft, recipe));
    setSelection({track: 'frames'});
    setCurrentTime(0);
    setNotice({tone: 'ok', message: 'Структура истории создана. Каждую сцену можно изменить.'});
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
    setNotice({tone: 'ok', message: 'Создана копия проекта'});
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
      const source = migrateEditorProject(JSON.parse(await file.text()) as EditorProject);
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
      setNotice({tone:'ok', message:`${source.title} импортирован как новый проект`});
    } catch (error) {
      setNotice({tone:'error', message:error instanceof Error ? error.message : 'Не удалось импортировать проект'});
    }
  }, []);

  const deleteCurrentProject = useCallback(async () => {
    if (!project) return;
    if (saving) {setNotice({tone:'error', message:'Дождитесь завершения сохранения'}); return;}
    if (!window.confirm(`Удалить «${project.title}»? JSON монтажа также будет удалён.`)) return;
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
      setNotice({tone:'ok', message:'Проект удалён'});
    } catch (error) {
      setDirty(wasDirty);
      setNotice({tone:'error', message:error instanceof Error ? error.message : 'Не удалось удалить проект'});
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
    return [...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio, ...(project.overlays ?? [])].filter((item) => item.at < 0 || item.at + ('hold' in item ? item.duration + item.hold : item.duration) > project.duration + .01).length;
  }, [project]);

  if (!project && loadError) return <div className="loading-screen error-screen"><AlertTriangle/><strong>Motion Desk не запустился</strong><span>{loadError}</span><button onClick={() => window.location.reload()}>Повторить</button></div>;
  if (!project) return <div className="loading-screen"><LoaderCircle className="spin" /> Загружаем Motion Desk</div>;

  return (
    <div className={`editor-app ${previewFocus?'preview-focus':''}`} style={{gridTemplateRows:`54px minmax(0,1fr) ${previewFocus?0:timelineHeight}px`}}>
      <header className="topbar">
        <a className="brand" href="/"><img src="/assets/brand/autocubes.svg" /><div><strong>Motion Desk</strong><span>Autocubes</span></div></a>
        <div className="project-switcher"><span className={dirty ? 'dirty-dot' : 'saved-dot'} /><select value={project.id} onFocus={() => setSelection({track: 'project'})} onChange={(event) => void switchProject(event.target.value)} aria-label="Проект">{projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button onClick={exportProjectFile} title="Экспорт JSON проекта"><Download size={13}/></button><label className="project-file-action" title="Импорт JSON проекта"><Upload size={13}/><input type="file" accept="application/json,.json" onChange={(event) => {const file=event.target.files?.[0]; if(file) void importProjectFile(file); event.target.value='';}}/></label><button onClick={() => void duplicateProject()} title="Создать копию проекта"><Copy size={14}/></button><button onClick={() => void addProject()} title="Новый проект"><Plus size={15} /></button></div>
        <div className="topbar-spacer" />
        <span className="save-state">{saving ? 'Сохраняем…' : dirty ? 'Ожидает автосохранения' : <><CheckCircle2 size={13}/>{lastSavedAt ? 'Сохранено автоматически' : 'Готово'}</>}</span>
        <div className="history-actions">
          <button className="icon-button" onClick={undo} disabled={!history.current.length} title="Отменить"><Undo2 size={16} /></button>
          <button className="icon-button" onClick={redo} disabled={!future.current.length} title="Повторить"><Redo2 size={16} /></button>
        </div>
        <button className="icon-button" onClick={() => setShowShortcuts(true)} title="Горячие клавиши"><Keyboard size={16}/></button>
        <button className={`icon-button ${previewFocus?'is-active':''}`} onClick={()=>setPreviewFocus((value)=>!value)} title="Большое превью"><Maximize2 size={16}/></button>
        <button className="toolbar-button" onClick={() => void save()} disabled={saving}><Save size={16} />{saving ? 'Сохраняем' : 'Сохранить'}</button>
        <button className="toolbar-button" onClick={() => setShowCaptureDirector(true)} disabled={job?.status === 'running'} title="Настроить и проверить будущую запись"><Film size={16} />{project.captureAnalysis && project.frames.length ? 'Проверить захват' : 'Настроить захват'}</button>
        <button className="toolbar-button primary" onClick={() => void runJob('render')} disabled={job?.status === 'running'}><Video size={16} />Экспорт MP4</button>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button className={activePanel === 'shots' ? 'active' : ''} onClick={() => setActivePanel('shots')}><FolderOpen size={15} />Сцены</button>
            <button className={activePanel === 'captions' ? 'active' : ''} onClick={() => setActivePanel('captions')}><Captions size={15}/>Текст</button>
            <button className={activePanel === 'assets' ? 'active' : ''} onClick={() => setActivePanel('assets')}><Volume2 size={15} />Звук</button>
          </div>
          {activePanel === 'shots' ? (
            <ShotLibrary
              project={project}
              selectedId={selection.track === 'frames' ? selection.id : undefined}
              currentTime={currentTime}
              onSelect={(id) => {const frame = project.frames.find((item) => item.id === id); setSelection({track: 'frames', id}); if (frame) setCurrentTime(frame.at + frame.duration);}}
              onChange={(id, patch) => changeItemFor('frames', id, patch)}
              onAdd={(scrollY) => {const id = uid('frames'); commit((draft) => {draft.frames.push({id, label: `Сцена ${draft.frames.length + 1}`, at: currentTime, scrollY: scrollY ?? draft.frames.find((item) => currentTime >= item.at)?.scrollY ?? 0, duration: .8, hold: 1, easing: 'easeInOut', thumbnail: draft.frames[0]?.thumbnail}); return draft;}); setSelection({track:'frames', id});}}
              onDuplicate={(id) => {setSelection({track:'frames', id}); const source = project.frames.find((item) => item.id === id); if (!source) return; const nextId = uid('frames'); commit((draft) => duplicateTimelineItem(draft, {track:'frames', id}, nextId)); setSelection({track:'frames', id:nextId});}}
              onDelete={(id) => {commit((draft) => {draft.frames = draft.frames.filter((item) => item.id !== id); return draft;}); if (selection.id === id) setSelection({track:'project'});}}
              onCapture={(id) => void captureFrameById(id)}
              onArrange={autoArrangeFrames}
              onRecipe={applyMotionRecipe}
            />
          ) : activePanel === 'captions' ? <CaptionLibrary project={project} currentTime={currentTime} selectedId={selection.track==='captions'?selection.id:undefined} onSelect={(id)=>{const caption=project.captions.find((item)=>item.id===id);setSelection({track:'captions',id,ids:[id]});if(caption)setCurrentTime(caption.at);}} onImport={(captions)=>commit((draft)=>{draft.captions.push(...captions); draft.duration=Math.max(draft.duration,...captions.map((item)=>item.at+item.duration)); return draft;})}/> : (
            <div className="asset-list">
              <div className="sidebar-section-head"><span>{assets.audio.length} файлов</span><div><label className="asset-upload" title="Импортировать звук">{uploadingAudio ? <LoaderCircle className="spin" size={13}/> : <Upload size={13}/>}<input type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/aac" disabled={uploadingAudio} onChange={(event) => {const file = event.target.files?.[0]; if (file) void importAudio(file); event.target.value = '';}}/></label><button onClick={() => void loadAssets().then(setAssets)} title="Обновить библиотеку"><RotateCcw size={14} /></button></div></div>
              <input className="asset-search" value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Найти звук…" aria-label="Поиск звука"/>
              {assets.audio.filter((asset) => asset.toLowerCase().includes(assetQuery.toLowerCase())).map((asset) => <div className="asset-row" key={asset}><button onClick={() => {assetPreview.current?.pause(); const audio = new Audio(asset); audio.volume = .45; assetPreview.current = audio; void audio.play();}} title="Прослушать"><Play size={12}/></button><span>{asset.split('/').pop()}</span><div><button onClick={() => addItem('audio', asset)} title="Добавить в текущий момент"><Plus size={13}/></button>{asset.includes('/imported/') ? <button onClick={() => void removeImportedAudio(asset)} title="Удалить импортированный файл"><Trash2 size={12}/></button> : null}</div></div>)}
            </div>
          )}
        </aside>

        <div className="center-column">
          <Preview project={project} currentTime={currentTime} playing={playing} mode={previewMode} selection={selection} onModeChange={setPreviewMode} onPickPointer={(x, y) => changeItem({x, y})} onChangeViewport={(viewport) => commit((draft) => {draft.viewport = viewport; draft.guides = true; return draft;})} onToggleGuides={() => commit((draft) => {draft.guides = draft.guides === false; return draft;})} onChangeFramePosition={(scrollY) => changeItem({scrollY})} />
          <div className="transport">
            <button className="icon-button" onClick={() => {setPlaying(false); setCurrentTime(0);}} title="В начало"><CircleStop size={17} /></button>
            <button className="play-button" onClick={togglePlayback} title="Воспроизвести или поставить на паузу">{playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}</button>
            <button className={`icon-button ${looping ? 'is-active' : ''}`} onClick={() => setLooping((value) => !value)} title="Повторять воспроизведение (L)"><Repeat2 size={15}/></button>
            <span className="timecode">{formatEditorTime(currentTime, project.fps, project.timeDisplay)}</span><span className="time-divider">/</span><span className="duration-readout">{formatEditorTime(project.duration, project.fps, project.timeDisplay)}</span>
            <div className="transport-spacer" />
            {overlaps || missingFrames || outOfBounds ? <span className="warning-badge"><AlertTriangle size={14}/>{[overlaps && `${overlaps} пересечений`, missingFrames && `${missingFrames} сцен без снимка`, outOfBounds && `${outOfBounds} элементов вне ролика`].filter(Boolean).join(' · ')}</span> : <span className="ready-badge"><CheckCircle2 size={13}/>Готово к экспорту</span>}
            <label className="zoom-control"><span>Масштаб</span><input type="range" min={38} max={150} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
            <select className="playback-rate" value={project.playbackRate ?? 1} onChange={(event) => commit((draft) => {draft.playbackRate=Number(event.target.value); return draft;})} aria-label="Скорость воспроизведения"><option value={.25}>0.25×</option><option value={.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
          </div>
        </div>

        <Inspector project={project} selection={selection} assets={assets} capturingFrame={capturingFrame} onChangeProject={(patch) => commit((draft) => Object.assign(draft, patch))} onChangeItem={changeItem} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCaptureFrame={() => void captureSelectedFrame()} onDeleteProject={() => void deleteCurrentProject()} />
      </main>

      <Timeline project={project} currentTime={currentTime} selection={selection} pixelsPerSecond={zoom} onSeek={(time) => {setPlaying(false); setCurrentTime(time);}} onSelect={setSelection} onMoveItem={(track, id, at) => {setSelection({track, id, ids:[id]}); changeItemFor(track, id, {at});}} onResizeItem={(track, id, duration) => {setSelection({track,id,ids:[id]}); if (track === 'frames') {const frame = project.frames.find((item) => item.id === id); changeItemFor(track,id,{hold: Math.max(0, duration - (frame?.duration ?? 0))});} else changeItemFor(track,id,{duration});}} onAdd={addItem} onToggleSnap={() => commit((draft) => {draft.snap = draft.snap === false; return draft;})} onZoom={setZoom} onSplit={splitSelected} onAddMarker={addMarker} onResizeHeight={(height)=>{setTimelineHeight(height);localStorage.setItem('motion-desk-timeline-height',String(height));}} />

      {notice ? <div className={`editor-toast ${notice.tone}`}>{notice.message}</div> : null}
      {showCaptureDirector?<CaptureDirector project={project} analysis={project.captureAnalysis} analyzing={analyzingPage} recording={job?.status==='running'&&job.kind==='capture'} onChangeUrl={(url)=>commit((draft)=>{draft.url=url;draft.captureAnalysis=undefined;return draft;})} onAnalyze={()=>void analyzeCaptureSource()} onBuild={buildCapturePlan} onChangeFrame={(id,scrollY)=>commit((draft)=>{const frame=draft.frames.find((item)=>item.id===id);if(frame)frame.scrollY=clamp(scrollY,0,Math.max(0,draft.pageHeight-draft.viewport.height));return draft;},`capture-frame:${id}`)} onRecord={()=>{setShowCaptureDirector(false);void runJob('capture');}} onClose={()=>setShowCaptureDirector(false)}/>:null}

      {showShortcuts ? <div className="shortcut-backdrop" onClick={() => setShowShortcuts(false)}><section className="shortcut-card" onClick={(event) => event.stopPropagation()}><div><span>Motion Desk</span><h2>Горячие клавиши</h2><button onClick={() => setShowShortcuts(false)}><X size={15}/></button></div><dl><dt><kbd>Space</kbd></dt><dd>Воспроизведение или пауза</dd><dt><kbd>L</kbd></dt><dd>Повторять ролик</dd><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Сдвиг на один кадр</dd><dt><kbd>Shift</kbd> + <kbd>←</kbd>/<kbd>→</kbd></dt><dd>Сдвиг на секунду</dd><dt><kbd>+</kbd> / <kbd>−</kbd></dt><dd>Масштаб монтажа</dd><dt><kbd>C</kbd></dt><dd>Добавить текст</dd><dt><kbd>S</kbd></dt><dd>Разрезать элемент</dd><dt><kbd>Ctrl</kbd> + <kbd>C</kbd>/<kbd>V</kbd></dt><dd>Копировать или вставить</dd><dt><kbd>Ctrl</kbd> + <kbd>S</kbd></dt><dd>Сохранить</dd><dt><kbd>Ctrl</kbd> + <kbd>Z</kbd></dt><dd>Отменить</dd><dt><kbd>Ctrl</kbd> + <kbd>D</kbd></dt><dd>Создать копию элемента</dd><dt><kbd>Delete</kbd></dt><dd>Удалить выбранное</dd><dt><kbd>Home</kbd> / <kbd>End</kbd></dt><dd>Начало или конец ролика</dd></dl></section></div> : null}

      {job ? (
        <section className={`job-drawer ${job.status}`}>
          <div className="job-head"><span>{job.status === 'running' ? <LoaderCircle className="spin" size={15} /> : <Settings2 size={15} />}{job.kind === 'capture' ? 'Запись браузера' : 'Сборка видео'}</span>{job.status === 'complete' && job.outputUrl ? <a href={job.outputUrl}>Скачать MP4</a> : null}<strong>{job.status === 'running'?'в работе':job.status === 'complete'?'готово':'ошибка'}</strong><button onClick={() => setJob(null)} title="Закрыть"><X size={14} /></button></div>
          <pre>{job.log.slice(-14).join('\n') || 'Запускаем…'}</pre>
        </section>
      ) : null}
    </div>
  );

  function changeItemFor(track: Exclude<Selection['track'], 'project'>, id: string, patch: Record<string, unknown>) {
    commit((draft) => {
      const item = draft[track]?.find((candidate) => candidate.id === id);
      if (item) Object.assign(item, patch);
      return draft;
    }, `${track}:${id}:${Object.keys(patch).sort().join(',')}`);
  }
};
