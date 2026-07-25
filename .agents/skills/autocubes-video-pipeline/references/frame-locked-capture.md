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

Rediscover candidates on every frame. Filter by both vertical and horizontal geometry; a carousel may contain many offscreen clones with the same vertical rectangle. For each near-visible source:

1. Use the discovered DOM video only for geometry and computed visual styles.
2. Create one retained, hidden decoder per source. Set `preload="auto"`, `muted`, `playsInline`, `autoplay=false`, and keep it paused.
3. If metadata or decoded data is unavailable, call `load()` and await `loadeddata` or `canplay`.
4. Store the source's first near-visible capture frame and set `currentTime = (frame - firstSeenFrame + 0.5) / fps`, clamped before the final source frame. Do not modulo global capture time by media duration.
5. Register `requestVideoFrameCallback`, set the media time, await both `seeked` and the matching decoded-frame callback, then pause again.
6. Draw the paused decoder into one retained root-level `<canvas>` per source.
7. Hide the original `<video>` surfaces and screenshot the canvas proxies.

`seeked` only confirms media state. It does not guarantee that Chromium has presented a non-empty compositor surface for a repeatedly-seeked `<video>`. `requestVideoFrameCallback` also does not fix this presentation race. A direct screenshot can therefore alternate between the decoded frame and a blank card even though every readiness check passes.

Never reuse an autoplaying DOM video as the capture decoder. Wall-clock playback can advance it after `seeked` but before `drawImage`; the next deterministic seek then moves backwards, making carousel footage visibly rock forward and back even though its container FPS and frame hashes are valid.

Never derive embedded-media time from the global capture frame. A source entering near the end of its duration can wrap almost immediately from its final frame to its first. Anchor each decoder to the frame where that source first enters the preload margin. For Flowline every source is longer than its visible interval, so local time stays monotonic without a loop or terminal hold.

Do not seek exactly to `frame / fps`. Encoded frame timestamps sit on interval boundaries, and Chromium can resolve a boundary to the preceding decoded frame. In Flowline's nominal 30 fps sources this produced a deterministic `unique, duplicate, unique` cadence — effectively about 20 visual updates per second despite a 30 fps container. Sampling half a frame later produced one unique decoded frame per output frame.

Retain each proxy across transient React/carousel remounts. If a source disappears from the near-visible DOM for a frame, keep its last media element reference, continue seeking and drawing it, and preserve the proxy geometry until it leaves the viewport margin. Remove the proxy only after its retained rectangle exits that margin.

Do not depend on a second screenshot or a fixed delay. A fixed delay is unrelated to whether the requested media frame was decoded or presented.

### Lower-FPS embedded sources

Midpoint sampling fixes accidental repeats in sources that already match the output FPS. It cannot invent missing frames in a genuine lower-FPS source. If a prominently visible carousel clip is below the capture FPS, list it in `FrameLockedCaptureConfig.embeddedVideoNormalizations` with its real `sourceFps`.

The capture pipeline caches a motion-compensated CFR version, serves it through a same-origin byte-range route, and uses that file only as the hidden proxy decoder. The real DOM video still owns layout and geometry. This keeps the website composition intact while removing visible 24→30 pulldown judder.

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
- per-source `requestVideoFrameCallback` media timestamps never step backwards and stay below the configured consecutive-duplicate ratio.
- downscaled consecutive-frame differences contain no isolated spikes relative to their local temporal median.

Rendered edits can contain intentional holds such as an end card. Use `--allow-static` only for that final render, never for the live browser master.

## Lessons from Flowline

- The globe and carousel still jerked after every seek completed successfully. The real failure was Chromium compositor presentation during repeated seeks.
- Carousel cards appeared and disappeared because React temporarily changed the visible clone set while Chromium invalidated the original video surfaces. Retained canvas proxies made both the DOM remount and the compositor race invisible to the capture.
- Seeking every carousel clone was slow and unnecessary; 2D viewport filtering reduced the work to relevant slides.
- The phone DOM geometry was smooth. Its apparent drag came from unstable neighboring media/compositor frames, not from the phone transform itself.
- Starting virtual time at zero hid whole in-view sections. Continuing the browser's monotonic clock fixed the layout and transitions.
- A prior source passed a naive uniqueness check because internal videos moved while the page scroll was frozen. Actual scroll verification closed that gap.
- Another prior source passed FPS, uniqueness, and freeze checks while alternating between valid and blank media surfaces. Local consecutive-frame spike detection closed that gap.
- Canvas proxies removed flashes but initially still looked choppy because exact timestamp-boundary seeks repeated every third embedded-media frame. Mid-interval sampling fixed the local cadence that whole-frame hashes could not see beneath continuous page scrolling.
- Flowline's central people clip was genuinely 24 fps. A cached motion-compensated 30 fps decoder override removed its remaining 3:2 cadence without replacing the surrounding site or carousel geometry.
- Reusing live autoplay DOM videos as decoders made their drawn frame race wall-clock playback against deterministic seeks. Dedicated paused decoders removed the forward/backward rocking that duplicate-frame QA could not detect.
- Global capture time wrapped the 15.04-second center carousel clip at capture frame 451 and the 9.33-second side clip near frame 560. Per-source local time origins removed those backwards jumps instead of classifying them as acceptable loops.
