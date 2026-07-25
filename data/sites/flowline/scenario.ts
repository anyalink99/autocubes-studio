import {CaptureScenario} from '../../../tooling/capture/types';

export const flowlineScenario: CaptureScenario = {
  site: 'flowline',
  title: 'Flowline',
  url: 'https://portfolio.autocubes.site/flowline',
  durationSeconds: 610 / 30,
  viewport: {
    width: 1080,
    height: 1920,
    deviceScaleFactor: 1,
  },
  frameLocked: {
    fps: 30,
    frames: 610,
    scrollKeyframes: [
      {frame: 0, y: 0},
      {frame: 90, y: 450},
      {frame: 180, y: 2200},
      {frame: 270, y: 4200},
      {frame: 360, y: 6400},
      {frame: 450, y: 8500},
      {frame: 540, y: 10300},
      {frame: 609, y: 11450},
    ],
    preloadMarginPx: 500,
    warmupStepPx: 1000,
    videoReadyTimeoutMs: 12000,
    jpegQuality: 92,
    crf: 16,
    maxDuplicateFrames: 0,
    maxFreezeEvents: 0,
    maxTemporalSpikeEvents: 0,
    maxEmbeddedDuplicateRatio: 0.25,
    maxEmbeddedLoopWraps: 0,
    embeddedVideoNormalizations: [
      {
        src: 'https://framerusercontent.com/assets/PRGg2Q31L3cBm9aIlNsOfMD8QL8.mp4',
        sourceFps: 24,
      },
      {
        src: 'https://framerusercontent.com/assets/TwMQMPf1H0P9cYfxE88cxOnb0qU.mp4',
        sourceFps: 30,
      },
      {
        src: 'https://framerusercontent.com/assets/nG8aNSXF9bVc3wia1eVPP35Z5c8.mp4',
        sourceFps: 30,
      },
      {
        src: 'https://framerusercontent.com/assets/wBHfmVdBC9k7z6MAlqRq6AD7ZWw.mp4',
        sourceFps: 30,
      },
      {
        src: 'https://framerusercontent.com/assets/yjuD7GFXupvQlqYR8xjXBuh5oc.mp4',
        sourceFps: 30,
      },
    ],
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
