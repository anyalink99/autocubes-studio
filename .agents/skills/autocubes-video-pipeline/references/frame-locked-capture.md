# Frame-locked browser capture

This reference supplements the upstream [Remotion Agent Skills](https://github.com/remotion-dev/skills). Use the upstream skills for Remotion composition and render practices, and this document for Autocubes-specific browser capture and cadence QA.

## Why the old pipeline stuttered

Playwright `recordVideo` records the browser compositor in real time. A nominal WebM rate does not guarantee that the page produced a new visual frame at that cadence. Expensive sections, lazy content, media decoding, and background scheduling can repeat a compositor frame for long stretches even when the container later reports a normal FPS.

The stable pipeline captures one screenshot for every intended output frame and encodes that sequence as CFR. Container FPS, page animation time, scroll position, embedded media time, and Remotion time therefore share the same frame index.

## Clock bridge

Never restart the virtual clock at zero after the page has already received real animation timestamps. Framer Motion and similar systems can compare the new timestamp with a previous native timestamp and leave in-view elements hidden or in an invalid transition state.

At enable time:

1. Read native `performance.now()`.
2. Start virtual time from that value.
3. Preserve a matching `Date.now()` epoch.
4. Queue new `requestAnimationFrame` callbacks.
5. Run two callback batches per output frame, each at half the frame duration.

This maintains monotonic time while still making every output frame deterministic.

## Scroll and lazy layout

Prewarm the page from top to bottom before enabling the virtual clock. This primes lazy sections and network assets.

For every captured frame:

1. Interpolate the requested y from scroll keyframes.
2. Apply `scrollTo`.
3. Step the animation clock.
4. Reapply `scrollTo` in case a smooth-scroll callback changed it.
5. Force layout.
6. Compare actual y with the requested y clamped to the current maximum.

Do not accept a capture where the viewport silently remains at an old position. A moving inner video can make all encoded frame hashes unique while the page itself is frozen, so scroll verification is mandatory.

## Embedded video

Initial preloading is insufficient. Carousels and Framer components may remount fresh `<video>` elements when a section enters view.

Rediscover candidates on every frame. Filter by both vertical and horizontal geometry; a carousel may contain many offscreen clones with the same vertical rectangle. For each near-visible candidate:

1. Set `preload="auto"`, `muted`, and `playsInline`.
2. If metadata or decoded data is unavailable, call `load()` and await `loadeddata` or `canplay`.
3. Set `currentTime = frame / fps modulo duration`.
4. Await `seeked`.
5. Only then screenshot.

Do not depend on a second screenshot or a fixed delay. A fixed delay is unrelated to whether the requested media frame was decoded.

## Encoding and QA

Encode with an explicit input framerate:

```text
ffmpeg -framerate 30 -i frame-%06d.jpg -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart capture.mp4
```

Verify:

- `r_frame_rate` and `avg_frame_rate` equal the requested FPS.
- `nb_frames` equals the requested frame count.
- screenshot hashes and decoded `framemd5` hashes satisfy the duplicate limit.
- `freezedetect=n=0.002:d=0.1` reports no live-capture freezes.

Rendered edits can contain intentional holds such as an end card. Use `--allow-static` only for that final render, never for the live browser master.

## Lessons from Flowline

- The globe jerked because media seek completion was not awaited.
- Carousel cards appeared and disappeared because newly mounted video clones had `readyState` 0 or 1.
- Seeking every carousel clone was slow and unnecessary; 2D viewport filtering reduced the work to relevant slides.
- The phone DOM geometry was smooth. Its apparent drag came from unstable neighboring media/compositor frames, not from the phone transform itself.
- Starting virtual time at zero hid whole in-view sections. Continuing the browser's monotonic clock fixed the layout and transitions.
- A prior source passed a naive uniqueness check because internal videos moved while the page scroll was frozen. Actual scroll verification closed that gap.
