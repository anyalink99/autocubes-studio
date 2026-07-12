# Studio workflows

## Build an Instagram post or carousel

1. Open Identity Lab, choose the target format, and set the output language to EN or RU.
2. Open Brand Kit and set the shared name, lockup, contact information, social copy, and optional global colours.
3. Switch variants or use Mutate for a controlled alternative inside the same idea.
4. Open a composition and edit type, spacing, colour, visibility, position, and added layers.
5. Add the post caption, alt text, and hashtags in the same composition record.
6. Pick the strongest compositions and open Carousel Builder to reorder, remove, and preview the sequence.
7. Export one PNG/JPEG, all four Instagram sizes, or the ordered carousel PNG ZIP pack.

Useful keys inside the editor: arrow keys nudge a layer, `Shift` increases the nudge distance, `Delete` removes a layer, `Cmd/Ctrl+Z` undoes, `Cmd/Ctrl+E` exports PNG, `G` toggles guides, and `F` picks the composition.

## Build a Reel or Story

1. Create or duplicate a Motion Desk project and select `9:16 Reel / Story`.
2. Open Capture Director, enter the browser URL, and run the fast analysis. This creates the page atlas without waiting for video capture.
3. Select semantic page sections and only the cursor targets that support the product story, then build the scenario without recording.
4. Refine scenes on Page Map and the timeline. Page Position accepts pixels, percentages, `top`, `center`, and `bottom`.
5. Reopen **Проверить захват**. The review screen uses the current timeline scenes, not the original analysis: select a scene and drag or scroll the full-page copy inside the exact recording viewport.
6. Choose **Записать показанное** only after every viewport reads correctly; a failed recording cannot destroy the last successful capture.
7. Add or adjust cursor actions, transitions, captions/SRT, overlays, music, voice, and SFX at the playhead.
8. Check the storyboard preview, pointer path, safe areas, clip overlaps, missing frames, audio fades, and out-of-range events.
9. Save the project, choose Export MP4, and keep Motion Desk open while the local job runs.

Press `?` for the shortcut map. The main keys are `Space` for playback, `L` for loop, `C` for a caption, `S` to split, arrows for frame stepping, `Cmd/Ctrl+C` and `Cmd/Ctrl+V` for clips, and `Cmd/Ctrl+D` for duplication.

## Create and approve a studio document

1. Choose one of the 15 templates or open a document linked to a Studio project.
2. Insert blocks with Add block or `/`; reorder, duplicate, and convert them from the Inspector.
3. Use checklists, tables, timelines, budgets, approvals, signatures, and images as structured production data.
4. Add review notes to the document or selected block, resolve them, and create version snapshots at approval points.
5. Author the Russian version first, switch to EN for the paired edition, and export the RU + EN package. Single-language Markdown, JSON, and Print/PDF remain available.

## Create format variants safely

Use project duplication before changing aspect ratio or timing. Project JSON import/export is the portable backup boundary; generated video and browser captures are reproducible artifacts. Approved reusable audio belongs in `public/assets/music/`, while temporary imports remain ignored in `public/assets/music/imported/`.
