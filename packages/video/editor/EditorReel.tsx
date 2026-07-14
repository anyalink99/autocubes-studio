import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, Video} from 'remotion';
import projectData from '../../../data/generated/editor-project.json';
import {EditorProject} from '../../core/editor-project';
import {cursorStateAt} from '../../core/motion-kinematics';

const project = projectData as EditorProject;

const TransitionLayer = ({time}: {time: number}) => {
  const transition = project.transitions.find((item) => time >= item.at && time <= item.at + item.duration);
  if (!transition || transition.kind === 'cut') return null;
  const progress = (time - transition.at) / Math.max(0.01, transition.duration);
  const opacity = Math.sin(Math.PI * progress) * transition.strength;
  const background = transition.color ?? (transition.kind === 'dipWhite' || transition.kind === 'flash' ? '#fff' : transition.kind === 'blur' || transition.kind === 'zoomBlur' ? 'rgba(255,255,255,.02)' : '#000');
  const horizontal = transition.direction !== 'up' && transition.direction !== 'down';
  const sign = transition.direction === 'right' || transition.direction === 'down' ? -1 : 1;
  return <div style={{
    position: 'absolute', inset: 0, opacity, background,
    backdropFilter: transition.kind === 'blur' || transition.kind === 'zoomBlur' ? `blur(${opacity * 18}px)` : undefined,
    clipPath: transition.kind === 'wipe' ? horizontal ? `inset(0 ${100 - progress * 100}% 0 0)` : `inset(0 0 ${100 - progress * 100}% 0)` : undefined,
    transform: transition.kind === 'slide' ? `translate${horizontal ? 'X' : 'Y'}(${(1-progress) * sign * 100}%)` : transition.kind === 'zoomBlur' ? `scale(${1 + opacity * .08})` : undefined,
  }} />;
};

