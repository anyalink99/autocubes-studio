import fs from 'node:fs/promises';
import {Browser, chromium} from 'playwright';

const missingBrowser = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /Executable doesn't exist|browserType\.launch/i.test(message);
};

export const launchStudioBrowser = async (): Promise<Browser> => {
  const bundledPath = chromium.executablePath();
  const bundledExists = await fs.access(bundledPath).then(() => true).catch(() => false);
  if (bundledExists) return chromium.launch({headless: true});

  // Системный Chrome позволяет продолжить работу после обновления Playwright,
  // пока новая bundled-ревизия ещё не установлена.
  try {
    return await chromium.launch({headless: true, channel: 'chrome'});
  } catch (error) {
    if (!missingBrowser(error)) throw error;
    throw new Error('Браузер для захвата не установлен. Выполните «npm run browsers:install», затем перезапустите Autocubes Studio.');
  }
};
