import {CaptureSection, CaptureTarget, EditorProject, EasingName, MotionProfile, Selection} from './editor-project';
import {estimatePointerDuration, estimateScrollDuration, recommendedHold} from './motion-kinematics';

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
    motionProfile: source.motionProfile ?? 'balanced',
    cursorScale: clamp(source.cursorScale ?? 1, .6, 1.8),
    cursorTrail: source.cursorTrail ?? true,
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
  project.pointer = project.pointer.map((item) => ({...item, at: clamp(item.at, 0, duration), duration: Math.max(.01, item.duration), x: clamp(item.x, 0, viewport.width), y: clamp(item.y, 0, viewport.height), path:item.path ?? 'human', settle:clamp(item.settle ?? .2,0,.5)}));
  project.transitions = project.transitions.map((item) => ({...item, at: clamp(item.at, 0, duration), duration: Math.max(.01, item.duration), strength: clamp(item.strength, 0, 1)}));
  project.captions = project.captions.map((item) => ({...item, textEn:item.textEn ?? item.text, textRu:item.textRu ?? item.text, at: clamp(item.at, 0, duration), duration: Math.max(.1, item.duration), align: item.align ?? 'center', maxWidth: item.maxWidth ?? 86, lineHeight: item.lineHeight ?? 1.08, letterSpacing: item.letterSpacing ?? -2.5, animation: item.animation ?? 'none'}));
  project.audio = project.audio.map((item) => ({...item, at: clamp(item.at, 0, duration), duration: Math.max(.01, item.duration), fadeIn: Math.max(0, item.fadeIn ?? 0), fadeOut: Math.max(0, item.fadeOut ?? 0), category:item.category ?? (item.label.toLowerCase().includes('voice')?'voice':item.duration>4?'music':'sfx'), beatInterval:Math.max(0,item.beatInterval??0)}));
  return project;
};

export const itemEnd = (item: {at: number; duration: number; hold?: number}) => item.at + item.duration + (item.hold ?? 0);

export type SnapResult={time:number; snapped:boolean; label?:string; source?:'edge'|'marker'|'playhead'|'range'};

export const magneticSnap = (project: EditorProject, value: number, pixelsPerSecond: number, options: {excludedIds?:string[]; playhead?:number} = {}):SnapResult => {
  const bounded=clamp(value,0,project.duration);
  const frame=roundToFrame(bounded,project.fps);
  if(project.snap===false)return {time:frame,snapped:false};
  const excluded=new Set(options.excludedIds??[]);
  const all = [...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio, ...(project.overlays ?? [])];
  const points:Array<{time:number;label:string;source:NonNullable<SnapResult['source']>}>= [
    {time:0,label:'Начало',source:'range'},
    {time:project.duration,label:'Конец',source:'range'},
    ...(options.playhead===undefined?[]:[{time:options.playhead,label:'Плейхед',source:'playhead' as const}]),
    ...(project.markers??[]).map((marker)=>({time:marker.at,label:marker.label||'Маркер',source:'marker' as const})),
    ...all.filter((item)=>!excluded.has(item.id)).flatMap((item)=>[
      {time:item.at,label:'Начало клипа',source:'edge' as const},
      {time:itemEnd(item),label:'Конец клипа',source:'edge' as const},
    ]),
  ];
  const nearest=points.reduce((best,point)=>Math.abs(point.time-bounded)<Math.abs(best.time-bounded)?point:best,points[0]);
  const threshold=Math.max(1/project.fps,12/Math.max(1,pixelsPerSecond));
  return Math.abs(nearest.time-bounded)<=threshold?{time:nearest.time,snapped:true,label:nearest.label,source:nearest.source}:{time:frame,snapped:false};
};

export const snapTime = (project: EditorProject, value: number, pixelsPerSecond: number, excludedId?: string) => magneticSnap(project,value,pixelsPerSecond,{excludedIds:excludedId?[excludedId]:[]}).time;

