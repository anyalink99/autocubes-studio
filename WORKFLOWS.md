# Studio workflows

## Build an Instagram post or carousel

1. Open Identity Lab and choose the target format from the sticky format bar.
2. Turn on safe zones while composing. Open an idea and edit its layers directly on the canvas.
3. Add post copy, alt text, and hashtags in the same composition record.
4. Export one PNG/JPEG, export the composition in all four Instagram formats, or pick multiple cards in publishing order and create a carousel PNG pack.
5. Keep the generated `manifest.json` beside the artwork; it contains format, order, composition identity, and post metadata.

Useful keys inside the editor: arrow keys nudge a layer, `Shift` increases the nudge distance, `Delete` removes a layer, `Cmd/Ctrl+Z` undoes, `Cmd/Ctrl+E` exports PNG, `G` toggles guides, and `F` picks the composition.

## Build a Reel or Story

1. Create or duplicate a Motion Desk project and select `9:16 Reel / Story`.
2. Capture the website, or capture individual scroll positions while refining the storyboard.
3. Arrange frames automatically, then drag and resize clips. Magnetic snapping targets tenths of a second, the playhead, and nearby clip edges.
4. Add pointer actions, transitions, captions, and audio. Imported audio is inserted at the current playhead.
5. Resolve preflight warnings, export a cover PNG from Storyboard mode, and start the MP4 render.
6. Keep Motion Desk open while the local job runs. Download the result from the completed job drawer.

Press `?` in Motion Desk for the complete shortcut map. The most useful keys are `Space` for playback, `L` for loop, `C` for a caption, arrow keys for frame stepping, and `Cmd/Ctrl+D` for clip duplication.

## Create format variants safely

Use project duplication before changing aspect ratio or timing. Project JSON import/export is the portable backup boundary; generated video and browser captures are reproducible artifacts. Approved reusable audio belongs in `public/assets/music/`, while temporary imports remain ignored in `public/assets/music/imported/`.
