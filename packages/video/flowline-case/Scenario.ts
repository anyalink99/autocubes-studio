export const FLOWLINE_CASE_FPS = 30;
export const FLOWLINE_CASE_DURATION = 1380;

export const FLOWLINE_CASE_CUTS = {
  hook: 0,
  figma: 161,
  code: 305,
  runtime: 457,
  motion: 669,
  montage: 1095,
  final: 1210,
  end: FLOWLINE_CASE_DURATION,
} as const;

export const FLOWLINE_CASE_CHAPTERS = [
  {
    id: 'hook',
    label: 'Hook',
    start: FLOWLINE_CASE_CUTS.hook,
    end: FLOWLINE_CASE_CUTS.figma,
    time: '00:00.000–00:05.367',
    visual:
      'Flowline title resolves while DESIGN, CODE, and MOTION progress bars complete in sequence.',
    onScreen: ['FLOW / LINE', 'DESIGN', 'CODE', 'MOTION'],
    purpose: 'Introduce Flowline and the design → code → motion progression.',
  },
  {
    id: 'figma',
    label: 'Figma build',
    start: FLOWLINE_CASE_CUTS.figma,
    end: FLOWLINE_CASE_CUTS.code,
    time: '00:05.367–00:10.167',
    visual:
      'A recognizable Figma workspace assembles the hero frame layer by layer with a synchronized cursor.',
    onScreen: ['FLOWLINE / FIGMA', 'COMPONENT ASSEMBLY'],
    purpose: 'Assemble the interface from visible design components.',
  },
  {
    id: 'code',
    label: 'Code build',
    start: FLOWLINE_CASE_CUTS.code,
    end: FLOWLINE_CASE_CUTS.runtime,
    time: '00:10.167–00:15.233',
    visual:
      'Typed React components mount one by one into a clean live preview below the editor.',
    onScreen: ['FLOWLINE / COMPONENT BUILD', 'CODE → DOM'],
    purpose: 'Synchronize typed components with the interface being mounted.',
  },
  {
    id: 'runtime',
    label: 'Runtime reveal',
    start: FLOWLINE_CASE_CUTS.runtime,
    end: FLOWLINE_CASE_CUTS.motion,
    time: '00:15.233–00:22.300',
    visual:
      'The constructed hero becomes the real site inside a framed, frame-locked browser capture.',
    onScreen: ['FLOWLINE / RUNTIME', 'BUILD SUCCESS'],
    purpose: 'Reveal the completed live site and its native behavior.',
  },
  {
    id: 'motion',
    label: 'Motion showcase',
    start: FLOWLINE_CASE_CUTS.motion,
    end: FLOWLINE_CASE_CUTS.montage,
    time: '00:22.300–00:36.500',
    visual:
      'Continuous live-site motion showcases the scroll flow, routines, metrics, phone, globe, and social cards.',
    onScreen: ['PAGE FLOW', 'ROUTINES', 'METRICS', 'SOCIAL PROOF', 'AI + REVIEWS'],
    purpose: 'Present the strongest scroll, 3D, phone, and carousel moments.',
  },
  {
    id: 'montage',
    label: 'Case montage',
    start: FLOWLINE_CASE_CUTS.montage,
    end: FLOWLINE_CASE_CUTS.final,
    time: '00:36.500–00:40.333',
    visual:
      'Four vertical page details land as a compact evidence montage of the finished system.',
    onScreen: ['FLOWLINE / MOTION', 'LIVE SITE'],
    purpose: 'Summarize the completed system through selected page details.',
  },
  {
    id: 'final',
    label: 'Autocubes end card',
    start: FLOWLINE_CASE_CUTS.final,
    end: FLOWLINE_CASE_CUTS.end,
    time: '00:40.333–00:46.000',
    visual:
      'Flowline resolves into the full-screen Autocubes logo on the final musical beats.',
    onScreen: ['FLOW / LINE.', 'autocubes'],
    purpose: 'Resolve the case into the Autocubes brand signature.',
  },
] as const;

/**
 * Scenario editing map
 *
 * - Change chapter boundaries in FLOWLINE_CASE_CUTS.
 * - Change Figma/code construction beats in BuildTimeline.ts.
 * - Change scene layout and on-screen copy in FlowlineLevelReel.tsx.
 * - The stabilized live-site master is
 *   public/assets/flowline-case/motion-source/motion-tour-studio30.mp4.
 */
