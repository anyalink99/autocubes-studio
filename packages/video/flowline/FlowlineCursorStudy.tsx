import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  Video,
} from 'remotion';
import {CaptureAction} from '../../core/manifest';
import {loadFlowlineManifest, shotAsset} from './manifest';

const manifest = loadFlowlineManifest();
const fps = 30;
const totalFrames = 660;
const sourceStart = 7.5;
const playbackRate = 1.2;
const finalStart = 568;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const palette = {
  ink: '#0b0c10',
  white: '#ffffff',
  orange: '#ff4f12',
  grey: '#9ea0a8',
};

const progress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

const sourceTimeAt = (frame: number) => sourceStart + (frame / fps) * playbackRate;

const actions = ((manifest.actions ?? []) as CaptureAction[]).filter(
  (action) => typeof action.x === 'number' && typeof action.y === 'number',
);
const pointerActions = actions.filter((action) =>
  ['move', 'hover', 'click'].includes(action.type),
);
const clickActions = actions.filter((action) => action.type === 'click');

const cursorAt = (sourceTime: number) => {
  let previous = {x: 1010, y: 1760};

  for (const action of pointerActions) {
    const duration = action.duration ?? 0.46;
    const end = action.at + duration;
    const target = {x: action.x ?? previous.x, y: action.y ?? previous.y};

    if (sourceTime < action.at) return previous;

    if (sourceTime <= end) {
      const amount = interpolate(sourceTime, [action.at, end], [0, 1], {
        ...clamp,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      return {
        x: previous.x + (target.x - previous.x) * amount,
        y: previous.y + (target.y - previous.y) * amount,
      };
    }

    previous = target;
  }

  return previous;
};

const Capture = () => {
  if (!manifest.video) {
    const still = manifest.stills[0];
    return still ? (
      <Img src={shotAsset(still.file)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    ) : null;
  }

  return (
    <Video
      src={shotAsset(manifest.video)}
      muted
      startFrom={Math.round(sourceStart * fps)}
      playbackRate={playbackRate}
      style={{width: '100%', height: '100%', objectFit: 'cover'}}
    />
  );
};

const CursorMark = ({pressed}: {pressed: number}) => (
  <svg width="58" height="68" viewBox="0 0 58 68" fill="none">
    <path
      d="M9 5L48 41L31 43.8L24.4 62L9 5Z"
      fill={palette.ink}
      stroke={palette.white}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path d="M31 44L42 58" stroke={palette.orange} strokeWidth="5" strokeLinecap="round" />
    <path
      d="M13 9L43 37"
      stroke="rgba(255,255,255,.22)"
      strokeWidth="2"
      strokeLinecap="round"
      opacity={1 - pressed}
    />
  </svg>
);

const ClickSpark = ({x, y, energy}: {x: number; y: number; energy: number}) => {
  const radius = 24 + energy * 34;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: 1 - energy}}>
      {[0, 90, 180, 270].map((rotation) => (
        <span
          key={rotation}
          style={{
            position: 'absolute',
            left: -2,
            top: -12,
            width: 4,
            height: 17,
            borderRadius: 9,
            background: palette.orange,
            transformOrigin: `2px ${12 + radius}px`,
            transform: `translateY(-${radius}px) rotate(${rotation}deg) scaleY(${0.55 + energy * 0.45})`,
            boxShadow: '0 0 16px rgba(255,79,18,.7)',
          }}
        />
      ))}
    </div>
  );
};

const Cursor = ({frame}: {frame: number}) => {
  const sourceTime = sourceTimeAt(frame);
  const position = cursorAt(sourceTime);
  const firstAction = pointerActions[0]?.at ?? sourceStart;
  const opacity = progress(sourceTime, firstAction - 0.45, firstAction + 0.2) *
    (1 - progress(frame, finalStart - 10, finalStart + 8));
  const activeClick = clickActions.find(
    (action) => sourceTime >= action.at - 0.04 && sourceTime <= action.at + 0.42,
  );
  const clickEnergy = activeClick
    ? progress(sourceTime, activeClick.at - 0.04, activeClick.at + 0.42)
    : 0;
  const press = activeClick
    ? interpolate(sourceTime, [activeClick.at - 0.04, activeClick.at + 0.08, activeClick.at + 0.25], [0, 1, 0], clamp)
    : 0;

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity}}>
      {activeClick ? (
        <ClickSpark x={activeClick.x ?? position.x} y={activeClick.y ?? position.y} energy={clickEnergy} />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: `translate(-7px, -6px) scale(${1 - press * 0.16})`,
          transformOrigin: '8px 7px',
          filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.32))',
        }}
      >
        <CursorMark pressed={press} />
      </div>
    </div>
  );
};

type Caption = {
  start: number;
  end: number;
  index: string;
  title: React.ReactNode;
  side?: 'left' | 'right';
};

