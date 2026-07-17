# SENM Agent Context

This file is the handoff for contributors who open the repository with Codex or another coding agent.

## Product

SENM is a macOS and Windows desktop utility for translating short-drama ideas or scripts into executable Seedance 2.0 video prompts. The primary experience is the tray/menu-bar quick window; the full workbench supports detailed controls and reference media.

## Non-Negotiable Behavior

- Product name shown to users is `SENM`.
- A generation task covers at most 15 seconds. Warn when the selected duration is implausible, but do not silently delete story content.
- Completeness and accurate dramatic understanding take priority over a soft 500-Chinese-character recommendation.
- Prompt output must contain executable subject, relationship, scene, blocking, performance, shot timing, sound, and continuity information. Avoid administrative filler.
- Treat an unspecified romantic couple as one adult man and one adult woman unless the user explicitly defines otherwise.
- Companions and bystanders should not know hidden relationships unless the script says they do. Preserve subtext instead of making every character explain the conflict.
- Platform compliance is reminder-only. Show the relevant risk and mitigation suggestion, then allow the user to continue generation.
- Changing aspect ratio must patch only ratio/composition wording in an existing result. Changing duration may retime shots, but should preserve story beats whenever feasible.
- Model failures must expose retry. Local fallback is a visible option/state, never the only forced path.
- Default audio keeps dialogue, breathing, ambience, and necessary effects; it does not request background music.
- Reference media must support preview, drag/drop, folder scan, and stable `@图片N` / `@视频N` / `@音频N` markers.

## Architecture

- `electron/main.cjs`: windows, tray, global shortcut, IPC, settings, credentials, model requests, and media file access.
- `electron/preload.cjs`: isolated renderer bridge exposed as `window.see2p`.
- `src/renderer/App.tsx`: full workbench.
- `src/renderer/QuickPanel.tsx`: tray/menu-bar quick window.
- `src/shared/promptAgent.ts`: model prompt and structured response contract.
- `src/shared/shortDramaDirectorAgent.ts`: dramatic interpretation and shot strategy.
- `src/shared/shortDramaKnowledgeBase.ts`: local RAG examples and genre knowledge.
- `src/shared/seedanceTranslator.ts`: deterministic local translation and output formatting.
- `src/shared/jimengCompliance.ts`: platform-risk detection and reminder copy.

Internal names such as `window.see2p`, `com.see2p.transfer`, and the `see2p-transfer` user-data folder are compatibility identifiers. Do not rename them without a migration plan, or existing settings and encrypted API keys will be lost.

## Privacy And Secrets

- Never commit API keys, local `settings.json`, credential blobs, signing certificates, user media, or release artifacts.
- The API key must remain in the credential store and must never be sent to the renderer, logs, exported prompts, or crash messages.
- A third-party model endpoint receives user script content. UI changes must not imply that model processing is local.

## Validation

Run before submitting a change:

```bash
npm test
npm run test:credentials
npm run build
```

For release or platform work, also run the relevant `npm run dist:mac` or `npm run dist:win`. Check both the full workbench and the 430x620 quick window for clipping and overlapping controls.
