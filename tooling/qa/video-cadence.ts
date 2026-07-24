import fs from 'node:fs/promises';
import path from 'node:path';
import {CaptureManifest} from '../../packages/core/manifest';
import {manifestPath, rootDir, shotDir} from '../../packages/core/paths';
import {inspectVideoCadence} from '../capture/frame-locked';

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const allowStatic = args.includes('--allow-static');
const explicitVideo = option('--video');
const fps = Number(option('--fps') ?? 30);
const site = args.find((argument) => !argument.startsWith('--') && argument !== explicitVideo) ?? 'flowline';

const main = async () => {
  let videoFile: string;
  let expectedFrames: number | undefined;

  if (explicitVideo) {
    videoFile = path.resolve(rootDir, explicitVideo);
  } else {
    const manifest = JSON.parse(
      await fs.readFile(manifestPath(site), 'utf8'),
    ) as CaptureManifest;
    if (!manifest.video) throw new Error(`Capture manifest for ${site} has no video`);
    videoFile = path.join(shotDir(site), manifest.video);
    expectedFrames = Math.round(manifest.durationSeconds * fps);
  }

  const report = await inspectVideoCadence(videoFile, {
    expectedFps: fps,
    expectedFrames,
    maxDuplicateFrames: allowStatic ? Number.POSITIVE_INFINITY : 0,
    maxFreezeEvents: allowStatic ? Number.POSITIVE_INFINITY : 0,
  });
  console.log(JSON.stringify(report, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
