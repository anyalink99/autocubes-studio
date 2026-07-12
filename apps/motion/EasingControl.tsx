import React from 'react';
import {EasingName} from '../../packages/core/editor-project';

const paths:Record<EasingName,string>={linear:'M4 56 L116 4',easeIn:'M4 56 C70 56 95 38 116 4',easeOut:'M4 56 C28 18 58 4 116 4',easeInOut:'M4 56 C42 56 35 4 116 4',spring:'M4 56 C35 56 25 -8 65 8 C86 17 92 -3 116 4'};
const labels:Record<EasingName,string>={linear:'Ровно',easeIn:'Разгон',easeOut:'Торможение',easeInOut:'Плавно',spring:'Пружина'};

export const EasingControl=({value,onChange}:{value:EasingName;onChange:(value:EasingName)=>void})=><section className="easing-control">
  <div className="easing-head"><span>Характер движения</span><strong>{labels[value]}</strong></div>
  <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-label={`${labels[value]} easing curve`}><path className="easing-grid" d="M4 4V56H116M4 30H116M60 4V56"/><path className="easing-path" d={paths[value]}/><circle cx="4" cy="56" r="2.5"/><circle cx="116" cy="4" r="2.5"/></svg>
  <div className="easing-presets">{(Object.keys(paths) as EasingName[]).map((easing)=><button key={easing} className={easing===value?'active':''} onClick={()=>onChange(easing)}>{labels[easing]}</button>)}</div>
</section>;
