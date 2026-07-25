export type BuildComponentKey =
  | "navigation"
  | "heroCopy"
  | "actions"
  | "heroMedia"
  | "cards";

export type BuildFrames = Record<BuildComponentKey, number>;

export type BuildStep = {
  key: BuildComponentKey;
  label: string;
  figmaGrab: number;
  figmaDrop: number;
  figmaSource: {x: number; y: number};
  figmaTarget: {x: number; y: number};
  code: string;
  codeStart: number;
  codeDuration: number;
};

export const BUILD_STEPS: BuildStep[] = [
  {
    key: "navigation",
    label: "Navigation",
    figmaGrab: 8,
    figmaDrop: 18,
    figmaSource: {x: 128, y: 323},
    figmaTarget: {x: 540, y: 310},
    code: "    <Navigation />",
    codeStart: 31,
    codeDuration: 15,
  },
  {
    key: "heroCopy",
    label: "Hero Copy",
    figmaGrab: 31,
    figmaDrop: 41,
    figmaSource: {x: 128, y: 367},
    figmaTarget: {x: 540, y: 484},
    code: "    <HeroCopy />",
    codeStart: 48,
    codeDuration: 18,
  },
  {
    key: "actions",
    label: "Actions",
    figmaGrab: 54,
    figmaDrop: 64,
    figmaSource: {x: 128, y: 411},
    figmaTarget: {x: 540, y: 667},
    code: "    <Actions />",
    codeStart: 68,
    codeDuration: 17,
  },
  {
    key: "heroMedia",
    label: "Hero Media",
    figmaGrab: 81,
    figmaDrop: 91,
    figmaSource: {x: 128, y: 455},
    figmaTarget: {x: 540, y: 746},
    code: "    <HeroMedia source={heroImage} />",
    codeStart: 87,
    codeDuration: 24,
  },
  {
    key: "cards",
    label: "Habit Cards",
    figmaGrab: 108,
    figmaDrop: 118,
    figmaSource: {x: 128, y: 499},
    figmaTarget: {x: 540, y: 842},
    code: "    <HabitCards />",
    codeStart: 113,
    codeDuration: 22,
  },
];

export const FIGMA_BUILD_FRAMES = Object.fromEntries(
  BUILD_STEPS.map((step) => [step.key, step.figmaDrop]),
) as BuildFrames;

export const CODE_BUILD_FRAMES = Object.fromEntries(
  BUILD_STEPS.map((step) => [
    step.key,
    step.codeStart + step.codeDuration,
  ]),
) as BuildFrames;

export const getMountedStep = (
  frame: number,
  buildFrames: BuildFrames,
): BuildStep | null => {
  const mounted = BUILD_STEPS.filter(
    (step) => frame >= buildFrames[step.key],
  );

  return mounted.length > 0 ? mounted[mounted.length - 1] : null;
};

