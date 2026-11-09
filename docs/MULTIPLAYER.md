# Brisbane multiplayer

Open the game and choose **MULTIPLAYER · BRISBANE**. Choose a character, set four outfit colours and a display name, then create a room or enter a friend's eight-character code. The invite button copies a room link. This is guest multiplayer: names are display names, not verified accounts. There is no purchase, subscription or paid unlock in the game.

The join screen has a real rotatable 3D preview. All 19 identities are available immediately: Bung, Chung, Gabor, Seb, Sir Girderface, Rebar Man, both sets of parents, the collector's guard, the Court, James Rebar and all six enemy types. Nonhuman characters use shell/panel/trim colours. Their movement and collision abilities are identical; cosmetic size does not grant extra reach. Story models and single-player clothing remain independent. Character and outfit preferences are stored on this browser; each room stores and broadcasts the validated selection. Reconnecting keeps the player's room identity, score and role. Returning through the join screen permits a fresh appearance and display name.

## Controls

- Normal movement and camera controls apply throughout the existing Brisbane map.
- **B** opens the room board, games, leaderboard and four-player quest.
- **Enter** opens chat. In the message field, **Enter** (including numpad Enter) sends once and keeps chat open for the next message. **Escape** closes the current panel or opens the board.
- **T** calls the trolley; **E** mounts/dismounts. **F** claims nearby quest/rally checkpoints or performs the active timing game's action.
- Each table needs the required number of players, everyone ready, and its captain to start. Back to City keeps the seat. Leave Table / Leave Match releases it; leaving an active match forfeits.
- The board's Find in Brisbane action guides you to a friend. Quest and rally objectives take navigation priority.
- Host controls can mute chat for five minutes or remove a player. Anyone can mute another player locally.

Rooms cap at **10**, including disconnected seats reserved for 45 seconds. The connected player who joined earliest becomes host if needed. Reconnecting uses a per-room session token, not a new slot. Closing a tab/browser may remove its session token depending on browser session restoration. Room codes are invitations, not passwords; anyone given the code may join. Empty rooms expire after 24 hours.

## Ten minigames

| Game | Rules |
| --- | --- |
| Rebars & Burgers | Two-player tic-tac-toe with sculpted rebar and burger tokens. |
| Four in a Grill | Two-player Connect Four; server validates gravity and turns. |
| Rebar Memory | 16 hidden cards; matches earn another turn. |
| Burger Buzzer | Wait for the shared served signal; early presses burn the burger. |
| Bolt Beat | Eight shared beats; tap / F on time. |
| Forehead Feint | Secret rebar/burger/goggles choices, first to three wins. |
| Burger Stack | Time twelve drops; actual overlap determines survival. |
| Rebar Codebreak | Four different colours, eight guesses, private clues. |
| Singlet Shuffle | Solvable eight-tile sliding puzzle; legal neighbouring moves only. |
| Brisbane Rebar Rally | Ordered real CBD checkpoints, on foot or by trolley. |

The server owns turns, hidden information, timers and scores. A victory earns 10 room points, a draw 3 and other completed participation 2, once per match. Timing games use server receipt times and shared clocks, so differing internet latency can affect competition. This is a casual game, not a competitive anti-cheat service.

## Four-player quest

Exactly four connected players take the Captain, Marshal, Engineer and Scout roles. The host starts Seb's emergency. Each player collects a separate City Hall crate, delivers along Queen Street, crosses to the South Bank pads, then returns a stabiliser to City Hall. South Bank needs all four nearby confirmations within twelve seconds. Four final deliveries award 100 points each, exactly once. A replacement can fill a vacated role and continue the existing checkpoint; leaving does not wipe other players' progress. Active quest players must leave/finish it before starting a table match.

The gold arrow and fading route trail use the game's existing road network and local obstacle checks. All 20 objective anchors have been checked against the loaded city routes. Navigation may report an unavailable route rather than draw a trail through a building.

## Hosting and free limits

Frontend: https://danielslater3.github.io/bung-bunty-rebar-world/

Shared room service: https://bung-bunty-rooms.sitecraft-au.workers.dev

The backend is a Cloudflare Worker with one SQLite Durable Object per room and hibernating WebSockets. It is compatible with the Workers Free plan; no paid plan or paid add-on was enabled for this feature. Free hosting has daily and storage quotas. It is **not unlimited hosting**: Cloudflare may reject requests when a free allowance is exhausted. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/). No billing credentials are in the repository.

For a community server, deploy the same Worker in your own account, set its allowed game origins in `multiplayer/wrangler.jsonc`, then enter that address under Use a community server. Share that server address alongside its room code; invite links use the site's default server unless the recipient has selected the same community server.

## Develop and publish

From the repository root:

```sh
python3 -m http.server 8765
```

For local shared rooms, in a second terminal:

```sh
cd multiplayer
npm ci
npm run dev
```

Open http://127.0.0.1:8765 and select `http://127.0.0.1:8787` under Use a community server. Choose another Wrangler port if that port is occupied. The static game needs no build or npm dependencies. The installed backend dependencies are development/deployment tools only.

Backend deployment (already authenticated Cloudflare account required):

```sh
cd multiplayer
npm run deploy
```

If using a new backend address, run `node multiplayer/set-endpoint.mjs https://your-service.workers.dev` from the root. Add both import-map aliases for new source modules. Publish frontend changes to GitHub's `main` branch; Pages serves the repository root. Never commit OAuth credentials, `.dev.vars`, `.wrangler` or `node_modules`.

## Verification and practical limits

