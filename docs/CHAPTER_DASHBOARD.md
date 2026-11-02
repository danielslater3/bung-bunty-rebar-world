# Chapter dashboard

Open **Chapter Dashboard** from the main menu or pause menu. The six acts show all 24 chapters, completed/current/locked status, campaign completion, chapter descriptions and objective counts. Filter the library to unlocked or completed chapters. Layout adapts to small screens and supports keyboard focus.

**Replay from Beginning** opens an isolated replay slot. It restores the selected chapter's story prerequisites instead of carrying a late-game mansion, companion or Big Boy state into the opening. Replay rewards, purchases, checkpoints and unlocks never replace the main campaign. **Return to Campaign** restores the original checkpoint. **Resume Chapter Replay** on the main menu resumes the isolated slot after a reload. A completed replay stays on its completion screen instead of advancing the campaign.

The existing `bung-bunty-rebar-world-save-v1` key remains the campaign save. The optional replay key appends `-replay`. Starting a New Saga clears both, consistent with the existing New Saga reset behavior. Replays require unlocked chapters and enough browser storage to save safely. An unsuccessful storage write leaves the current state untouched.

Validation: 28 native Node tests; an isolated Chrome dashboard flow checks a fresh profile, locked chapters, filters, responsive width, replay launch, unchanged campaign bytes, resume after reload, exact campaign chapter/step/coins restoration, and replay completion. The opening loaded-scene regression also checks navigation, garage handling, deliveries, chapters 1–4 progression and dialogue cameras. A desktop screenshot was visually inspected. This is automated and selected visual verification, not a guarantee against every possible browser failure.

```sh
node --experimental-loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
# With an external Playwright installation and local server:
NODE_PATH=/path/to/test-dependencies/node_modules node tools/tests/dashboard.cjs
```

This release adds the requested dashboard first. The Chapter 7–8 gameplay overhaul is a separate pending release; no chapter data was changed here.
