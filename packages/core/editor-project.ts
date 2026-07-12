export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';
export type TransitionKind = 'cut' | 'fade' | 'blur' | 'dipBlack' | 'dipWhite' | 'wipe' | 'slide' | 'zoomBlur' | 'flash';
export type PointerKind = 'move' | 'click' | 'hover';
export type TimeDisplay = 'timecode' | 'seconds' | 'frames';
export type CaptionAnimation = 'none' | 'fade' | 'rise' | 'scale' | 'words';
export type OverlayKind = 'logo' | 'progress' | 'label' | 'cta' | 'frame' | 'grain';

export type ScrollFrame = {
  id: string;
  label: string;
  at: number;
  scrollY: number;
  duration: number;
  hold: number;
  easing: EasingName;
  thumbnail?: string;
};

export type PointerEvent = {
  id: string;
  label: string;
  at: number;
  duration: number;
  kind: PointerKind;
  x: number;
  y: number;
  selector?: string;
  easing: EasingName;
  visible: boolean;
};

export type TransitionEvent = {
  id: string;
  label: string;
  at: number;
  duration: number;
  kind: TransitionKind;
  strength: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  color?: string;
};

export type AudioEvent = {
  id: string;
  label: string;
  at: number;
  duration: number;
  asset: string;
  volume: number;
  enabled: boolean;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
  category?: 'music' | 'voice' | 'sfx';
  beatInterval?: number;
  ducking?: boolean;
};

export type CaptionEvent = {
  id: string;
  label: string;
  text: string;
  at: number;
  duration: number;
  position: 'top' | 'center' | 'bottom';
  style: 'clean' | 'boxed' | 'accent';
  size: number;
  x?: number;
  y?: number;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  animation?: CaptionAnimation;
  color?: string;
  background?: string;
};

export type OverlayEvent = {
  id: string;
  label: string;
  text: string;
  at: number;
  duration: number;
  kind: OverlayKind;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  color: string;
};

export type TimelineMarker = {id: string; label: string; at: number; color?: string};

export type EditorProject = {
  version: number;
  id: string;
  title: string;
  url: string;
  fps: number;
  duration: number;
  viewport: {width: number; height: number};
  guides?: boolean;
  snap?: boolean;
  timeDisplay?: TimeDisplay;
  playbackRate?: number;
  masterVolume?: number;
  exportRange?: {in: number; out: number};
  pageHeight: number;
  previewVideo?: string;
  videoOffset?: number;
  frames: ScrollFrame[];
  pointer: PointerEvent[];
  transitions: TransitionEvent[];
  captions: CaptionEvent[];
  audio: AudioEvent[];
  overlays?: OverlayEvent[];
  markers?: TimelineMarker[];
};

export type Selection = {
  track: 'frames' | 'pointer' | 'transitions' | 'captions' | 'audio' | 'overlays' | 'project';
  id?: string;
  ids?: string[];
};

export type AssetLibrary = {
  audio: string[];
  images: string[];
  videos: string[];
};

export type JobState = {
  id: string;
  kind: 'capture' | 'render';
  status: 'running' | 'complete' | 'failed';
  log: string[];
  outputUrl?: string;
};

export type ProjectSummary = Pick<EditorProject, 'id' | 'title' | 'url'>;
