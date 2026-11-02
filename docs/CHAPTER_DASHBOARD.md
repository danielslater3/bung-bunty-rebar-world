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

## Replay entry hotfix

The first dashboard release could stage Chapter 5/6 actors while the new world was still incomplete. The exception left the camera at the prior location and the game in cutscene mode. Staging now runs after all story actors are created. Loading is an explicit transaction with a visible overlay; gameplay updates wait until it completes. Replay entry also clears photo mode, mouse/key history, pose tilt and old camera state. A failed load returns to the menu, and an orphaned cutscene restarts its dialogue rather than trapping controls or silently completing the objective.

The browser regression now waits synchronously for the completed load, enters Chapters 1–8 through the actual dashboard, verifies camera proximity/height, sends movement keys through the input system, checks the intentional rhythm lock separately, and exercises Back to the pause menu. The save-isolation/reload regression remains in place. Earlier tests that only checked loaded state did not establish that gameplay resumed.
