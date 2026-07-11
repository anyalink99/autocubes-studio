import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, Video} from 'remotion';
import projectData from '../../../data/generated/editor-project.json';
import {EditorProject, EasingName} from '../../core/editor-project';

const project = projectData as EditorProject;

const applyEasing = (value: number, easing: EasingName) => {
  if (easing === 'linear') return value;
  if (easing === 'easeIn') return value ** 3;
  if (easing === 'easeOut') return 1 - (1 - value) ** 3;
  if (easing === 'spring') return 1 - Math.exp(-7 * value) * Math.cos(value * Math.PI * 2.4);
  return value < 0.5 ? 4 * value ** 3 : 1 - Math.pow(-2 * value + 2, 3) / 2;
};

const cursorAt = (time: number) => {
  const events = [...project.pointer].filter((event) => event.visible).sort((a, b) => a.at - b.at);
  let previous = {x: project.viewport.width * 0.86, y: project.viewport.height * 0.86, visible: false, clicking: false};

  for (const event of events) {
    if (time < event.at) return previous;
    const end = event.at + Math.max(0.01, event.duration);
    if (time <= end) {
      const raw = Math.max(0, Math.min(1, (time - event.at) / (end - event.at)));
      const amount = applyEasing(raw, event.easing);
      return {
        x: previous.x + (event.x - previous.x) * amount,
        y: previous.y + (event.y - previous.y) * amount,
        visible: true,
        clicking: event.kind === 'click' && raw > 0.76,
      };
    }
    previous = {x: event.x, y: event.y, visible: true, clicking: false};
  }
  return previous;
};

const TransitionLayer = ({time}: {time: number}) => {
  const transition = project.transitions.find((item) => time >= item.at && time <= item.at + item.duration);
  if (!transition || transition.kind === 'cut') return null;
  const progress = (time - transition.at) / Math.max(0.01, transition.duration);
  const opacity = Math.sin(Math.PI * progress) * transition.strength;
  const background = transition.kind === 'dipWhite' ? '#fff' : transition.kind === 'blur' ? 'rgba(255,255,255,.02)' : '#000';
  return <div style={{position: 'absolute', inset: 0, opacity, background, backdropFilter: transition.kind === 'blur' ? `blur(${opacity * 18}px)` : undefined}} />;
};

export const EditorReel = () => {
  const frame = useCurrentFrame();
  const time = frame / project.fps;
  const cursor = cursorAt(time);

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
        <div style={{position: 'absolute', left: cursor.x, top: cursor.y, width: 58, height: 68, transform: `translate(-7px,-6px) scale(${cursor.clicking ? 0.82 : 1})`, filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.34))'}}>
          <svg width="58" height="68" viewBox="0 0 58 68" fill="none">
            <path d="M9 5L48 41L31 43.8L24.4 62L9 5Z" fill="#0b0c10" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
            <path d="M31 44L42 58" stroke="#ff5b22" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
      ) : null}

      <TransitionLayer time={time} />

      {project.audio.filter((item) => item.enabled && item.asset).map((item) => (
        <Sequence key={item.id} from={Math.round(item.at * project.fps)} durationInFrames={Math.max(1, Math.round(item.duration * project.fps))}>
          <Audio src={staticFile(item.asset)} volume={item.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
