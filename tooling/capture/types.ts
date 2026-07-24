import {BrowserContext, Page} from 'playwright';
import {CaptureAction, CaptureManifest, Still} from '../../packages/core/manifest';

export type CaptureApi = {
  page: Page;
  context: BrowserContext;
  shotRoot: string;
  stills: Still[];
  actions: CaptureAction[];
  notes: string[];
  wait: (ms: number) => Promise<void>;
  screenshot: (id: string, label: string) => Promise<void>;
  smoothScrollTo: (y: number, durationMs: number) => Promise<void>;
  movePointerTo: (x: number, y: number, label: string, durationMs?: number) => Promise<void>;
  clickPoint: (x: number, y: number, label: string, durationMs?: number) => Promise<void>;
  hoverBest: (selectors: string[], label: string) => Promise<boolean>;
  clickBest: (selectors: string[], label: string) => Promise<boolean>;
};

export type ScrollKeyframe = {
  frame: number;
  y: number;
};

export type FrameLockedCaptureConfig = {
  fps: number;
  frames: number;
  scrollKeyframes: ScrollKeyframe[];
  jpegQuality?: number;
  preloadMarginPx?: number;
  warmupStepPx?: number;
  videoReadyTimeoutMs?: number;
  crf?: number;
  keepFrames?: boolean;
  maxDuplicateFrames?: number;
  maxFreezeEvents?: number;
};

export type CaptureScenario = {
  site: string;
  title: string;
  url: string;
  durationSeconds: number;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  run: (api: CaptureApi) => Promise<void>;
  frameLocked?: FrameLockedCaptureConfig;
  buildManifest?: (base: CaptureManifest) => CaptureManifest;
};
