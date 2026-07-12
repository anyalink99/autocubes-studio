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
4. `data/examples` contains versioned seeds. Ignored `data/projects` is the editable runtime source of truth; ignored `data/generated` contains explicit snapshots for deterministic rendering.
5. `public` contains assets required at runtime. Transient captures, build output, and renders belong in ignored directories.
6. Instagram output dimensions and safe-area contracts live in `packages/core/media-presets.ts`; applications must not redefine them independently.

## Runtime surfaces

### Operations Desk

The root application is the studio operating layer. It owns four connected local-first domains:

- CRM leads move through a small explicit pipeline and always carry a next action. A won lead can create a project without re-entering client context.
- Project OS uses the shared brief-to-support phase model. Tasks, owners, deadlines, deliverables, health, and activity remain attached to the project.
- Reviews are versioned project deliverables. Internal comments can be pinned to preview coordinates; the isolated `?review=<project-id>` surface exposes only client-safe review data and approval actions.
- The library stores references and reusable solutions with source, technology, tags, license, code notes, and project links.

Operations data is cached under `autocubes-operations-v1`, can be imported or exported as portable JSON, and synchronizes through the `operations` server channel. The review workspace deliberately uses a fixed three-panel geometry so tall source images scroll or scale inside the canvas instead of expanding the application document. Shared contracts live in `packages/core/operations.ts`; browser state and presentation live in `apps/operations`.

### Studio

The legacy launch dashboard remains in `apps/studio` for reference while Operations Desk is the root launch surface. Motion, Identity, and Documents remain independent production applications linked from its tool rail.

### Motion Desk

The editor modifies `data/projects/*.editor.json` through the local API. Capture jobs use Playwright; render jobs synchronize the selected project into `data/generated/editor-project.json` before invoking Remotion.

Motion schema version 3 migrates through `packages/core/editor-operations.ts`. Portable operations own clamping, time formatting, page-position parsing, frame arrangement, recipes, and snapping. Capture Director uses a lightweight Playwright analysis endpoint to discover sections and targets before a recording job is authorized. Recording writes to a staging directory and atomically replaces the last successful capture. Page Map, Shot Library, Timeline, Caption Library, Preview, and Inspector consume those contracts without importing Node infrastructure.

### Documents

Documents are structured React state cached under `autocubes-documents-v2` and synchronized through the `documents` server channel. Legacy sections migrate into typed blocks. Each document contains independent `ru` and `en` content snapshots; Russian is the authoring default and bilingual ZIP is the normal handoff boundary. HTML is standalone and print-ready; Markdown and JSON remain portable interchange formats. Employee profiles use a dedicated A4 data model and the `/api/documents/pdf` browser-print pipeline.

### Identity Lab

Identity Lab remains standalone HTML by design: it can be opened or shared without bootstrapping a React application. Per-variant overrides are stored under `autocubes-identity-v3-edits`.

Brand Kit is stored under `autocubes-identity-brand-kit-v1` and applied before per-composition overrides. Identity output language is stored separately; post metadata and Brand Kit copy preserve RU/EN variants. Picked composition order is both Carousel Builder order and PNG-pack export order.

Identity export runs in the browser. `html-to-image` rasterizes the active artboard at the selected output resolution; JSZip packages picked compositions without sending artwork to a remote service.

## Quality gates

`npm run qa:smoke` verifies core export and API paths. `npm run qa:identity` stresses variant paging, zoom, and responsive geometry. `npm run qa:workflows` covers Motion Page Map and Timeline, Identity Brand Kit and Carousel Builder, Documents blocks and export, and Studio Project Hub. `npm run check` runs all suites plus TypeScript, production build, and Remotion composition discovery.

## Persistence and collaboration

Operations and Documents use `apps/shared/useServerSync.ts`: localStorage remains the immediate offline cache, while same-origin sync uses optimistic revisions. A stale writer receives `409`, its local payload is preserved under a timestamped conflict key, and the current server revision is applied. The Node-only store in `tooling/dev-server/sync-store.ts` serializes writes per channel and retains 25 server backups.

The Vite plugin exposes the same API in development and `vite preview`, so `npm run serve:shared` serves the built application, shared state, and PDF generation together. Runtime state is never committed. Motion project JSON remains a portable file boundary; Identity remains browser-local until its collaboration model needs more than exported Brand Kits and manifests.
