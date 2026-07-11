export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';
export type TransitionKind = 'cut' | 'fade' | 'blur' | 'dipBlack' | 'dipWhite';
export type PointerKind = 'move' | 'click' | 'hover';

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
};

export type AudioEvent = {
  id: string;
  label: string;
  at: number;
  duration: number;
  asset: string;
  volume: number;
  enabled: boolean;
};

export type EditorProject = {
  version: number;
  id: string;
  title: string;
  url: string;
  fps: number;
  duration: number;
  viewport: {width: number; height: number};
  pageHeight: number;
  previewVideo?: string;
  videoOffset?: number;
  frames: ScrollFrame[];
  pointer: PointerEvent[];
  transitions: TransitionEvent[];
  audio: AudioEvent[];
};

export type Selection = {
  track: 'frames' | 'pointer' | 'transitions' | 'audio' | 'project';
  id?: string;
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
};

export type ProjectSummary = Pick<EditorProject, 'id' | 'title' | 'url'>;