export const moveTimelineItems=(project:EditorProject,track:TimelineTrack,updates:Array<{id:string;at:number}>)=>{
  const list=project[track] as Array<{id:string;at:number;duration:number;hold?:number}>|undefined;
  if(!list)return project;
  const byId=new Map(updates.map((item)=>[item.id,item.at]));
  for(const item of list){const at=byId.get(item.id);if(at!==undefined)item.at=roundToFrame(Math.max(0,at),project.fps);}
  project.duration=Math.max(project.duration,...list.map(itemEnd));
  project.exportRange={in:project.exportRange?.in??0,out:Math.max(project.exportRange?.out??project.duration,project.duration)};
  return project;
};

export const trimTimelineItem=(project:EditorProject,track:TimelineTrack,id:string,at:number,totalDuration:number,ripple=false)=>{
  const list=project[track] as Array<{id:string;at:number;duration:number;hold?:number}>|undefined;
  const item=list?.find((candidate)=>candidate.id===id);
  if(!item)return project;
  const previousProjectDuration=project.duration;
  const oldEnd=itemEnd(item);
  item.at=roundToFrame(Math.max(0,at),project.fps);
  const total=Math.max(1/project.fps,roundToFrame(totalDuration,project.fps));
  if(track==='frames'){
    item.duration=Math.min(item.duration,total);
    item.hold=Math.max(0,total-item.duration);
  }else item.duration=total;
  const newEnd=itemEnd(item);
  const delta=newEnd-oldEnd;
  if(ripple&&Math.abs(delta)>.0001){
    const timed=[...project.frames,...project.pointer,...project.transitions,...project.captions,...project.audio,...(project.overlays??[]),...(project.markers??[])];
    for(const candidate of timed)if(candidate.id!==id&&candidate.at>=oldEnd-1/project.fps)candidate.at=roundToFrame(Math.max(0,candidate.at+delta),project.fps);
  }
  const contentEnd=Math.max(1,...[...project.frames,...project.pointer,...project.transitions,...project.captions,...project.audio,...(project.overlays??[])].map(itemEnd));
  project.duration=ripple?contentEnd:Math.max(previousProjectDuration,contentEnd);
  project.exportRange={in:Math.min(project.exportRange?.in??0,project.duration),out:project.duration};
  return project;
};

const paceMap = {
  slow: {move: 1.4, hold: 1.8, easing: 'easeInOut' as EasingName},
  balanced: {move: .9, hold: 1.1, easing: 'easeInOut' as EasingName},
  punchy: {move: .55, hold: .65, easing: 'easeOut' as EasingName},
};

export const arrangeFrames = (project: EditorProject, pace: keyof typeof paceMap = 'balanced') => {
  const settings = paceMap[pace];
  const profile:MotionProfile=pace==='slow'?'cinematic':pace==='punchy'?'snappy':'balanced';
  let at = 0;
  let previousScroll=0;
  project.frames.sort((a, b) => a.scrollY - b.scrollY).forEach((frame, index) => {
    frame.at = roundToFrame(at, project.fps);
    frame.duration = index === 0 ? 0 : estimateScrollDuration(frame.scrollY-previousScroll,project.viewport.height,profile);
    frame.hold = settings.hold;
    frame.easing = settings.easing;
    frame.motionProfile=profile;
    at += frame.duration + frame.hold;
    previousScroll=frame.scrollY;
  });
  project.motionProfile=profile;
  project.duration = Math.max(3, Math.ceil(at * 2) / 2);
  project.exportRange = {in: 0, out: project.duration};
  return project;
};

export type CaptureDirectionReport={score:number;duration:number;sceneCount:number;actionCount:number;warnings:string[]};

