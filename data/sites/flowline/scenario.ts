import {CaptureScenario} from '../../../tooling/capture/types';

export const flowlineScenario: CaptureScenario = {
  site: 'flowline',
  title: 'Flowline',
  url: 'https://portfolio.autocubes.site/flowline',
  durationSeconds: 22,
  viewport: {
    width: 1080,
    height: 1920,
    deviceScaleFactor: 1,
  },
  run: async ({
    page,
    wait,
    screenshot,
    smoothScrollTo,
    hoverBest,
    clickBest,
    clickPoint,
    movePointerTo,
    notes,
  }) => {
    await page.goto('https://portfolio.autocubes.site/flowline', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.addStyleTag({
      content: `
        * { cursor: none !important; }
        html { scroll-behavior: auto !important; }
      `,
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(420);
    await screenshot('01-hero', 'Hero');

    await movePointerTo(858, 60, 'Menu button', 460);
    await clickPoint(858, 60, 'Open navigation', 180);
    await wait(520);
    await screenshot('02-menu-open', 'Menu open');

    await clickPoint(858, 60, 'Close navigation', 300);
    await wait(280);

    await hoverBest(
      [
        'a:has-text("Start tracking for free")',
        'button',
        '[role="button"]',
        '[data-hover]',
        '.button',
        '.btn',
        'canvas',
      ],
      'hero-interaction',
    );
    await wait(420);
    await screenshot('03-hero-hover', 'Hero hover');

    const metrics = await page.evaluate(() => ({
      height: Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      ),
      viewport: window.innerHeight,
    }));

    const maxScroll = Math.max(0, metrics.height - metrics.viewport);
    notes.push(`page-height:${metrics.height}`);

    const stops = [0.2, 0.42, 0.66, 0.82, 0.9].map((position) =>
      Math.round(maxScroll * position),
    );

    await smoothScrollTo(stops[0], 1250);
    await wait(420);
    await screenshot('04-section-a', 'Section A');

    await hoverBest(
      [
        'a:has-text("Download for iPhone"):visible',
        'button:visible',
        '[role="button"]:visible',
        '[class*="card"]:visible',
        '[class*="item"]:visible',
      ],
      'middle-interaction',
    );
    await wait(380);
    await screenshot('05-section-a-hover', 'Section A hover');

    await smoothScrollTo(stops[1], 1250);
    await wait(360);
    await screenshot('06-section-b', 'Section B');

    await smoothScrollTo(stops[2], 1350);
    await wait(360);
    await screenshot('07-section-c', 'Section C');

    await smoothScrollTo(stops[3], 1350);
    await wait(340);
    await clickBest(['button[aria-label="Next"]:visible'], 'Next testimonial');
    await wait(560);
    await screenshot('09-real-click', 'Real carousel click');

    await smoothScrollTo(stops[4], 1200);
    await wait(620);
    await screenshot('10-final', 'Final');
  },
};
