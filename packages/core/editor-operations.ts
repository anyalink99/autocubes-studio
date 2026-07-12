import {EditorProject, EasingName, Selection} from './editor-project';

export type TimelineTrack = Exclude<Selection['track'], 'project'>;
export type MotionRecipeId = 'walkthrough' | 'case-study' | 'feature-reveal' | 'portfolio' | 'typography';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
export const roundToFrame = (value: number, fps: number) => Math.round(value * fps) / fps;
export const maxScroll = (project: Pick<EditorProject, 'pageHeight' | 'viewport'>) => Math.max(0, project.pageHeight - project.viewport.height);
export const scrollPercent = (project: Pick<EditorProject, 'pageHeight' | 'viewport'>, scrollY: number) => maxScroll(project) ? clamp(scrollY / maxScroll(project), 0, 1) : 0;

export const parsePagePosition = (source: string, project: Pick<EditorProject, 'pageHeight' | 'viewport'>) => {
  const value = source.trim().toLowerCase();
  const maximum = maxScroll(project);
  if (value === 'top' || value === 'start') return 0;
  if (value === 'center' || value === 'middle') return maximum / 2;
  if (value === 'bottom' || value === 'end') return maximum;
  if (value.endsWith('%')) return clamp(Number.parseFloat(value) / 100 * maximum, 0, maximum);
  return clamp(Number.parseFloat(value.replace('px', '')), 0, maximum);
};

