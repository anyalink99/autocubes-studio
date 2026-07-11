export type Still = {
  id: string;
  file: string;
  at: number;
  label: string;
};

export type CaptureAction = {
  id: string;
  type: 'move' | 'hover' | 'click' | 'scroll';
  label: string;
  at: number;
  x?: number;
  y?: number;
  duration?: number;
  target?: string;
};

export type CaptureManifest = {
  site: string;
  title: string;
  url: string;
  capturedAt: string;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  video?: string;
  durationSeconds: number;
  stills: Still[];
  actions: CaptureAction[];
  notes: string[];
};
