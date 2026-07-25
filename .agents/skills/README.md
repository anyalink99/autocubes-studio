# Project-local agent skills

This directory is the self-contained skill set for Autocubes Studio. It is committed to the repository so a fresh checkout can use the complete video workflow without relying on skills installed in a specific user's home directory.

## Autocubes skill

- `autocubes-video-pipeline`

## Vendored Remotion Agent Skills

Source: <https://github.com/remotion-dev/skills>

Vendored revision: `5e2daf82fd2d4468500ced14f6c5a0c8a54f9470`

Vendored on: 2026-07-25

- `mediabunny`
- `remotion-best-practices`
- `remotion-captions`
- `remotion-create`
- `remotion-docs`
- `remotion-interactivity`
- `remotion-maps`
- `remotion-markup`
- `remotion-render`
- `remotion-saas`
- `remotion-upgrade`

Keep the vendored directories together when updating them because several skills link to files in sibling directories. Replace the complete collection from one upstream revision rather than mixing files from different revisions.
