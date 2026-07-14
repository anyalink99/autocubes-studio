import {EasingName, MotionProfile, PointerEvent} from './editor-project';

export type CursorState = {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
  clickProgress: number;
  effect: NonNullable<PointerEvent['clickEffect']>;
  angle: number;
  speed: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const motionEase = (value: number, easing: EasingName = 'easeInOut') => {
  const t = clamp01(value);
  if (easing === 'linear') return t;
  if (easing === 'easeIn') return t ** 3;
  if (easing === 'easeOut') return 1 - (1 - t) ** 4;
  if (easing === 'spring') return 1 - Math.exp(-7 * t) * Math.cos(t * Math.PI * 2.4);
  return t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
};

const hash = (source: string) => {
  let value = 2166136261;
  for (let index = 0; index < source.length; index += 1) value = Math.imul(value ^ source.charCodeAt(index), 16777619);
  return ((value >>> 0) % 2001) / 1000 - 1;
};

const cubic = (from: number, controlA: number, controlB: number, to: number, amount: number) => {
  const inverse = 1 - amount;
  return inverse ** 3 * from + 3 * inverse ** 2 * amount * controlA + 3 * inverse * amount ** 2 * controlB + amount ** 3 * to;
};

const cursorSample = (event: PointerEvent, from: {x:number; y:number}, raw: number) => {
  const amount = motionEase(raw, event.easing);
  if ((event.path ?? 'human') === 'direct') return {x:from.x+(event.x-from.x)*amount,y:from.y+(event.y-from.y)*amount,angle:Math.atan2(event.y-from.y,event.x-from.x),speed:1};
  const dx=event.x-from.x;
  const dy=event.y-from.y;
  const distance=Math.max(1,Math.hypot(dx,dy));
  const direction=hash(event.id)>=0?1:-1;
  const defaultCurve=Math.min(150,Math.max(18,distance*.16))*direction;
  const curve=(event.curve ?? defaultCurve)*((event.path ?? 'human')==='arc'?1.35:1);
  const nx=-dy/distance;
  const ny=dx/distance;
  const first={x:from.x+dx*.28+nx*curve,y:from.y+dy*.28+ny*curve};
  const second={x:from.x+dx*.82-nx*curve*.22,y:from.y+dy*.82-ny*curve*.22};
  const x=cubic(from.x,first.x,second.x,event.x,amount);
  const y=cubic(from.y,first.y,second.y,event.y,amount);
  const nextAmount=Math.min(1,amount+.008);
  const nextX=cubic(from.x,first.x,second.x,event.x,nextAmount);
  const nextY=cubic(from.y,first.y,second.y,event.y,nextAmount);
  return {x,y,angle:Math.atan2(nextY-y,nextX-x),speed:Math.hypot(nextX-x,nextY-y)/Math.max(.008,distance)};
};

export const cursorStateAt = (eventsSource: PointerEvent[], time: number, viewport: {width:number;height:number}): CursorState => {
  const events=[...eventsSource].filter((event)=>event.visible).sort((a,b)=>a.at-b.at);
  let previous={x:viewport.width*.82,y:viewport.height*.82};
  let state:CursorState={...previous,visible:false,clicking:false,clickProgress:0,effect:'ring',angle:-Math.PI/4,speed:0};
  for(const event of events){
    if(time<event.at)return state;
    const end=event.at+Math.max(.01,event.duration);
    if(time<=end){
      const raw=clamp01((time-event.at)/Math.max(.01,event.duration));
      const settle=event.kind==='click'?Math.max(.04,event.settle??.2):0;
      const pressStart=Math.max(.58,Math.min(.9,1-settle/Math.max(.01,event.duration)));
      const sample=cursorSample(event,previous,clamp01(raw/pressStart));
      const pressProgress=clamp01((raw-pressStart)/(1-pressStart));
      return {...sample,visible:true,clicking:event.kind==='click'&&pressProgress>.08,clickProgress:event.kind==='click'?Math.sin(pressProgress*Math.PI):0,effect:event.clickEffect??'ring'};
    }
    previous={x:event.x,y:event.y};
    state={...state,...previous,visible:true,clicking:false,clickProgress:0,effect:event.clickEffect??'ring',speed:0};
  }
  return state;
};

const profileValues:Record<MotionProfile,{minimum:number;distance:number;hold:number}>={
  cinematic:{minimum:.82,distance:.62,hold:1.55},
  balanced:{minimum:.62,distance:.48,hold:1.15},
  snappy:{minimum:.42,distance:.34,hold:.78},
};

export const estimateScrollDuration=(distance:number,viewportHeight:number,profile:MotionProfile='balanced')=>{
  if(distance<4)return 0;
  const settings=profileValues[profile];
  const screens=Math.abs(distance)/Math.max(1,viewportHeight);
  return Math.round(Math.min(profile==='cinematic'?2.8:2.15,settings.minimum+Math.sqrt(screens)*settings.distance)*100)/100;
};

export const estimatePointerDuration=(distance:number,viewportDiagonal:number,profile:MotionProfile='balanced')=>{
  const normalized=Math.min(1.5,Math.abs(distance)/Math.max(1,viewportDiagonal));
  const base=profile==='cinematic'?.58:profile==='snappy'?.3:.44;
  const scale=profile==='cinematic'?.82:profile==='snappy'?.48:.64;
  return Math.round(Math.min(1.35,base+Math.sqrt(normalized)*scale)*100)/100;
};

export const recommendedHold=(profile:MotionProfile='balanced',actionCount=0)=>Math.round((profileValues[profile].hold+Math.min(2,actionCount)*.64)*100)/100;