export const EditorReel = () => {
  const frame = useCurrentFrame();
  const time = frame / project.fps;
  const cursor = cursorStateAt(project.pointer,time,project.viewport);
  const caption = project.captions.find((item) => time >= item.at && time <= item.at + item.duration);
  const overlay = (project.overlays ?? []).find((item) => time >= item.at && time <= item.at + item.duration);
  const captionProgress = caption ? Math.max(0, Math.min(1, (time - caption.at) / Math.min(.4, caption.duration / 2))) : 1;

  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {project.previewVideo ? (
        <Video
          src={staticFile(project.previewVideo)}
          startFrom={Math.round((project.videoOffset ?? 0) * project.fps)}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      ) : null}

      {cursor.visible ? (
        <div style={{position:'absolute',left:cursor.x,top:cursor.y,width:58,height:68,zIndex:8,transform:`translate(-7px,-6px) scale(${(project.cursorScale??1)*(cursor.clicking?.9:1)})`,transformOrigin:'7px 6px',filter:'drop-shadow(0 12px 18px rgba(0,0,0,.34))'}}>
          {project.cursorTrail!==false&&cursor.speed>.002?<div style={{position:'absolute',left:-18,top:-18,width:48,height:48,borderRadius:'50%',background:'rgba(255,91,34,.16)',filter:'blur(12px)',opacity:Math.min(.62,cursor.speed*22)}}/>:null}
          {cursor.effect!=='none'&&cursor.clickProgress>0?<div style={{position:'absolute',left:-25,top:-25,width:54,height:54,borderRadius:'50%',border:cursor.effect==='ring'?'3px solid rgba(255,91,34,.9)':undefined,background:cursor.effect==='pulse'?'rgba(255,91,34,.26)':undefined,opacity:1-cursor.clickProgress,transform:`scale(${.45+cursor.clickProgress*1.2})`}}/>:null}
          <svg width="58" height="68" viewBox="0 0 58 68" fill="none">
            <path d="M9 5L48 41L31 43.8L24.4 62L9 5Z" fill="#0b0c10" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
            <path d="M31 44L42 58" stroke="#ff5b22" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
      ) : null}

      <TransitionLayer time={time} />

      {caption ? (
        <div style={{
          position: 'absolute',
          left: '7%',
          right: '7%',
          top: caption.position === 'top' ? '12%' : caption.position === 'center' ? '50%' : undefined,
          bottom: caption.position === 'bottom' ? '23%' : undefined,
          transform: caption.position === 'center' ? 'translateY(-50%)' : undefined,
          margin: 'auto',
          width: caption.style === 'boxed' ? 'max-content' : undefined,
          maxWidth: `${caption.maxWidth ?? 86}%`,
          padding: caption.style === 'boxed' ? `${caption.size * .22}px ${caption.size * .38}px` : undefined,
          borderRadius: caption.style === 'boxed' ? caption.size * .16 : undefined,
          color: caption.color ?? (caption.style === 'boxed' ? '#111' : caption.style === 'accent' ? '#ff7040' : '#fff'),
          background: caption.background ?? (caption.style === 'boxed' ? 'rgba(255,255,255,.94)' : undefined),
          fontFamily: 'Arial, sans-serif',
          fontSize: caption.size,
          fontWeight: 750,
          lineHeight: caption.lineHeight ?? 1.08,
          letterSpacing: `${(caption.letterSpacing ?? -2.5) / 100}em`,
          textAlign: caption.align ?? 'center',
          textShadow: caption.style === 'boxed' ? undefined : '0 4px 24px rgba(0,0,0,.65)',
          opacity: caption.animation === 'none' || !caption.animation ? 1 : captionProgress,
          scale: caption.animation === 'scale' ? .9 + captionProgress * .1 : undefined,
          translate: caption.animation === 'rise' ? `0 ${(1-captionProgress)*28}px` : undefined,
        }}>{project.outputLanguage === 'ru' ? (caption.textRu ?? caption.text) : (caption.textEn ?? caption.text)}</div>
      ) : null}

      {overlay ? <div style={{position:'absolute', left:`${overlay.x}%`, top:`${overlay.y}%`, zIndex:6, color:overlay.color, opacity:overlay.opacity, transform:`scale(${overlay.scale})`, transformOrigin:'top left', padding:overlay.kind === 'label' || overlay.kind === 'cta' ? '10px 16px' : 0, border:overlay.kind === 'label' ? `2px solid ${overlay.color}` : undefined, background:overlay.kind === 'cta' ? overlay.color : undefined, fontFamily:'Arial,sans-serif', fontSize:42, fontWeight:750, letterSpacing:'.04em', textTransform:'uppercase'}}>{overlay.kind === 'progress' ? <div style={{position:'fixed',left:0,right:0,bottom:0,height:7,background:'rgba(255,255,255,.2)'}}><i style={{display:'block',width:`${time/project.duration*100}%`,height:'100%',background:overlay.color}}/></div> : overlay.kind === 'frame' ? <div style={{position:'fixed',inset:'4%',border:`2px solid ${overlay.color}`}}/> : project.outputLanguage === 'ru' ? (overlay.textRu ?? overlay.text) : (overlay.textEn ?? overlay.text)}</div> : null}

      {project.audio.filter((item) => item.enabled && item.asset).map((item) => (
        <Sequence key={item.id} from={Math.round(item.at * project.fps)} durationInFrames={Math.max(1, Math.round(item.duration * project.fps))}>
          <Audio src={staticFile(item.asset)} loop={item.loop} volume={(audioFrame) => {
            const duration = Math.max(1, Math.round(item.duration * project.fps));
            const fadeIn = Math.round((item.fadeIn ?? 0) * project.fps);
            const fadeOut = Math.round((item.fadeOut ?? 0) * project.fps);
            const enter = fadeIn ? interpolate(audioFrame,[0,fadeIn],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}) : 1;
            const exit = fadeOut ? interpolate(audioFrame,[duration-fadeOut,duration],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'}) : 1;
            const globalTime=item.at+audioFrame/project.fps;
            const voiceActive=project.audio.some((other)=>other.category==='voice'&&other.enabled&&globalTime>=other.at&&globalTime<=other.at+other.duration);
            const duck = item.category === 'music' && item.ducking && voiceActive ? 0.35 : 1;
            return item.volume * (project.masterVolume ?? 1) * Math.min(enter,exit) * duck;
          }} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
