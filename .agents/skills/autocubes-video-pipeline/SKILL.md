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
6. On every frame, rediscover near-visible `<video>` nodes in both axes. Use the DOM video only for layout: never seek an autoplaying site element. Give each source a retained, paused decoder and a local time origin at its first near-visible frame; do not derive looping media time from the global capture frame. Normalize lower-FPS sources when their 3:2 cadence remains visible, sample at the center of each local frame interval, and draw the paused decoder into a retained root-level canvas proxy that survives transient carousel remounts.
7. Encode the sequence to H.264 CFR with `yuv420p`; run cadence and temporal-discontinuity QA before the clip enters Remotion.
8. Keep Remotion timing frame-driven. Avoid `playbackRate` or arbitrary source offsets used to conceal capture defects.
9. Render the final MP4 and run cadence QA again. Static end cards may opt into `--allow-static`; live browser captures may not.

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
- Every visible embedded video reaches `readyState >= 2`; no load or seek timeout is accepted.
- Track `requestVideoFrameCallback` media timestamps per embedded source. Reject backwards media-time steps and a repeated-media ratio above the scenario limit even when page scrolling makes every screenshot globally unique.
- Consecutive-frame difference analysis reports no isolated temporal spikes. Frame uniqueness alone does not detect alternating empty compositor surfaces.
- Contact sheets cover the heaviest sections: 3D/globe, carousel/media, phones, reviews, and final page.
- Typecheck succeeds before a full render.
