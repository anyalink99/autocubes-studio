import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const video = path.join(root, 'out', 'flowline-reel.mp4');
const outputDir = path.join(root, 'out', 'audio-previews');
const musicDir = path.join(root, 'public', 'assets', 'music');
const sfxDir = path.join(root, 'public', 'assets', 'sfx');
const duration = 19.05;

const tracks = [
  {id: 'hazy', file: 'hazy-after-hours.mp3', start: 12, title: 'Hazy After Hours'},
  {id: 'digital', file: 'digital-clouds.mp3', start: 8, title: 'Digital Clouds'},
  {id: 'opalescent', file: 'opalescent.mp3', start: 20, title: 'Opalescent'},
  {id: 'deep', file: 'deep-techno-ambience.mp3', start: 10, title: 'Deep Techno Ambience'},
];

const sfx = [
  {file: 'section-lift.wav', delay: 1900, volume: 0.2},
  {file: 'scroll-soft-a.wav', delay: 6600, volume: 0.3},
  {file: 'scroll-soft-b.wav', delay: 8700, volume: 0.25},
  {file: 'scroll-soft-c.wav', delay: 10700, volume: 0.27},
  {file: 'scroll-soft-b.wav', delay: 14400, volume: 0.22},
  {file: 'end-mark.wav', delay: 16500, volume: 0.3},
];

if (!fs.existsSync(video)) {
  throw new Error(`Missing video: ${video}`);
}

fs.mkdirSync(outputDir, {recursive: true});

for (const track of tracks) {
  const inputs = ['-i', video, '-i', path.join(musicDir, track.file)];
  sfx.forEach((effect) => inputs.push('-i', path.join(sfxDir, effect.file)));

  const filters = [
    `[1:a]atrim=start=${track.start}:duration=${duration},asetpts=PTS-STARTPTS,loudnorm=I=-26:TP=-5:LRA=7,afade=t=in:st=0:d=0.8,afade=t=out:st=17.2:d=1.8[music]`,
    ...sfx.map(
      (effect, index) =>
        `[${index + 2}:a]adelay=${effect.delay}:all=1,volume=${effect.volume}[s${index}]`,
    ),
    `[music]${sfx.map((_, index) => `[s${index}]`).join('')}amix=inputs=${sfx.length + 1}:duration=longest:normalize=0,alimiter=limit=0.9,atrim=duration=${duration}[audio]`,
  ];

  const output = path.join(outputDir, `flowline-${track.id}.mp4`);
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      ...inputs,
      '-filter_complex',
      filters.join(';'),
      '-map',
      '0:v:0',
      '-map',
      '[audio]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-b:a',
      '256k',
      '-metadata:s:a:0',
      `title=${track.title}`,
      '-shortest',
      output,
    ],
    {stdio: 'inherit'},
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${track.id}`);
  }
}

console.log(`Audio previews written to ${outputDir}`);
