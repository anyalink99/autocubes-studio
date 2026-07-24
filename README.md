# Autocubes Studio

Local-first creative production workspace for Autocubes. It combines a project dashboard, browser-based motion editing, identity exploration, document production, website capture, and Remotion rendering without coupling those concerns into one application.

The canonical private repository is `https://git.autocubes.site/stas/autocubes-studio`. Work in feature branches and merge through GitLab; `main` is protected and requires a successful pipeline. `https://github.com/anyalink99/autocubes-studio` is the synchronized GitHub mirror used for external access and backup, not an independent source of truth.

## Quick start

```bash
npm install
npm run dev
```

On Windows, double-click `start-studio.bat`. It checks Node.js, dependencies, and the Playwright browser before starting the workspace. An alternative port can be passed as the first argument: `start-studio.bat 4190`.

The studio opens at `http://127.0.0.1:4178/`.

## Agent video skills

Video work combines the upstream [Remotion Agent Skills](https://github.com/remotion-dev/skills) with the project-specific [`autocubes-video-pipeline`](./.agents/skills/autocubes-video-pipeline/SKILL.md). The upstream skills provide Remotion composition, timing, media, and render practices. The local skill adds the frame-locked browser-capture workflow and the failure modes learned from production Autocubes reels.

Install the upstream collection in a new agent environment from the repository root:

```bash
npx skills add remotion-dev/skills .
```

Keep both layers active when creating or repairing a reel. The project skill is versioned with this repository; the upstream Remotion skills are maintained at their linked source and may need to be installed again on a new workstation.

## Applications

- `/` — Operations Desk: CRM, project production, client reviews, and the component/reference library.
- `/?view=crm` — compact studio sales pipeline with next actions and lead-to-project conversion.
- `/?view=projects` — Project OS with production phases, tasks, owners, deadlines, and deliverables.
- `/?view=reviews` — internal review workspace; `/?review=<project-id>` opens the isolated client portal.
- `/?view=library` — reusable components, references, code notes, sources, and licenses.

| Surface | URL | Responsibility |
| --- | --- | --- |
| Studio | `/` | Workspace navigation and project register |
| Motion Desk | `/editor.html` | Page Map, shot building, multi-track editing, captions, overlays, audio, capture, and render jobs |
| Documents | `/documents.html` | Block-based studio documents, review notes, versions, and multi-format export |
| Identity Lab | `/apps/identity/identity-lab.html` | Brand Kit, controlled identity variations, carousel assembly, editing, and export |

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
data/                   examples and ignored runtime data
  examples/             versioned seeds for a clean clone
  projects/             ignored editable motion timelines
  generated/            ignored snapshots consumed by Remotion
  runtime/              ignored shared CRM/document state and backups
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
npm run serve:shared       # serve dist and shared-state/PDF APIs on port 4178
npm run browsers:install   # install the Chromium revision used by capture tools
npm run qa:smoke           # browser-test formats, export, guides, and local API
npm run video:check        # bundle and enumerate Remotion compositions
npm run check              # run the complete local quality gate
npm run editor             # open Motion Desk
npm run remotion:studio    # inspect video compositions
npm run capture:editor     # capture the default editable project
npm run render:editor      # render the default editable project
npm run make:flowline      # frame-locked capture, QA, render, and render QA
```

Motion projects are JSON files in ignored `data/projects/`. A clean clone seeds its first runtime project and Remotion snapshots from `data/examples/` without overwriting existing work.

Operations and Documents are offline-capable but synchronize through the same-origin `/api/sync/*` service when Studio is running. Server revisions and the latest 25 backups per channel live in ignored `data/runtime/sync/`. Use `npm run build && npm run serve:shared` for a shared instance and mount `data/runtime` as persistent storage. Put the instance behind a private network or reverse-proxy authentication; `STUDIO_SYNC_TOKEN` is available as an additional optional guard.

Audio imported from Motion Desk is stored in the ignored `public/assets/music/imported/` directory. Move approved reusable tracks into `public/assets/music/` before committing them as shared studio assets.

## Assistant API

Studio exposes a server-side OpenAI Responses API proxy at `POST /api/assistant`. Copy `.env.example` to `.env`, set `OPENAI_API_KEY` and a long random `ASSISTANT_API_TOKEN`, then restart Studio. The OpenAI key stays on the server and must never use a `VITE_` prefix.

```bash
curl http://127.0.0.1:4178/api/assistant \
  -H "Authorization: Bearer $ASSISTANT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain the project in three sentences."}'
```

The response contains `answer`, `responseId`, `model`, and token `usage`. Pass `responseId` back as `previousResponseId` to continue the same conversation:

```json
{
  "prompt": "Now make it suitable for a client presentation.",
  "previousResponseId": "resp_...",
  "maxOutputTokens": 1200
}
```

`OPENAI_MODEL` defaults to `gpt-5.6`; override it in `.env` when a different cost/latency profile is preferable. This endpoint uses the standard OpenAI API and does not run Codex or expose local Codex tasks.

## Social production workflow

Identity Lab and Motion Desk share Instagram-oriented output presets: Reel/Story `9:16`, feed portrait `4:5`, square `1:1`, and landscape `1.91:1`.

Identity Lab supports a reusable Brand Kit, controlled idea mutation, Carousel Builder with ordered swipe preview, safe-area guides, custom canvases, image/text/shape layers, drag positioning, detailed typography and layer controls, undo/redo, caption/alt-text metadata, exact PNG/JPEG export, one-click four-format bundles, and ordered carousel ZIP packs.

Motion Desk starts browser production with a Capture Director that analyzes the page without recording, finds semantic scenes and interactive targets, lets the editor build a scenario, and only then records the approved walkthrough. The analyzer now sweeps the real page to trigger IntersectionObserver and scroll-reveal effects, stores live viewport states, and combines those states with the full-page map in the storyboard. Cinematic, balanced, and snappy directing profiles calculate scroll time, scene holds, cursor travel, target settling, and safe click/hover behavior from the actual distances. The same portable kinematics engine drives preview and Remotion output, including a monotonic fade-to-black distinct from dip-to-black. The timeline supports magnetic snapping to the playhead, markers and clip edges, visible snap feedback, group moves, left/right trims, optional ripple trims, draggable playhead, pointer-anchored wheel zoom, live direction scoring, Page Map positioning, multi-selection, split/copy/paste, track controls, selector-aware cursor actions, SRT captions, bilingual text/graphics, beat-aware audio, autosave, staged capture replacement, Remotion jobs, and exact social exports.

Documents includes 16 Russian-first studio templates and structured blocks for text, checklists, tables, timelines, budgets, approvals, signatures, images, and page breaks. The employee-profile template has a dedicated branded A4 editor and direct PDF pipeline. RU and EN are independent document snapshots; a paired export bundles HTML and Markdown in both languages with the shared JSON source.

See [WORKFLOWS.md](./WORKFLOWS.md) for production recipes, [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries and extension rules, and [CHANGELOG.md](./CHANGELOG.md) for shipped capabilities.
