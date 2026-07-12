import fs from 'node:fs';
import path from 'node:path';

const sampleRate = 48000;
const outputDir = path.resolve('public/assets/sfx');

type StereoSample = [number, number];

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

const randomGenerator = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const normalize = (samples: StereoSample[], peak = 0.78) => {
  const currentPeak = samples.reduce(
    (maximum, [left, right]) => Math.max(maximum, Math.abs(left), Math.abs(right)),
    0,
  );
  const gain = currentPeak === 0 ? 1 : peak / currentPeak;
  return samples.map(([left, right]) => [left * gain, right * gain] as StereoSample);
};

const writeWav = (file: string, samples: StereoSample[]) => {
  const channels = 2;
  const bitDepth = 16;
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = samples.length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach(([left, right], index) => {
    const offset = 44 + index * blockAlign;
    buffer.writeInt16LE(Math.round(clamp(left) * 32767), offset);
    buffer.writeInt16LE(Math.round(clamp(right) * 32767), offset + 2);
  });

  fs.writeFileSync(path.join(outputDir, file), buffer);
};

const createScroll = (seed: number, brightness: number, direction: number) => {
  const duration = 0.92;
  const count = Math.round(duration * sampleRate);
  const random = randomGenerator(seed);
  const samples: StereoSample[] = [];
  let fast = 0;
  let slow = 0;
  let phase = 0;

  for (let index = 0; index < count; index += 1) {
    const seconds = index / sampleRate;
    const t = seconds / duration;
    const noise = random() * 2 - 1;
    fast += (noise - fast) * (0.09 + brightness * 0.035);
    slow += (noise - slow) * 0.008;
    const band = fast - slow;
    const envelope = Math.pow(Math.sin(Math.PI * t), 1.9) * Math.pow(1 - t * 0.18, 2);
    const frequency = 155 + brightness * 55 + t * 80;
    phase += (Math.PI * 2 * frequency) / sampleRate;
    const body = Math.sin(phase) * 0.055;
    const signal = (band * (0.82 + brightness * 0.18) + body) * envelope;
    const pan = direction * (-0.32 + t * 0.64);
    const left = signal * Math.sqrt((1 - pan) / 2);
    const right = signal * Math.sqrt((1 + pan) / 2);
    samples.push([left, right]);
  }

  return normalize(samples, 0.58);
};

const createSectionLift = () => {
  const duration = 1.15;
  const count = Math.round(duration * sampleRate);
  const random = randomGenerator(4812);
  const samples: StereoSample[] = [];
  let filtered = 0;
  let phase = 0;

  for (let index = 0; index < count; index += 1) {
    const seconds = index / sampleRate;
    const t = seconds / duration;
    const noise = random() * 2 - 1;
    filtered += (noise - filtered) * (0.035 + t * 0.09);
    const envelope = Math.pow(Math.sin(Math.PI * t), 1.35) * Math.pow(1 - t * 0.12, 2);
    phase += (Math.PI * 2 * (92 + t * 74)) / sampleRate;
    const signal = (filtered * 0.7 + Math.sin(phase) * 0.08) * envelope;
    samples.push([signal * (0.72 - t * 0.12), signal * (0.6 + t * 0.12)]);
  }

  return normalize(samples, 0.62);
};

const createEndMark = () => {
  const duration = 1.05;
  const count = Math.round(duration * sampleRate);
  const random = randomGenerator(2607);
  const samples: StereoSample[] = [];
  let lowPhase = 0;
  let overtonePhase = 0;

  for (let index = 0; index < count; index += 1) {
    const seconds = index / sampleRate;
    const t = seconds / duration;
    const lowFrequency = 78 - t * 20;
    lowPhase += (Math.PI * 2 * lowFrequency) / sampleRate;
    overtonePhase += (Math.PI * 2 * 156) / sampleRate;
    const low = Math.sin(lowPhase) * Math.exp(-5.2 * t) * 0.7;
    const overtone = Math.sin(overtonePhase) * Math.exp(-8.5 * t) * 0.12;
    const transient = (random() * 2 - 1) * Math.exp(-34 * t) * 0.32;
    const signal = low + overtone + transient;
    samples.push([signal * 0.92, signal]);
  }

  return normalize(samples, 0.72);
};

fs.mkdirSync(outputDir, {recursive: true});
writeWav('scroll-soft-a.wav', createScroll(1107, 0.25, 1));
writeWav('scroll-soft-b.wav', createScroll(2209, 0.55, -1));
writeWav('scroll-soft-c.wav', createScroll(3313, 0.82, 1));
writeWav('section-lift.wav', createSectionLift());
writeWav('end-mark.wav', createEndMark());

console.log(`Generated SFX in ${outputDir}`);
