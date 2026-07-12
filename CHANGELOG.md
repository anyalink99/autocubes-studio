# Changelog

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
