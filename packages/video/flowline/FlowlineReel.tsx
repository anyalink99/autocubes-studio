import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  Video,
} from 'remotion';
import {loadFlowlineManifest, shotAsset} from './manifest';

const manifest = loadFlowlineManifest();
const fps = 30;
const videoStart = 45;
const sourceStart = 0;
const playbackRate = 1;
const finalStart = 495;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const progress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

const BrowserPass = () => {
  const frame = useCurrentFrame();
  if (!manifest.video) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: progress(frame, 0, 18),
        transform: `scale(${1.012 - progress(frame, 0, 30) * 0.012})`,
      }}
    >
      <Video
        src={shotAsset(manifest.video)}
        muted
        startFrom={Math.round(sourceStart * fps)}
        playbackRate={playbackRate}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    </div>
  );
};

const Opening = ({frame}: {frame: number}) => {
  const still = manifest.stills.find((item) => item.id === '01-hero') ?? manifest.stills[0];
  if (!still) return null;

  const reveal = progress(frame, 0, 16);
  const leave = progress(frame, 66, 86);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: reveal * (1 - leave)}}>
      <Img src={shotAsset(still.file)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <div
        style={{
          position: 'absolute',
          left: 42,
          top: 124,
          color: '#fff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          textShadow: '0 3px 22px rgba(0,0,0,.55)',
          transform: `translateY(${(1 - reveal) * 18}px)`,
        }}
      >
        <div style={{fontSize: 15, fontWeight: 900, letterSpacing: '.16em'}}>FLOWLINE</div>
        <div style={{marginTop: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', opacity: 0.72}}>
          WEBSITE · 2026
        </div>
      </div>
    </div>
  );
};

const StudioMark = ({frame}: {frame: number}) => {
  const opacity = progress(frame, 76, 100) * (1 - progress(frame, finalStart - 24, finalStart));

  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        top: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        color: '#fff',
        opacity: opacity * 0.86,
        mixBlendMode: 'difference',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <Img src={staticFile('/assets/brand/autocubes.svg')} style={{width: 22, height: 22, filter: 'invert(1)'}} />
      <span style={{fontSize: 11, fontWeight: 900, letterSpacing: '.15em'}}>AUTOCUBES</span>
    </div>
  );
};

const FinalCard = ({frame}: {frame: number}) => {
  const enter = progress(frame, finalStart, finalStart + 24);
  const content = progress(frame, finalStart + 10, finalStart + 38);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#f4f4f2',
        color: '#101114',
        opacity: enter,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${content * 100}%`,
          height: 7,
          background: '#ff4f12',
        }}
      />

      <div style={{position: 'absolute', left: 68, right: 68, top: 74, display: 'flex', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <Img src={staticFile('/assets/brand/autocubes.svg')} style={{width: 30, height: 30}} />
          <span style={{fontSize: 14, fontWeight: 900, letterSpacing: '.14em'}}>AUTOCUBES</span>
        </div>
        <span style={{fontSize: 13, fontWeight: 700, letterSpacing: '.12em', color: '#77797f'}}>2026</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          top: 660,
          opacity: content,
          transform: `translateY(${(1 - content) * 32}px)`,
        }}
      >
        <div style={{fontSize: 100, lineHeight: 0.9, fontWeight: 900, letterSpacing: '-.06em'}}>FLOWLINE</div>
        <div style={{width: 94, height: 6, marginTop: 32, background: '#ff4f12'}} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 68,
          right: 68,
          bottom: 72,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          paddingTop: 24,
          borderTop: '1px solid #c9c9c5',
          opacity: content,
          fontSize: 16,
          lineHeight: 1.5,
        }}
      >
        <div>
          <div style={{fontWeight: 800}}>Website</div>
          <div style={{color: '#77797f'}}>Design & development</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontWeight: 800}}>Autocubes</div>
          <div style={{color: '#77797f'}}>autocubes.site</div>
        </div>
      </div>
    </div>
  );
};

export const FlowlineReel = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: '#101114', overflow: 'hidden'}}>
      <Opening frame={frame} />
      <Sequence from={videoStart} durationInFrames={finalStart - videoStart + 20}>
        <BrowserPass />
      </Sequence>
      <StudioMark frame={frame} />
      <FinalCard frame={frame} />
    </AbsoluteFill>
  );
};
