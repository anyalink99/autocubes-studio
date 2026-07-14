# Changelog

## 0.6.0 — Natural motion output

- Added one shared motion-kinematics engine for editor preview, Playwright capture, and Remotion output so cursor timing no longer changes between surfaces.
- Replaced straight cursor interpolation with deterministic human arcs, distance-aware duration, target settling, readable click feedback, optional trail, and per-action trajectory controls.
- Reworked browser scrolling with distance-aware scene timing, quintic acceleration and braking, and subtle deterministic velocity variation.
- Added cinematic, balanced, and snappy directing profiles plus one-click rhythm polishing for existing projects.
- Replaced storyboard crossfades with animated full-page capture simulation before recording.
- Added ripple timing edits, scene scroll/hold controls in Capture Director, timeline rhythm bands, and a live direction-quality score.
- Made discovered links hover by default while buttons and controls click, preventing accidental navigation during a showcase recording.
- Added motion-kinematics QA and exercised Capture Director in the production browser workflow.

## 0.5.2 — Employee document pipeline

- Added the Autocubes employee profile as a first-class Documents template with editable team, contact, stack, language, photo, and experience fields.
- Added a branded one-page A4 renderer with the Autocubes mark, deterministic geometry, selectable text, and a direct PDF download action.
- Added the local `/api/documents/pdf` pipeline using the Studio browser fallback, so document export no longer depends on the system print dialog.
- Added Anton Tarakanov's employee-profile baseline with Autocubes tenure from December 2025 and prior agentapp experience ending in December 2025.
- Added offline-first server synchronization for Operations and Documents with optimistic revisions, conflict backups, and retained server snapshots.
- Added shared production serving through Vite preview, optional sync-token protection, Docker packaging, and GitLab CI verification.
- Separated versioned examples from ignored projects, generated snapshots, captures, editor frames, exports, and shared runtime state.

## 0.5.1 — Operations workspace refinement

### CRM and Project OS

- Replaced the fragile seven-column default CRM with a dense list and persistent inspector while retaining a touch-safe optional board.
- Added stage, deadline and search filters, reliable lead-to-project conversion, notes, deletion, deep links, and mobile full-screen contact editing.
- Made project progress phase-aware, added guarded stage transitions with an activity trail, and made project settings functional.

### Reviews and library

- Rebuilt internal reviews as a fixed three-panel desk with a material queue, fit/zoom controls, coordinate comments, version actions, and a pinned discussion composer.
- Replaced the tall client handoff page with an immediate viewport-fitted review app for materials, decisions, comments, and approvals.
- Added editable library context, favorite filtering, deletion, and explicit links between reusable solutions and projects.

### Workspace quality

- Turned the command palette into real cross-workspace search with deep links.
- Added validated JSON import beside export, browser history support, local persistence safeguards, visible keyboard focus, and expanded end-to-end Operations QA.

## 0.5.0 — Capture director and Russian studio

### Motion Desk

- Replaced the opaque capture action with a four-step Capture Director: source, fast page analysis, semantic scene plan, and final recording.
- Added full-page analysis images, discovered sections, real interactive targets, selector-aware cursor actions, click effects, and scene generation before recording.
- Reframed the timeline around scenes, cursor actions, text, graphics, scene changes, and sound; added richer scene clips and a substantially larger preview mode.
- Made recording transactional: the last successful capture stays available until the staged replacement is fully complete.
- Added English/Russian output fields for captions and graphics while keeping English as the Motion default.

### Identity Lab and Documents

- Localized the complete studio interface into Russian without changing the established visual language.
- Added English/Russian Identity output switching, bilingual Brand Kit fields, per-language post copy, translated artboards, and language-aware export manifests.
- Made Identity layer controls initialize from real composition geometry and isolated raster export from browser zoom, monitor resolution, and Studio preview scale.
- Made Documents Russian-first with independent RU/EN snapshots and one bilingual ZIP containing HTML and Markdown in both languages plus shared JSON.

### Quality

- Added browser coverage for page analysis, Identity language switching, and bilingual document packages.
- Updated compact desktop behavior so the complete Motion toolbar remains usable at 1100 px.

## 0.4.0 — Studio production system

### Motion Desk

- Added Page Map, semantic Page Position entry, direct preview scrub, shot recipes, pacing, and richer shot cards.
- Upgraded Timeline with multi-selection, markers, split/copy/paste, zoom controls, frame-aware snapping, and track visibility, lock, and collapse controls.
- Added overlays, pointer paths, fullscreen preview, SRT caption workflows, caption motion controls, audio fades, beat guides, categories, looping, and music ducking.
- Added schema-v3 migration and shared editor operations so old project JSON remains usable.

### Identity Lab

- Added shared Brand Kit, controlled Mutate actions, and Carousel Builder with ordered preview and export.
- Preserved per-composition overrides above shared Brand Kit values.

### Documents and Studio

- Rebuilt Documents around typed blocks, 15 studio templates, outline navigation, undo/redo, review notes, version snapshots, and HTML/Markdown/JSON/PDF workflows.
- Added the Studio production flow and Project Hub linking Identity, Motion, and Documents.

### Quality

- Added safe end-to-end workflow coverage and removed a destructive project-deletion assumption from the smoke suite.

## 0.3.0 — Social production

### Identity Lab

- Instagram presets for `4:5`, `1:1`, `9:16`, and `1.91:1`, plus custom canvases.
- Safe-area and composition guides with ratio-correct layer geometry.
- PNG, JPEG, four-format ZIP, and ordered carousel-pack exports.
- Image layers, layer duplication, undo/redo, expanded typography controls, and persistent post copy/alt text/hashtags.

### Motion Desk

- Shared Instagram format presets, safe zones, exact storyboard-cover export, and render preflight.
- Caption track rendered in both preview and Remotion output.
- Magnetic snapping, clip resizing, edge auto-scroll, playback loop, autosave, and expanded keyboard editing.
- Audio upload, preview, search, timeline insertion, and imported-asset cleanup.
- JSON project import/export, project duplication, clearer job feedback, and direct MP4 download.

### Platform

- Browser smoke tests for export dimensions, format bundles, undo/redo, captions, asset lifecycle, mobile Identity layout, and API health.
- GitHub Actions quality gate for typecheck, build, Chromium workflow tests, and dependency audit.
- Vite and Playwright security updates; `npm audit` reports zero known vulnerabilities.
