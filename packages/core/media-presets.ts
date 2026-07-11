export const mediaPresets = [
  {
    id: 'instagram-reel', label: 'Reel / Story', shortLabel: '9:16',
    width: 1080, height: 1920, kind: 'video',
    safeArea: {top: 8, right: 6, bottom: 20, left: 6},
  },
  {
    id: 'instagram-portrait', label: 'Feed portrait', shortLabel: '4:5',
    width: 1080, height: 1350, kind: 'image',
    safeArea: {top: 5, right: 5, bottom: 5, left: 5},
  },
  {
    id: 'instagram-square', label: 'Feed square', shortLabel: '1:1',
    width: 1080, height: 1080, kind: 'image',
    safeArea: {top: 5, right: 5, bottom: 5, left: 5},
  },
  {
    id: 'instagram-landscape', label: 'Feed landscape', shortLabel: '1.91:1',
    width: 1080, height: 566, kind: 'image',
    safeArea: {top: 6, right: 5, bottom: 6, left: 5},
  },
] as const;

export type MediaPreset = (typeof mediaPresets)[number];
export type MediaPresetId = MediaPreset['id'] | 'custom';

export const findMediaPreset = (width: number, height: number) =>
  mediaPresets.find((preset) => preset.width === width && preset.height === height);

export const formatRatio = (width: number, height: number) => {
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
};

const greatestCommonDivisor = (a: number, b: number): number => b ? greatestCommonDivisor(b, a % b) : a;
