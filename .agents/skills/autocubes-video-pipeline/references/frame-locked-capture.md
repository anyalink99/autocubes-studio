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

Initial preloading is insufficient. Carousels and Framer components may keep several responsive clones alive, remount nodes, and move an offscreen clone into view.

For every configured featured source:

1. Probe its real FPS.
2. If it is below the capture FPS, cache a motion-compensated CFR normalization.
3. Transcode the capture source to a seek-safe all-intra intermediate.
4. Extract that CFR source into a reusable `frame-%06d.jpg` cache with a completion manifest.
5. Serve requested JPEGs through a same-origin Playwright route.

For every captured page frame:

1. Rediscover all connected page `<video>` elements, not only horizontally visible slides.
2. Use each DOM video only for layout and computed visual styles.
3. Disable native controls and hide the original surface without removing it from layout.
4. Create one persistent `<canvas>` beside every DOM instance. Never move one canvas between clones that share a URL.
5. Keep horizontal and responsive clones alive. Skip JPEG loading only when every clone for that source is vertically outside the preload margin.
6. Load the exact cached frame, draw it into every connected instance canvas, and let each clone's ancestor chain apply transforms, opacity, `overflow`/clip masks, border radii, and stacking.

`seeked` only confirms media state. It does not guarantee that Chromium has presented a non-empty compositor surface for a repeatedly-seeked `<video>`. `requestVideoFrameCallback` also does not fix this race. Featured presentation media must therefore use the external frame cache instead of a browser video surface.

Do not place media proxies in a root-level fixed overlay. `getBoundingClientRect()` gives only the final axis-aligned box; it does not preserve ancestor `overflow: clip`, transforms, masks, opacity, border radii, or stacking. A root overlay can cover neighboring feature cards with the unclipped bottom of a video or draw carousel media over controls and masks. Keep each canvas in its video's immediate container.

Do not key canvases only by source URL. Framer can keep several clones of the same video alive for carousel slides and responsive variants; some sit under visible ancestor trees and others under `opacity: 0`. Moving one canvas between those clones makes the media appear and disappear. Share cached source frames, not the canvas.

Do not delete a clone canvas merely because that clone is horizontally outside the viewport. Framer may move it into the visible slot between capture frames. Horizontal filtering created the exact full-carousel/one-card alternation seen in Flowline.

Autoplay phase is another source of nondeterminism. For media carousels, read the list transform once, infer the slide stride from video rectangles, snap horizontal translation to the nearest complete slide, retain that first result, and reassert the exact same transform with `!important` on every frame. Recomputing the nearest slide from the live transform allows a mid-transition phase to cross the rounding boundary and produces a full/one-card/full oscillation. Framer can still toggle clone ancestors independently of that transform, so every clone inside the list must also be forced to `visibility: visible` and `opacity: 1`. Distant clones remain spatially outside the outer carousel clip. Do not change their scale, mask, border radius, or clipping.

Use the global deterministic frame for sources that start with the page. If a DOM video is declared `loop`, modulo by the extracted frame count. Cadence QA may accept only an exact transition from the final interval to the first; any backwards step inside the duration remains an error.

Do not depend on a second screenshot or a fixed delay. A fixed delay is unrelated to whether a browser decoder has presented a frame and is unnecessary for cached images.

### Lower-FPS embedded sources

Frame caching cannot invent missing frames in a genuine lower-FPS source. If a prominently visible clip is below the capture FPS, list it in `FrameLockedCaptureConfig.embeddedVideoNormalizations` with its real `sourceFps`. The pipeline caches motion-compensated CFR normalization before extracting JPEGs. The real DOM video still owns layout and geometry.

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
- cached per-source media timestamps never step backwards except an exact declared loop wrap and stay below the configured consecutive-duplicate ratio.
- downscaled consecutive-frame differences remain under the scenario's reviewed spike budget. Use `maxTemporalSpikeEvents` only for verified hard cuts or section boundaries; keep duplicate and freeze limits at zero.

Rendered edits can contain intentional holds such as an end card. Use `--allow-static` only for that final render, never for the live browser master.

## Lessons from Flowline

- The globe and carousel still jerked after every seek completed successfully. The real failure was Chromium compositor presentation during repeated seeks. External JPEG extraction removed the browser decoder from the final path.
- Carousel cards appeared and disappeared even with valid cached frames because horizontal viewport filtering deleted clone canvases immediately before Framer moved those clones into view. Persistent canvases for every connected clone removed the handoff race.
- Different clean runs still produced different carousel states because the virtual clock inherited a different native-time phase. Capturing one snapped transform per carousel, reasserting it without resnapping, and normalizing visibility/opacity for all clones made capture reproducible.
- Recomputing the nearest snapped slide on every frame was itself unstable: the hidden autoplay transform crossed a rounding boundary and made the people carousel jump full/one-card/full. The first snapped transform must remain immutable for the whole capture.
- Keeping canvases for every clone is cheap; JPEG loading is skipped only when the entire source is vertically away from the viewport.
- The phone DOM geometry was smooth. Its apparent drag came from unstable neighboring media/compositor frames, not from the phone transform itself.
- Starting virtual time at zero hid whole in-view sections. Continuing the browser's monotonic clock fixed the layout and transitions.
- A prior source passed a naive uniqueness check because internal videos moved while the page scroll was frozen. Actual scroll verification closed that gap.
- Another prior source passed FPS, uniqueness, and freeze checks while alternating between valid and blank media surfaces. Local consecutive-frame spike detection closed that gap.
- Flowline's central people clip was genuinely 24 fps. Cached motion-compensated 30 fps normalization removed its 3:2 cadence without replacing the surrounding site or carousel geometry.
- Reusing live autoplay DOM videos or hidden paused decoders still exposed Chromium seek/compositor races. Cached JPEGs made the selected media frame deterministic.
- A loop is not a backwards error when the timestamp moves exactly from the final cached interval to the first. QA now distinguishes that transition from genuine rocking inside a source.
- A root-level globe proxy ignored its ancestor's 415 px `overflow: clip` and painted the full 952 px video over the feature cards below. The same overlay bypassed the people carousel's scale, rounded clipping, and stacking. DOM-local proxies plus explicit `controls=false` restored the site's actual composition.
- The people carousel first flashed when one DOM-local canvas was keyed only by URL and moved between Framer clones under alternating visible and `opacity: 0` ancestor trees. Per-instance canvases fixed that ownership error; keeping all horizontal clones persistent fixed the remaining handoff error.
