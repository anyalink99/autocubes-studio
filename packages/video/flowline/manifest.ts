import {staticFile} from 'remotion';
import {CaptureManifest} from '../../core/manifest';
import manifestJson from '../../../data/generated/flowline-manifest.json';

export const loadFlowlineManifest = (): CaptureManifest =>
  manifestJson as CaptureManifest;

export const shotAsset = (relative: string) =>
  staticFile(`/captures/flowline/${relative}`);
