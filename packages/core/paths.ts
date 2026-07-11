import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(here, '..', '..');
export const shotsDir = path.join(rootDir, 'shots');
export const publicDir = path.join(rootDir, 'public');

export const shotDir = (name: string) => path.join(shotsDir, name);
export const manifestPath = (name: string) => path.join(shotDir(name), 'manifest.json');