export const buildDirectedCapturePlan=(project:EditorProject,sections:CaptureSection[],targets:CaptureTarget[],profile:MotionProfile='balanced')=>{
  const ordered=[...sections].sort((a,b)=>a.scrollY-b.scrollY);
  const stamp=Date.now();
  const grouped=new Map<string,CaptureTarget[]>();
  for(const target of targets){
    const section=ordered.reduce((nearest,candidate)=>Math.abs(candidate.scrollY-target.pageY)<Math.abs(nearest.scrollY-target.pageY)?candidate:nearest,ordered[0]);
    if(!section)continue;
    const list=grouped.get(section.id)??[];
    if(list.length<2)list.push(target);
    grouped.set(section.id,list);
  }
  let at=profile==='cinematic'?.45:.28;
  let previousScroll=0;
  let previousPointer={x:project.viewport.width*.82,y:project.viewport.height*.82};
  const pointer:EditorProject['pointer']=[];
  project.frames=ordered.map((section,index)=>{
    const actions=grouped.get(section.id)??[];
    const duration=index===0?0:estimateScrollDuration(section.scrollY-previousScroll,project.viewport.height,profile);
    const baseHold=recommendedHold(profile,actions.length);
    const frameAt=roundToFrame(at,project.fps);
    let actionAt=frameAt+duration+(profile==='cinematic'?.42:.3);
    for(const [actionIndex,target] of actions.entries()){
      const destination={x:clamp(target.x,24,project.viewport.width-24),y:clamp(target.pageY-section.scrollY,24,project.viewport.height-24)};
      const moveDuration=estimatePointerDuration(Math.hypot(destination.x-previousPointer.x,destination.y-previousPointer.y),Math.hypot(project.viewport.width,project.viewport.height),profile);
      const kind=/button|tab|switch|checkbox/i.test(target.role)?'click' as const:'hover' as const;
      const settle=kind==='click'?(profile==='cinematic'?.26:profile==='snappy'?.18:.22):0;
      pointer.push({id:`cursor-${stamp}-${index}-${actionIndex}`,label:target.label,targetLabel:target.label,at:roundToFrame(actionAt,project.fps),duration:moveDuration+settle,kind,x:destination.x,y:destination.y,selector:target.selector,easing:'easeOut',visible:true,clickEffect:kind==='click'?'ring':'none',path:'human',settle});
      actionAt+=moveDuration+settle+(profile==='cinematic'?.42:.28);
      previousPointer=destination;
    }
    const requiredHold=Math.max(baseHold,actionAt-(frameAt+duration)+(actions.length ? .3 : 0));
    const preview=project.captureAnalysis?.previewFrames?.reduce((nearest,candidate)=>Math.abs(candidate.scrollY-section.scrollY)<Math.abs(nearest.scrollY-section.scrollY)?candidate:nearest,project.captureAnalysis.previewFrames[0]);
    const frame={id:`scene-${stamp}-${index}`,label:section.label,at:frameAt,scrollY:section.scrollY,duration,hold:Math.round(requiredHold*100)/100,easing:'easeInOut' as EasingName,motionProfile:profile,thumbnail:preview?.image};
    at=frameAt+duration+frame.hold;
    previousScroll=section.scrollY;
    return frame;
  });
  project.pointer=pointer;
  project.motionProfile=profile;
  project.duration=Math.max(3,Math.ceil((at+(profile==='cinematic'?.5:.3))*project.fps)/project.fps);
  project.exportRange={in:0,out:project.duration};
  project.transitions=[{id:`transition-finish-${stamp}`,label:'Мягкое завершение',at:Math.max(0,project.duration-.72),duration:.72,kind:'fade',strength:1}];
  return project;
};

