import fs from 'node:fs/promises';
import path from 'node:path';
import {Page} from 'playwright';

export const ensureCleanDir = async (dir: string) => {
  await fs.rm(dir, {recursive: true, force: true});
  await fs.mkdir(dir, {recursive: true});
};

export const fileExists = async (file: string) => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const normalizePath = (file: string) => file.split(path.sep).join('/');

export const scrollPageTo = async (page: Page, y: number, durationMs: number) => {
  await page.evaluate(`
    new Promise((resolve) => {
      const targetY = ${JSON.stringify(y)};
      const duration = ${JSON.stringify(durationMs)};
      const startY = window.scrollY;
      const diff = targetY - startY;
      const start = performance.now();
      const tick = (now) => {
        const raw = Math.min(1, (now - start) / duration);
        const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
        window.scrollTo(0, startY + diff * eased);
        if (raw < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    })
  `);
};