```sh
node --experimental-loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
node --test multiplayer/test/engine.test.mjs
node multiplayer/test/network.mjs
```

The network test expects the local Worker on port 8795; set `ROOM_SERVER` to test another address, including the public Worker. It creates ten genuine WebSocket clients and rejects an eleventh, exercises chat, a complete tic-tac-toe match, role allocation, invalid checkpoint rejection, host migration and identity/outfit/score restoration. Native tests simulate all ten games through completion, the full four-role quest, timing/turn/privacy rules and every avatar's geometry/material isolation.

With Playwright installed externally, `NODE_PATH=/path/to/node_modules node tools/tests/multiplayer.cjs` exercises two independent browser contexts: choosing different characters/colours/names, real room joining, matching remote outfits, chat safety, all ten playing interfaces, tic-tac-toe clicks, walking, reconnecting and leaving without changing the campaign save. `GAME_URL` and `ROOM_SERVER` can target production. `tools/tests/dashboard-gameplay.cjs` checks chapter replay loading and movement for Chapters 1–10.

The real city scene and character picker are inspected from browser screenshots. These checks are not a four-person human playthrough, hardware performance certification or proof of fairness on every network. Position bounds, speed checks and proximity are server validated; the server does not run the full Three.js city's collision simulation, so a modified client is not completely cheat-proof. The campaign, story progression and campaign localStorage slot are isolated from room play; persistent room scores are room-local, not a global account leaderboard.

### Release checks — 6 November 2026

- 41 native game checks and 17 authoritative multiplayer checks passed. The avatar check covers all 19 identities and verifies finite geometry, all four colour channels and material isolation.
- Real local and public Worker tests passed with ten independent WebSocket clients; the eleventh was rejected. Outfit data, chat, complete tic-tac-toe, four quest seats, host migration and rejoining were checked, including a close without a status code.
- Two independent Chrome browser contexts passed against both the local setup and the public GitHub Pages + Cloudflare service: custom Gabor and Chung outfits, names, all ten game interfaces, a played tic-tac-toe win, actual movement, reconnect and campaign-save protection. Character-picker, all 19 character portraits and in-city screenshots were visually inspected.
- Existing chapter-dashboard gameplay checks passed for Chapters 1–10, with movement, camera recovery and no browser errors.
- Reconnect fix: status-less WebSocket closes now receive a valid close reply, preventing a delayed handshake from outlasting the reserved player seat.
- Production backend deployed successfully; startup reported 3 ms. This is Worker startup, not game frame rate.

### Canonical character name

The partner and her family use Chung consistently in the entire game. Older character ids, campaign/replay archives, companion flags and saved multiplayer outfits migrate to the canonical ids while retaining progress, identity, score and custom colours. The source-cache version was refreshed. Validation: 45 native game checks and 18 multiplayer checks passed; loaded-scene Chapters 5–6 and the two-browser multiplayer suite passed with no browser errors.

### Chat and trolley feedback fixes

The multiplayer frame loop now advances dialogue timers even with chat or the room board open, so trolley speech bubbles expire normally. Enter explicitly submits the chat form, preserves text-field focus after sending and ignores held-key repeats / IME composition. The same E press is consumed after a room interaction so trolley physics cannot immediately undo a mount. Two-browser regression checks reproduced the trolley line, verified expiry while playing and chatting, checked mounting, sent Enter/numpad messages exactly once and passed the existing minigame/reconnect/save-isolation checks with no browser errors.

## Room activities

- **Queen Street Ring Rush** starts from the room board (B). Cross the eight gates in order toward Edward Street on foot or in the trolley. The first gate starts the 90-second clock. A complete run earns 40 room points and 24 rebar. The gold gate, route hint, chain count, and best time follow the server-confirmed run.
- **Brisbane Rebar Hunt** collects offcuts, burger tokens, and landmark stamps on contact, on foot or by trolley. Regular offcuts respawn individually. Burgers and stamps count toward the room collection. The Edward Street shipment has a shared three-minute cooldown. The board offers navigation to the hunt areas.
- **Bung’s Rebar Exchange** opens with E near the City Hall counter. Buy the steering kit, larger fuel tank, River Mint Paint, Burger Buzzer Horn, or Hot Chips Trail. Press H while riding to use an equipped horn. Purchases equip automatically and are visible to room peers where applicable.
- **Burger Heist** uses a marked Raymond Park field. Join a 1v1 or 2v2 queue and ready up. F picks up the burger, tackles an opposing carrier within reach, or scores at your coloured dock. First to two deliveries wins. The 90-second time limit and ready countdown use server time. The board has a viewing area, return control, and rematch. An early departure ends the round and returns the players.
- Room Points remain separate from spendable rebar. Both are visible while exploring. Ring awards, minigame results, and Seb’s expedition use the same room reward ledger. Progress stays with the room and browser session. Up to 32 departed profiles remain recoverable by their original room token during the room’s existing lifetime. There is no account-wide currency.

The authority checks use accepted movement samples, gate geometry, location, and server time. Combat and movement are designed for casual play. The room server does not simulate all city collisions.

To run the new loaded-scene regression against a local room server, start the game at port 8765 and the room server at port 8795, then use:

```sh
NODE_PATH=/path/to/playwright/node_modules node tools/tests/room-life.cjs
```

Set `GAME_URL` and `ROOM_SERVER` to test the live pair. The check uses two browser clients and bounded movement samples through the game loop. This complements the native checks for shared claims, purchase retries, reconnect, and 2v2 queue logic.
