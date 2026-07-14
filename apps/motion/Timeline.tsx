import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Captions, ChevronDown, ChevronRight, Eye, EyeOff, Flag, Layers3, Lock, Magnet, Maximize2, Music2, MousePointer2, Plus, ScanLine, Scissors, Sparkles, Unlock, UnfoldHorizontal, ZoomIn, ZoomOut} from 'lucide-react';
import {EditorProject, Selection} from '../../packages/core/editor-project';
import {captureDirectionReport, formatEditorTime, itemEnd, magneticSnap, roundToFrame, SnapResult, TimelineTrack} from '../../packages/core/editor-operations';

type VisualItem={id:string;at:number;width:number;text:string;duration:number;hold?:number;thumbnail?:string;enabled?:boolean;beatInterval?:number};
type DragState={
  token:number;
  mode:'move'|'trim-start'|'trim-end';
  track:TimelineTrack;
  id:string;
  startX:number;
  startScroll:number;
  originAt:number;
  originWidth:number;
  currentAt:number;
  currentWidth:number;
  delta:number;
  group:Array<{id:string;at:number;width:number}>;
  snap?:SnapResult;
};

type Props={
  project:EditorProject;
  currentTime:number;
  selection:Selection;
  pixelsPerSecond:number;
  onSeek:(time:number)=>void;
  onSelect:(selection:Selection)=>void;
  onMoveItems:(track:TimelineTrack,updates:Array<{id:string;at:number}>)=>void;
  onTrimItem:(track:TimelineTrack,id:string,at:number,duration:number,edge:'start'|'end',ripple:boolean)=>void;
  onAdd:(track:TimelineTrack)=>void;
  onToggleSnap:()=>void;
  onZoom:(zoom:number)=>void;
  onSplit:()=>void;
  onAddMarker:(at:number)=>void;
  onResizeHeight:(height:number)=>void;
};

const trackMeta=[
  {id:'frames' as const,label:'Сцены',help:'скролл и паузы',icon:ScanLine},
  {id:'pointer' as const,label:'Курсор',help:'наведение и клики',icon:MousePointer2},
  {id:'captions' as const,label:'Текст',help:'подписи в кадре',icon:Captions},
  {id:'overlays' as const,label:'Графика',help:'логотип и CTA',icon:Layers3},
  {id:'transitions' as const,label:'Смена сцен',help:'визуальные стыки',icon:Sparkles},
  {id:'audio' as const,label:'Звук',help:'музыка и эффекты',icon:Music2},
];

