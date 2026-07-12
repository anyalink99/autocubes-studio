# Architecture

## Product boundary

Autocubes Studio is an internal production system, not the public Autocubes site. External websites are capture inputs. The repository owns creative project data, capture automation, editing surfaces, and render compositions.

## Dependency model

```text
apps/* ───────────────┐
                     ├──> packages/core
tooling/* ────────────┘

packages/video ─────────> packages/core + data/generated + public assets
tooling/capture ─────────> data/sites + data/projects
tooling/dev-server ──────> data/projects + public assets + packages/video jobs
```

Rules:

1. `packages/core` contains portable types and shared domain utilities. It must not import browser UI, Playwright, Vite, or Remotion.
2. `apps` contain presentation and interaction. They do not own shared persistence or production pipelines.
3. `tooling` is Node-only infrastructure. Browser code must not import it.
4. `data/projects` is the editable source of truth. `data/generated` contains explicit snapshots for deterministic rendering.
5. `public` contains assets required at runtime. Transient captures, build output, and renders belong in ignored directories.
6. Instagram output dimensions and safe-area contracts live in `packages/core/media-presets.ts`; applications must not redefine them independently.

## Runtime surfaces

### Studio

The root React application is the launch surface. It reads motion project summaries from the local API and the document index from browser storage.

### Motion Desk

The editor modifies `data/projects/*.editor.json` through the local API. Capture jobs use Playwright; render jobs synchronize the selected project into `data/generated/editor-project.json` before invoking Remotion.

Motion schema version 3 migrates through `packages/core/editor-operations.ts`. Portable operations own clamping, time formatting, page-position parsing, frame arrangement, recipes, and snapping. Capture Director uses a lightweight Playwright analysis endpoint to discover sections and targets before a recording job is authorized. Recording writes to a staging directory and atomically replaces the last successful capture. Page Map, Shot Library, Timeline, Caption Library, Preview, and Inspector consume those contracts without importing Node infrastructure.

### Documents

Documents are structured React state stored under `autocubes-documents-v2`. Legacy sections migrate into typed blocks. Each document contains independent `ru` and `en` content snapshots; Russian is the authoring default and bilingual ZIP is the normal handoff boundary. HTML is standalone and print-ready; Markdown and JSON remain portable interchange formats.

### Identity Lab

Identity Lab remains standalone HTML by design: it can be opened or shared without bootstrapping a React application. Per-variant overrides are stored under `autocubes-identity-v3-edits`.

Brand Kit is stored under `autocubes-identity-brand-kit-v1` and applied before per-composition overrides. Identity output language is stored separately; post metadata and Brand Kit copy preserve RU/EN variants. Picked composition order is both Carousel Builder order and PNG-pack export order.

Identity export runs in the browser. `html-to-image` rasterizes the active artboard at the selected output resolution; JSZip packages picked compositions without sending artwork to a remote service.

## Quality gates

`npm run qa:smoke` verifies core export and API paths. `npm run qa:identity` stresses variant paging, zoom, and responsive geometry. `npm run qa:workflows` covers Motion Page Map and Timeline, Identity Brand Kit and Carousel Builder, Documents blocks and export, and Studio Project Hub. `npm run check` runs all suites plus TypeScript, production build, and Remotion composition discovery.

## Persistence direction

The system is local-first. If collaboration is introduced, add a project service behind repository interfaces rather than placing network calls in UI components. Browser-local Documents and Identity state can then migrate independently while JSON project files remain a portable interchange format.
