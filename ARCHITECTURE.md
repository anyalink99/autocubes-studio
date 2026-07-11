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

## Runtime surfaces

### Studio

The root React application is the launch surface. It reads motion project summaries from the local API and the document index from browser storage.

### Motion Desk

The editor modifies `data/projects/*.editor.json` through the local API. Capture jobs use Playwright; render jobs synchronize the selected project into `data/generated/editor-project.json` before invoking Remotion.

### Documents

Documents are structured React state stored under `autocubes-documents-v1`. Exported HTML is standalone and print-ready. Templates remain application-owned until another surface needs the same document domain.

### Identity Lab

Identity Lab remains standalone HTML by design: it can be opened or shared without bootstrapping a React application. Per-variant overrides are stored under `autocubes-identity-v3-edits`.

## Persistence direction

The system is local-first. If collaboration is introduced, add a project service behind repository interfaces rather than placing network calls in UI components. Browser-local Documents and Identity state can then migrate independently while JSON project files remain a portable interchange format.