export const Timeline=({project,currentTime,selection,pixelsPerSecond,onSeek,onSelect,onMoveItems,onTrimItem,onAdd,onToggleSnap,onZoom,onSplit,onAddMarker,onResizeHeight}:Props)=>{
  const scrollerRef=useRef<HTMLDivElement>(null);
  const [drag,setDrag]=useState<DragState|null>(null);
  const [locked,setLocked]=useState<Set<TimelineTrack>>(new Set());
  const [muted,setMuted]=useState<Set<TimelineTrack>>(new Set());
  const [collapsed,setCollapsed]=useState<Set<TimelineTrack>>(new Set(['overlays','transitions']));
  const [ripple,setRipple]=useState(false);
  const callbacks=useRef({onMoveItems,onTrimItem,onSeek});
  callbacks.current={onMoveItems,onTrimItem,onSeek};
  const width=Math.max(project.duration*pixelsPerSecond+160,900);
  const selectedIds=new Set(selection.ids?.length?selection.ids:selection.id?[selection.id]:[]);
  const rulerStep=pixelsPerSecond>=100?.5:pixelsPerSecond<50?2:1;
  const ruler=useMemo(()=>Array.from({length:Math.floor(project.duration/rulerStep)+1},(_,index)=>index*rulerStep),[project.duration,rulerStep]);
  const directionReport=useMemo(()=>captureDirectionReport(project),[project]);
  const items=useMemo<Record<TimelineTrack,VisualItem[]>>(()=>({
    frames:project.frames.map((item)=>({...item,width:item.duration+item.hold,text:`${item.label} · ${Math.round(item.scrollY)}px`})),
    pointer:project.pointer.map((item)=>({...item,width:Math.max(item.duration,.24),text:item.label})),
    transitions:project.transitions.map((item)=>({...item,width:item.duration,text:item.label})),
    captions:project.captions.map((item)=>({...item,width:item.duration,text:item.text||item.label})),
    overlays:(project.overlays??[]).map((item)=>({...item,width:item.duration,text:item.text||item.label})),
    audio:project.audio.map((item)=>({...item,width:item.duration,text:item.label})),
  }),[project]);

  const toggleSet=(setter:React.Dispatch<React.SetStateAction<Set<TimelineTrack>>>,track:TimelineTrack)=>setter((current)=>{const next=new Set(current);next.has(track)?next.delete(track):next.add(track);return next;});

  useEffect(()=>{
    if(!drag)return;
    const initial=drag;
    let currentAt=initial.currentAt;
    let currentWidth=initial.currentWidth;
    let currentDelta=initial.delta;
    const move=(event:PointerEvent)=>{
      const scroller=scrollerRef.current;
      if(scroller){const bounds=scroller.getBoundingClientRect();if(event.clientX>bounds.right-34)scroller.scrollLeft+=18;if(event.clientX<bounds.left+34)scroller.scrollLeft-=18;}
      const rawDelta=(event.clientX-initial.startX+(scroller?.scrollLeft??0)-initial.startScroll)/pixelsPerSecond;
      let snap:SnapResult|undefined;
      if(initial.mode==='move'){
        const minAt=Math.min(...initial.group.map((item)=>item.at));
        const maxEnd=Math.max(...initial.group.map((item)=>item.at+item.width));
        const rawStart=Math.max(0,minAt+rawDelta);
        const rawEnd=maxEnd+(rawStart-minAt);
        if(event.altKey)currentDelta=roundToFrame(rawStart-minAt,project.fps);
        else{
          const options={excludedIds:initial.group.map((item)=>item.id),playhead:currentTime};
          const startSnap=magneticSnap(project,rawStart,pixelsPerSecond,options);
          const endSnap=magneticSnap(project,rawEnd,pixelsPerSecond,options);
          const candidates=[startSnap,endSnap].filter((candidate)=>candidate.snapped);
          snap=candidates.sort((a,b)=>Math.abs((a===startSnap?a.time-rawStart:a.time-rawEnd))-Math.abs((b===startSnap?b.time-rawStart:b.time-rawEnd)))[0];
          currentDelta=snap?(snap===startSnap?snap.time-minAt:snap.time-maxEnd):roundToFrame(rawStart-minAt,project.fps);
        }
        currentDelta=Math.max(-minAt,Math.min(project.duration-maxEnd,currentDelta));
        currentAt=initial.originAt+currentDelta;
      }else if(initial.mode==='trim-start'){
        const fixedEnd=initial.originAt+initial.originWidth;
        const raw=Math.max(0,Math.min(fixedEnd-1/project.fps,initial.originAt+rawDelta));
        snap=event.altKey?undefined:magneticSnap(project,raw,pixelsPerSecond,{excludedIds:[initial.id],playhead:currentTime});
        currentAt=snap?.time??roundToFrame(raw,project.fps);
        currentWidth=fixedEnd-currentAt;
      }else{
        const raw=Math.max(initial.originAt+1/project.fps,Math.min(project.duration,initial.originAt+initial.originWidth+rawDelta));
        snap=event.altKey?undefined:magneticSnap(project,raw,pixelsPerSecond,{excludedIds:[initial.id],playhead:currentTime});
        const end=snap?.time??roundToFrame(raw,project.fps);
        currentWidth=Math.max(1/project.fps,end-initial.originAt);
      }
      setDrag((current)=>current?{...current,currentAt,currentWidth,delta:currentDelta,snap:snap?.snapped?snap:undefined}:current);
    };
    const up=()=>{
      if(initial.mode==='move')callbacks.current.onMoveItems(initial.track,initial.group.map((item)=>({id:item.id,at:item.at+currentDelta})));
      else callbacks.current.onTrimItem(initial.track,initial.id,currentAt,currentWidth,initial.mode==='trim-start'?'start':'end',ripple);
      setDrag(null);
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
  },[drag?.token,pixelsPerSecond,project,currentTime,ripple]);

  useEffect(()=>{const scroller=scrollerRef.current;if(!scroller)return;const x=currentTime*pixelsPerSecond;if(x<scroller.scrollLeft+30||x>scroller.scrollLeft+scroller.clientWidth-40)scroller.scrollTo({left:Math.max(0,x-scroller.clientWidth*.35),behavior:'smooth'});},[currentTime,pixelsPerSecond]);

  const seek=(event:React.MouseEvent<HTMLElement>)=>{const canvas=event.currentTarget.closest('.timeline-canvas');if(!canvas)return;const bounds=canvas.getBoundingClientRect();callbacks.current.onSeek(magneticSnap(project,(event.clientX-bounds.left)/pixelsPerSecond,pixelsPerSecond).time);};
  const selectClip=(event:React.MouseEvent,track:TimelineTrack,id:string)=>{event.stopPropagation();if(event.shiftKey&&selection.track===track){const ids=new Set(selection.ids??(selection.id?[selection.id]:[]));ids.has(id)?ids.delete(id):ids.add(id);onSelect({track,id,ids:[...ids]});}else if(selection.track!==track||!selectedIds.has(id)||selectedIds.size<2)onSelect({track,id,ids:[id]});};
  const beginDrag=(event:React.PointerEvent,track:TimelineTrack,item:VisualItem,mode:DragState['mode'])=>{
    if(locked.has(track)||event.shiftKey)return;
    event.preventDefault();event.stopPropagation();
    const ids=mode==='move'&&selection.track===track&&selectedIds.has(item.id)?[...selectedIds]:[item.id];
    if(!selectedIds.has(item.id)||selection.track!==track)onSelect({track,id:item.id,ids:[item.id]});
    const group=items[track].filter((candidate)=>ids.includes(candidate.id)).map((candidate)=>({id:candidate.id,at:candidate.at,width:candidate.width}));
    setDrag({token:Date.now(),mode,track,id:item.id,startX:event.clientX,startScroll:scrollerRef.current?.scrollLeft??0,originAt:item.at,originWidth:item.width,currentAt:item.at,currentWidth:item.width,delta:0,group});
  };
  const beginPlayheadDrag=(event:React.PointerEvent)=>{event.preventDefault();event.stopPropagation();const canvas=event.currentTarget.closest('.timeline-canvas');if(!canvas)return;const update=(next:PointerEvent)=>{const bounds=canvas.getBoundingClientRect();callbacks.current.onSeek(magneticSnap(project,(next.clientX-bounds.left)/pixelsPerSecond,pixelsPerSecond).time);};const up=()=>{window.removeEventListener('pointermove',update);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',update);window.addEventListener('pointerup',up);};
  const beginHeightResize=(event:React.PointerEvent)=>{event.preventDefault();const startY=event.clientY;const startHeight=event.currentTarget.closest('.timeline-panel')?.getBoundingClientRect().height??368;const move=(next:PointerEvent)=>onResizeHeight(Math.max(250,Math.min(560,startHeight+startY-next.clientY)));const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);};

  return <section className="timeline-panel">
    <button className="timeline-height-handle" onPointerDown={beginHeightResize} title="Потяните, чтобы изменить высоту монтажа" aria-label="Изменить высоту монтажа"/>
    <div className="timeline-labels">
      <div className="timeline-label-head"><span>Монтаж</span><b className={`timeline-score ${directionReport.score>=85?'good':directionReport.score>=65?'ok':'weak'}`} title={directionReport.warnings.join('\n')||'Сценарий собран аккуратно'}>{directionReport.score}</b><button onClick={()=>onZoom(Math.max(30,pixelsPerSecond-12))} title="Уменьшить масштаб"><ZoomOut size={13}/></button><button onClick={()=>onZoom(Math.min(220,pixelsPerSecond+12))} title="Увеличить масштаб"><ZoomIn size={13}/></button><button onClick={()=>onZoom(Math.max(30,(scrollerRef.current?.clientWidth??900)/project.duration))} title="Показать весь ролик"><Maximize2 size={13}/></button><button className={project.snap!==false?'snap-active':''} onClick={onToggleSnap} title="Магнит к плейхеду, маркерам и краям"><Magnet size={13}/></button><button className={ripple?'snap-active':''} onClick={()=>setRipple((value)=>!value)} title="Ripple: сдвигать всё после правой обрезки"><UnfoldHorizontal size={13}/></button></div>
      {trackMeta.map(({id,label,help,icon:Icon})=><div className={`track-label ${collapsed.has(id)?'collapsed':''}`} key={id}><button onClick={()=>toggleSet(setCollapsed,id)} title="Свернуть дорожку">{collapsed.has(id)?<ChevronRight size={13}/>:<ChevronDown size={13}/>}</button><Icon size={14}/><span><b>{label}</b><small>{help}</small></span><button onClick={()=>toggleSet(setMuted,id)} title="Показать или скрыть">{muted.has(id)?<EyeOff size={12}/>:<Eye size={12}/>}</button><button onClick={()=>toggleSet(setLocked,id)} title="Заблокировать дорожку">{locked.has(id)?<Lock size={12}/>:<Unlock size={12}/>}</button><button onClick={()=>onAdd(id)} title={`Добавить: ${label}`}><Plus size={13}/></button></div>)}
    </div>
    <div className="timeline-scroll" ref={scrollerRef} onWheel={(event)=>{const scroller=scrollerRef.current;if(!scroller)return;event.preventDefault();if(event.ctrlKey||event.metaKey){const bounds=scroller.getBoundingClientRect();const anchor=(scroller.scrollLeft+event.clientX-bounds.left)/pixelsPerSecond;const next=Math.max(30,Math.min(220,pixelsPerSecond-event.deltaY*.15));onZoom(next);requestAnimationFrame(()=>{scroller.scrollLeft=Math.max(0,anchor*next-(event.clientX-bounds.left));});}else scroller.scrollLeft+=event.deltaX+event.deltaY;}}>
      <div className="timeline-canvas" style={{width}}>
        <div className="timeline-ruler" onClick={seek} onDoubleClick={(event)=>{seek(event);onAddMarker(currentTime);}}>{ruler.map((second)=><div className="ruler-mark" key={second} style={{left:second*pixelsPerSecond}}><span>{formatEditorTime(second,project.fps,project.timeDisplay)}</span></div>)}</div>
        {(project.markers??[]).map((marker)=><button className="timeline-marker" key={marker.id} style={{left:marker.at*pixelsPerSecond,'--marker-color':marker.color??'#ffb35c'} as React.CSSProperties} title={`${marker.label} · ${formatEditorTime(marker.at,project.fps,project.timeDisplay)}`} onClick={()=>onSeek(marker.at)}><Flag size={10}/></button>)}
        {trackMeta.map(({id})=><div className={`timeline-track track-${id} ${collapsed.has(id)?'collapsed':''} ${muted.has(id)?'muted':''}`} key={id} onClick={seek} onDoubleClick={()=>onAdd(id)}>{items[id].map((item,itemIndex)=>{
          const grouped=drag?.mode==='move'&&drag.track===id?drag.group.find((candidate)=>candidate.id===item.id):undefined;
          const active=drag?.track===id&&drag.id===item.id?drag:undefined;
          const at=grouped?grouped.at+(drag?.delta??0):active?.currentAt??item.at;
          const clipWidth=active&&active.mode!=='move'?active.currentWidth:item.width;
          return <button key={item.id} className={`timeline-clip ${selectedIds.has(item.id)?'selected':''} ${id==='audio'&&item.enabled===false?'disabled':''}`} style={{left:at*pixelsPerSecond,width:Math.max(16,clipWidth*pixelsPerSecond)}} onClick={(event)=>selectClip(event,id,item.id)} onPointerDown={(event)=>beginDrag(event,id,item,'move')} title={`${item.text} · ${formatEditorTime(item.at,project.fps,project.timeDisplay)} → ${formatEditorTime(item.at+item.width,project.fps,project.timeDisplay)}`}>
            {item.thumbnail?<img className="timeline-scene-thumb" src={item.thumbnail} alt=""/>:null}{id==='frames'?<div className="scene-rhythm" aria-hidden="true"><i className="scene-scroll" style={{width:`${item.width?item.duration/item.width*100:0}%`}}/><i className="scene-hold"/></div>:null}<i className="clip-handle clip-handle-start" onPointerDown={(event)=>beginDrag(event,id,item,'trim-start')}/><span>{id==='frames'?<em>Сцена {itemIndex+1}</em>:null}{item.text}</span><small>{formatEditorTime(at,project.fps,project.timeDisplay)}</small>{Number(item.beatInterval)>0?<div className="clip-beats">{Array.from({length:Math.floor(item.width/Number(item.beatInterval))},(_,index)=><i key={index} style={{left:`${(index+1)*Number(item.beatInterval)/item.width*100}%`}}/>)}</div>:null}<i className="clip-handle clip-handle-end" onPointerDown={(event)=>beginDrag(event,id,item,'trim-end')}/>
          </button>;
        })}</div>)}
        {drag?.snap?.snapped?<div className={`snap-guide source-${drag.snap.source}`} style={{left:drag.snap.time*pixelsPerSecond}}><span>{drag.snap.label} · {formatEditorTime(drag.snap.time,project.fps,project.timeDisplay)}</span></div>:null}
        <div className="playhead" style={{left:currentTime*pixelsPerSecond}} onPointerDown={beginPlayheadDrag}><span/></div>
      </div>
    </div>
    <div className="timeline-quick-actions"><button onClick={onSplit} title="Разрезать выбранный элемент"><Scissors size={13}/></button><button onClick={()=>onAddMarker(currentTime)} title="Добавить заметку времени"><Flag size={13}/></button></div>
  </section>;
};