const captions: Caption[] = [
  {
    start: 88,
    end: 168,
    index: '01',
    title: <>Не макет.<br />Живой сайт.</>,
  },
  {
    start: 222,
    end: 302,
    index: '02',
    title: <>Скролл — часть<br />дизайна.</>,
    side: 'right',
  },
  {
    start: 438,
    end: 525,
    index: '03',
    title: <>Клик.<br />И сайт отвечает.</>,
  },
];

const Caption = ({frame}: {frame: number}) => {
  const caption = captions.find((item) => frame >= item.start - 14 && frame <= item.end + 14);
  if (!caption) return null;

  const enter = progress(frame, caption.start - 12, caption.start + 10);
  const leave = progress(frame, caption.end - 12, caption.end + 12);
  const opacity = enter * (1 - leave);

  return (
    <div
      style={{
        position: 'absolute',
        left: caption.side === 'right' ? 'auto' : 58,
        right: caption.side === 'right' ? 58 : 'auto',
        bottom: 82,
        width: 430,
        padding: '24px 26px 26px',
        color: palette.ink,
        background: palette.orange,
        opacity,
        transform: `translateX(${(caption.side === 'right' ? 1 : -1) * ((1 - enter) * 46 + leave * 28)}px)`,
        fontFamily: 'Arial, Helvetica, sans-serif',
        textAlign: caption.side === 'right' ? 'right' : 'left',
        boxShadow: '0 18px 44px rgba(0,0,0,.16)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: caption.side === 'right' ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          gap: 12,
          marginBottom: 13,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '.18em',
        }}
      >
        <span style={{width: 28, height: 3, background: palette.ink}} />
        {caption.index} / FLOWLINE
      </div>
      <div style={{fontSize: 39, lineHeight: 0.98, fontWeight: 900, letterSpacing: '-.035em'}}>
        {caption.title}
      </div>
    </div>
  );
};

const Signature = ({frame}: {frame: number}) => {
  const opacity = progress(frame, 4, 24) * (1 - progress(frame, finalStart - 24, finalStart));
  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        top: 34,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: palette.white,
        opacity,
        fontFamily: 'Arial, Helvetica, sans-serif',
        textShadow: '0 2px 18px rgba(0,0,0,.7)',
        mixBlendMode: 'difference',
      }}
    >
      <Img src={staticFile('/assets/brand/autocubes.svg')} style={{width: 24, height: 24, filter: 'invert(1)'}} />
      <span style={{fontSize: 12, fontWeight: 800, letterSpacing: '.16em'}}>AUTOCUBES</span>
    </div>
  );
};

const Final = ({frame}: {frame: number}) => {
  const enter = progress(frame, finalStart, finalStart + 26);
  const line = progress(frame, finalStart + 12, finalStart + 48);
  const copy = progress(frame, finalStart + 22, finalStart + 58);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: palette.ink,
        color: palette.white,
        opacity: enter,
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${line * 100}%`,
          height: 8,
          background: palette.orange,
        }}
      />
      <div style={{position: 'absolute', left: 70, right: 70, top: 120, display: 'flex', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <Img src={staticFile('/assets/brand/autocubes.svg')} style={{width: 38, height: 38, filter: 'invert(1)'}} />
          <span style={{fontSize: 17, fontWeight: 850, letterSpacing: '.12em'}}>AUTOCUBES</span>
        </div>
        <span style={{fontSize: 14, color: palette.grey, letterSpacing: '.12em'}}>WEB / MOTION</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 610,
          opacity: copy,
          transform: `translateY(${(1 - copy) * 42}px)`,
        }}
      >
        <div style={{fontSize: 82, lineHeight: 0.9, fontWeight: 900, letterSpacing: '-.055em'}}>
          Сайт остается
          <br />
          собой.
        </div>
        <div style={{marginTop: 34, fontSize: 34, lineHeight: 1.08, color: '#b9bbc2', fontWeight: 500}}>
          Меняется формат.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          bottom: 82,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 18,
          opacity: copy,
        }}
      >
        <b>autocubes.site</b>
        <span style={{color: palette.grey, textAlign: 'right'}}>Сайты, которые<br />хочется показывать.</span>
      </div>
    </div>
  );
};

export const FlowlineCursorStudy = () => {
  const frame = useCurrentFrame();
  const reveal = progress(frame, 0, 18);
  const finalWash = progress(frame, finalStart - 10, finalStart + 14);

  return (
    <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, opacity: reveal, transform: `scale(${1.018 - reveal * 0.018})`}}>
        <Capture />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,.12), transparent 18%, transparent 76%, rgba(0,0,0,.08))',
          opacity: reveal * (1 - finalWash),
        }}
      />
      <Signature frame={frame} />
      <Caption frame={frame} />
      <Cursor frame={frame} />
      <Final frame={frame} />
    </AbsoluteFill>
  );
};
