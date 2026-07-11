# Autocubes Studio

Local-first creative production workspace for Autocubes. It combines a project dashboard, browser-based motion editing, identity exploration, document production, website capture, and Remotion rendering without coupling those concerns into one application.

## Quick start

```bash
npm install
npm run dev
```

The studio opens at `http://127.0.0.1:4178/`.

## Applications

| Surface | URL | Responsibility |
| --- | --- | --- |
| Studio | `/` | Workspace navigation and project register |
| Motion Desk | `/editor.html` | Timeline, capture controls, assets, and render jobs |
| Documents | `/documents.html` | Structured client-document drafts and export |
| Identity Lab | `/apps/identity/identity-lab.html` | Standalone identity exploration and review |

## Repository map

```text
apps/                  user-facing applications
  studio/              dashboard
  motion/              motion editor
  documents/           document workspace
  identity/            standalone identity lab and its source assets
packages/              reusable product code
  core/                 project and capture domain contracts
  video/                Remotion compositions
tooling/               Node-only production infrastructure
  capture/              Playwright capture pipeline
  dev-server/           local API, project repository, and job runner
  scripts/              media generation utilities
data/                   portable, editable production data
  projects/             motion project timelines
  generated/            snapshots consumed by Remotion
  sites/                site-specific capture scenarios
examples/               approved standalone reference outputs
public/                 runtime-served fonts, audio, captures, and brand assets
out/                    generated renders and review images (ignored)
shots/                  capture working directory (ignored)
```

The dependency direction is deliberate: applications and tooling may depend on `packages/core`; the core package never imports from an application. Generated output stays outside source modules.

## Commands

```bash
npm run typecheck          # validate every TypeScript boundary
npm run build              # production build for all browser surfaces
npm run editor             # open Motion Desk
npm run remotion:studio    # inspect video compositions
npm run capture:editor     # capture the default editable project
npm run render:editor      # render the default editable project
npm run make:flowline      # capture and render the Flowline case
```

Motion projects are JSON files in `data/projects/`. Document drafts and Identity Lab overrides are local to the browser. The development API is intentionally local-only and is not part of the production build.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries and extension rules.
