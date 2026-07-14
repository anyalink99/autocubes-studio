export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';
export type MotionProfile = 'cinematic' | 'balanced' | 'snappy';
export type PointerPath = 'human' | 'arc' | 'direct';
export type TransitionKind = 'cut' | 'fade' | 'blur' | 'dipBlack' | 'dipWhite' | 'wipe' | 'slide' | 'zoomBlur' | 'flash';
export type PointerKind = 'move' | 'click' | 'hover';
export type OutputLanguage = 'en' | 'ru';

export type CaptureSection = {id:string; label:string; selector:string; scrollY:number; level:number};
export type CaptureTarget = {id:string; label:string; selector:string; role:string; x:number; y:number; pageY:number; width:number; height:number};
export type CaptureAnalysis = {
  url:string;
  title:string;
  pageHeight:number;
  analyzedAt:string;
  fullPageImage:string;
  sections:CaptureSection[];
  targets:CaptureTarget[];
};
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
  motionProfile?: MotionProfile;
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
  targetLabel?: string;
  clickEffect?: 'pulse' | 'ring' | 'none';
  path?: PointerPath;
  curve?: number;
  settle?: number;
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
  textEn?: string;
  textRu?: string;
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
  textEn?: string;
  textRu?: string;
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
  outputLanguage?: OutputLanguage;
  motionProfile?: MotionProfile;
  cursorScale?: number;
  cursorTrail?: boolean;
  captureAnalysis?: CaptureAnalysis;
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
