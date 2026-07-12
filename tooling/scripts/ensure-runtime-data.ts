import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const copies = [
  ['data/examples/editor-project.json', 'data/generated/editor-project.json'],
  ['data/examples/flowline-manifest.json', 'data/generated/flowline-manifest.json'],
  ['data/examples/flowline.editor.json', 'data/projects/flowline.editor.json'],
] as const;

const main = async () => {
  for (const [sourceRelative, targetRelative] of copies) {
    const source = path.join(root, sourceRelative);
    const target = path.join(root, targetRelative);
    try {
      await fs.access(target);
    } catch {
      await fs.mkdir(path.dirname(target), {recursive: true});
      await fs.copyFile(source, target);
      console.log(`Created runtime seed: ${targetRelative}`);
    }
  }
};

void main().catch((error) => {console.error(error);process.exitCode = 1;});