export const formatEditorTime = (seconds: number, fps: number, mode: EditorProject['timeDisplay'] = 'timecode') => {
  if (mode === 'seconds') return `${seconds.toFixed(2)}s`;
  if (mode === 'frames') return `${Math.round(seconds * fps)}f`;
  const frames = Math.floor((seconds % 1) * fps).toString().padStart(2, '0');
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}:${frames}`;
};

export const migrateEditorProject = (source: EditorProject): EditorProject => {
  const viewport = source.viewport?.width && source.viewport?.height ? source.viewport : {width: 1080, height: 1920};
  const duration = Math.max(1, Number(source.duration) || 15);
  const project: EditorProject = {
    ...source,
    version: 3,
    fps: clamp(Number(source.fps) || 30, 1, 120),
    duration,
    viewport,
    pageHeight: Math.max(viewport.height, Number(source.pageHeight) || viewport.height),
    guides: source.guides !== false,
    snap: source.snap !== false,
    timeDisplay: source.timeDisplay ?? 'timecode',
    playbackRate: clamp(source.playbackRate ?? 1, .25, 2),
    masterVolume: clamp(source.masterVolume ?? 1, 0, 1.5),
    outputLanguage: source.outputLanguage ?? 'en',
    frames: source.frames ?? [],
    pointer: source.pointer ?? [],
    transitions: source.transitions ?? [],
    captions: source.captions ?? [],
    audio: source.audio ?? [],
    overlays: source.overlays ?? [],
    markers: source.markers ?? [],
  };
  project.exportRange = {
    in: clamp(source.exportRange?.in ?? 0, 0, duration),
    out: clamp(source.exportRange?.out ?? duration, 0, duration),
  };
  project.frames = project.frames.map((item) => ({...item, at: clamp(item.at, 0, duration), scrollY: clamp(item.scrollY, 0, maxScroll(project)), duration: Math.max(0, item.duration), hold: Math.max(0, item.hold)}));
  project.pointer = project.pointer.map((item) => ({...item, at: clamp(item.at, 0, duration), duration: Math.max(.01, item.duration), x: clamp(item.x, 0, viewport.width), y: clamp(item.y, 0, viewport.height)}));
  project.transitions = project.transitions.map((item) => ({...item, at: clamp(item.at, 0, duration), duration: Math.max(.01, item.duration), strength: clamp(item.strength, 0, 1)}));
  project.captions = project.captions.map((item) => ({...item, textEn:item.textEn ?? item.text, textRu:item.textRu ?? item.text, at: clamp(item.at, 0, duration), duration: Math.max(.1, item.duration), align: item.align ?? 'center', maxWidth: item.maxWidth ?? 86, lineHeight: item.lineHeight ?? 1.08, letterSpacing: item.letterSpacing ?? -2.5, animation: item.animation ?? 'none'}));
  project.audio = project.audio.map((item) => ({...item, at: clamp(item.at, 0, duration), duration: Math.max(.01, item.duration), fadeIn: Math.max(0, item.fadeIn ?? 0), fadeOut: Math.max(0, item.fadeOut ?? 0), category:item.category ?? (item.label.toLowerCase().includes('voice')?'voice':item.duration>4?'music':'sfx'), beatInterval:Math.max(0,item.beatInterval??0)}));
  return project;
};

export const itemEnd = (item: {at: number; duration: number; hold?: number}) => item.at + item.duration + (item.hold ?? 0);

export const snapTime = (project: EditorProject, value: number, pixelsPerSecond: number, excludedId?: string) => {
  if (project.snap === false) return clamp(value, 0, project.duration);
  const frame = roundToFrame(value, project.fps);
  const all = [...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio, ...(project.overlays ?? [])];
  const points = [0, project.duration, ...(project.markers ?? []).map((marker) => marker.at), ...all.filter((item) => item.id !== excludedId).flatMap((item) => [item.at, itemEnd(item)])];
  const nearest = points.reduce((best, point) => Math.abs(point - value) < Math.abs(best - value) ? point : best, frame);
  return Math.abs(nearest - value) <= Math.max(1 / project.fps, 8 / pixelsPerSecond) ? nearest : frame;
};

const paceMap = {
  slow: {move: 1.4, hold: 1.8, easing: 'easeInOut' as EasingName},
  balanced: {move: .9, hold: 1.1, easing: 'easeInOut' as EasingName},
  punchy: {move: .55, hold: .65, easing: 'easeOut' as EasingName},
};

export const arrangeFrames = (project: EditorProject, pace: keyof typeof paceMap = 'balanced') => {
  const settings = paceMap[pace];
  let at = 0;
  project.frames.sort((a, b) => a.scrollY - b.scrollY).forEach((frame, index) => {
    frame.at = roundToFrame(at, project.fps);
    frame.duration = index === 0 ? 0 : settings.move;
    frame.hold = settings.hold;
    frame.easing = settings.easing;
    at += frame.duration + frame.hold;
  });
  project.duration = Math.max(3, Math.ceil(at * 2) / 2);
  project.exportRange = {in: 0, out: project.duration};
  return project;
};

export const applyRecipe = (project: EditorProject, recipe: MotionRecipeId) => {
  const maximum = maxScroll(project);
  const recipes: Record<MotionRecipeId, {positions: number[]; pace: keyof typeof paceMap; caption?: string}> = {
    walkthrough: {positions: [0, .2, .45, .72, 1], pace: 'balanced', caption: 'A focused walkthrough, built to ship.'},
    'case-study': {positions: [0, .16, .38, .62, .84, 1], pace: 'slow', caption: 'From first frame to final outcome.'},
    'feature-reveal': {positions: [0, .32, .68, 1], pace: 'punchy', caption: 'One product. Four decisive moments.'},
    portfolio: {positions: [0, .25, .5, .75, 1], pace: 'punchy', caption: 'Selected work by Autocubes.'},
    typography: {positions: [0, .5, 1], pace: 'slow', caption: 'Design. Code. Motion.'},
  };
  const selected = recipes[recipe];
  project.frames = selected.positions.map((position, index) => ({id: `frame-${Date.now()}-${index}`, label: index === 0 ? 'Opening' : index === selected.positions.length - 1 ? 'Closing' : `Scene ${index + 1}`, at: 0, scrollY: Math.round(maximum * position), duration: 1, hold: 1, easing: 'easeInOut'}));
  project.captions = selected.caption ? [{id: `caption-${Date.now()}`, label: 'Начальный текст', text: selected.caption, textEn:selected.caption, textRu:'Шоукейс продукта.', at: .35, duration: 2.4, position: 'bottom', style: 'boxed', size: 54, align: 'center', animation: 'rise'}] : [];
  return arrangeFrames(project, selected.pace);
};

export const duplicateTimelineItem = (project: EditorProject, selection: Selection, id: string) => {
  if (selection.track === 'project' || !selection.id) return project;
  const list = project[selection.track] ?? [];
  const source = list.find((item) => item.id === selection.id);
  if (source) list.push({...structuredClone(source), id, at: clamp(source.at + .5, 0, project.duration - .05)} as never);
  return project;
};
