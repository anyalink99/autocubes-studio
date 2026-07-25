---
name: autocubes-video-pipeline
description: Build, repair, capture, render, and QA Autocubes browser-case reels with Remotion. Use for live website recordings, design-to-code process scenes, unstable or low FPS footage, frozen browser animations, lazy or remounted video elements, cursor/SFX synchronization, or final MP4 cadence checks.
---

# Autocubes Video Pipeline

Create polished case reels from a website without inheriting Playwright `recordVideo` cadence problems. Treat browser motion, Remotion motion, edit timing, and audio timing as one frame-based system.

Use this project skill together with the [project-local Remotion Agent Skills](../README.md) vendored in the sibling skill directories. The repository includes the complete upstream collection, so do not depend on a per-user or global skill installation.

Read [references/frame-locked-capture.md](references/frame-locked-capture.md) before changing capture timing, browser animation control, embedded video handling, or video QA.

## Workflow

1. Inspect the target scenario, Remotion composition, manifest, and existing media before changing files.
2. Put the final browser pass behind `CaptureScenario.frameLocked`. Do not use the WebM from Playwright `recordVideo` as presentation footage.
3. Define a deliberate scroll curve with frame/y keyframes. Prewarm the full page, then capture a JPEG sequence at the composition FPS.
4. Preserve the browser's monotonic timestamp when enabling the virtual clock. Advance `requestAnimationFrame` twice per output frame at half-frame intervals.
5. Reassert the requested `scrollY` after stepping animation callbacks and fail if actual scroll differs from the clamped target.
6. Use DOM videos only for layout. Normalize every featured source to the output FPS, extract it once into a cached JPEG sequence, and never depend on a repeatedly-seeked Chromium surface for final footage.
7. Rediscover all connected `<video>` nodes every frame. Give every responsive/carousel clone its own persistent canvas and never move one canvas between clones. Insert each proxy beside its video so ancestor clipping, transforms, opacity, border radii, and stacking remain intact. Keep horizontal clones alive even when offscreen; only skip cached-frame loading when the entire source is vertically away from the viewport. For autoplay carousels, snap the media list transform to a complete slide once, retain that first locked transform, and reassert the exact same value on every frame. Never recompute the nearest slide from a moving autoplay phase. Force every clone ancestor inside that list to `visibility: visible` and `opacity: 1`; the outer carousel still clips distant clones, while the virtual-clock start phase can no longer expose a one-card transitional state. Explicitly disable native video controls.
8. Encode the sequence to H.264 CFR with `yuv420p`; run cadence and temporal-discontinuity QA before the clip enters Remotion.
9. Keep Remotion timing frame-driven. Avoid `playbackRate` or arbitrary source offsets used to conceal capture defects.
10. Render the final MP4 and run cadence QA again. Static end cards may opt into `--allow-static`; live browser captures may not.

## Project Commands

For Flowline:

```powershell
npm run capture:flowline
npm run qa:capture:flowline
npm run render:flowline
npm run qa:render:flowline
```

Use `npm run make:flowline` for the complete sequence.

## Process Scenes

- Reconstruct Figma and code scenes from explicit layers/components; do not place a second full website copy over an already complete website.
- Give each build step one owner on the timeline: cursor move, click/SFX, code change, and element reveal must share the same frame marker.
- Stabilize camera transforms around the composed scene. Do not animate nested copies with unrelated coordinate systems.
- Use technical labels only when they clarify the work. Prefer the real product, interaction, and motion over invented slogans.
- Reserve the final beat for a clean Autocubes end card when the soundtrack has room for it.

## Acceptance Checks

- Capture reports the configured frame count and identical nominal/average FPS.
- Source and decoded frame duplicate counts stay within the scenario limit.
- Live capture has zero `freezedetect` events.
- Every active cached media frame loads and decodes; no missing JPEG, load error, or timeout is accepted. Any unconfigured fallback decoder must still reach `readyState >= 2`.
- Proxy canvases remain inside the source video's DOM container. Root-level media overlays are invalid because they bypass ancestor masks, transforms, and stacking.
- Each connected DOM clone gets its own persistent proxy canvas. Sharing one canvas between responsive/carousel clones, or deleting canvases by horizontal viewport filtering, makes media alternate between visible and opacity-zero ancestor trees.
- Native video controls are disabled before every capture frame.
- Track cached-frame media timestamps per embedded source. Reject backwards media-time steps except an exact declared loop wrap, and reject a repeated-media ratio above the scenario limit even when page scrolling makes every screenshot globally unique.
- Consecutive-frame difference analysis reports no unexpected isolated temporal spikes. A scenario budget is allowed only for visually verified hard cuts or section boundaries; duplicate and freeze budgets stay zero.
- Contact sheets cover the heaviest sections: 3D/globe, carousel/media, phones, reviews, and final page.
- Typecheck succeeds before a full render.