export const polishMotionProject=(project:EditorProject,profile:MotionProfile=project.motionProfile??'balanced')=>{
  const frames=[...project.frames].sort((a,b)=>a.at-b.at);
  const oldFrames=frames.map((frame)=>({...frame}));
  const actionsByFrame=new Map<string,EditorProject['pointer']>();
  for(const action of [...project.pointer].sort((a,b)=>a.at-b.at)){
    const frame=oldFrames.reduce((active,candidate)=>action.at>=candidate.at-.01?candidate:active,oldFrames[0]);
    if(!frame)continue;
    const list=actionsByFrame.get(frame.id)??[];
    list.push(action);
    actionsByFrame.set(frame.id,list);
  }
  let at=profile==='cinematic'?.45:.28;
  let previousScroll=frames[0]?.scrollY??0;
  let previousPointer={x:project.viewport.width*.82,y:project.viewport.height*.82};
  for(const [index,frame] of frames.entries()){
    const actions=actionsByFrame.get(frame.id)??[];
    frame.at=roundToFrame(at,project.fps);
    frame.duration=index===0?0:estimateScrollDuration(frame.scrollY-previousScroll,project.viewport.height,profile);
    frame.motionProfile=profile;
    frame.easing='easeInOut';
    let actionAt=frame.at+frame.duration+(profile==='cinematic'?.42:.3);
    for(const action of actions){
      const move=estimatePointerDuration(Math.hypot(action.x-previousPointer.x,action.y-previousPointer.y),Math.hypot(project.viewport.width,project.viewport.height),profile);
      const settle=action.kind==='click'?(profile==='cinematic'?.26:profile==='snappy'?.18:.22):0;
      action.at=roundToFrame(actionAt,project.fps);
      action.duration=move+settle;
      action.path='human';
      action.easing='easeOut';
      action.settle=settle;
      actionAt+=action.duration+(profile==='cinematic'?.42:.28);
      previousPointer={x:action.x,y:action.y};
    }
    frame.hold=Math.round(Math.max(recommendedHold(profile,actions.length),actionAt-(frame.at+frame.duration)+(actions.length ? .3 : 0))*100)/100;
    at=frame.at+frame.duration+frame.hold;
    previousScroll=frame.scrollY;
  }
  project.frames=frames;
  project.motionProfile=profile;
  project.duration=Math.max(3,Math.ceil((at+(profile==='cinematic'?.5:.3))*project.fps)/project.fps);
  project.exportRange={in:0,out:project.duration};
  const finalTransition=project.transitions.find((item)=>item.label==='Мягкое завершение');
  if(finalTransition){finalTransition.at=Math.max(0,project.duration-finalTransition.duration);finalTransition.strength=1;}
  return project;
};

export const captureDirectionReport=(project:EditorProject):CaptureDirectionReport=>{
  const warnings:string[]=[];
  const frames=[...project.frames].sort((a,b)=>a.at-b.at);
  if(frames.length<3)warnings.push('Для истории нужно хотя бы три сцены');
  if(frames.length>8)warnings.push('Больше восьми сцен трудно прочитать в одном ролике');
  const overlaps=frames.filter((frame,index)=>index>0&&itemEnd(frames[index-1])>frame.at+.01).length;
  if(overlaps)warnings.push(`Пересекаются сцены: ${overlaps}`);
  const rushed=frames.filter((frame)=>frame.hold<.65).length;
  if(rushed)warnings.push(`Слишком короткие паузы: ${rushed}`);
  const roboticMoves=project.pointer.filter((event)=>event.path==='direct'||event.easing==='linear').length;
  if(roboticMoves)warnings.push(`Прямолинейные движения курсора: ${roboticMoves}`);
  const outside=project.pointer.filter((event)=>event.at+event.duration>project.duration+.01).length;
  if(outside)warnings.push(`Действия за пределами ролика: ${outside}`);
  const score=clamp(100-warnings.length*12-(overlaps+rushed+roboticMoves+outside)*4,0,100);
  return {score,duration:project.duration,sceneCount:frames.length,actionCount:project.pointer.length,warnings};
};

export const updateFrameWithRipple=(project:EditorProject,id:string,patch:Partial<EditorProject['frames'][number]>)=>{
  const frame=project.frames.find((item)=>item.id===id);
  if(!frame)return project;
  const oldDuration=frame.duration;
  const oldEnd=itemEnd(frame);
  Object.assign(frame,patch);
  const durationDelta=frame.duration-oldDuration;
  const totalDelta=itemEnd(frame)-oldEnd;
  const timed=[...project.pointer,...project.transitions,...project.captions,...project.audio,...(project.overlays??[]),...(project.markers??[])];
  for(const item of timed){
    if(item.at>=oldEnd-.02)item.at=Math.max(0,item.at+totalDelta);
    else if(durationDelta&&item.at>=frame.at+oldDuration-.001)item.at=Math.max(frame.at,item.at+durationDelta);
  }
  for(const candidate of project.frames){if(candidate.id!==id&&candidate.at>=oldEnd-.02)candidate.at=Math.max(0,candidate.at+totalDelta);}
  project.duration=Math.max(1,project.duration+totalDelta);
  project.exportRange={in:project.exportRange?.in??0,out:project.duration};
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
