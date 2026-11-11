# Permanent Bung profiles

Each player automatically receives a private, randomly generated recovery code and a cloud profile. Rebar, all ten trolley designs' owned/equipped garage parts, upgrade levels and legacy room inventory belong to that profile. They carry across campaign, free roam, chapter replay, rooms, reloads, and devices using the same code. BungBucks remain migrated into the rebar wallet; they are not a second currency.

**Player Profile** is available on menu screens and in the S24 Wallet. Copy the recovery code somewhere private, or enter it under Restore on another browser/device. A display name is not a login. Anyone with the code can access that profile. No email or paid game account is required. The backend stores a hash as its profile address, and profile credentials are removed from room snapshots.

Campaign Trolley Calibration and cycling now include every room edition alongside the legacy fleet, so a build purchased in a room can be selected in campaign too.

New Saga and Free Roam reset story progress as before, while preserving the permanent wallet and purchases. Chapter replay shares the wallet and upgrades while keeping its chapter checkpoints isolated. Campaign story progress, photos, phone notes, outfits and room points are not included in this cloud profile. Score can still be sold into the shared rebar wallet.

The browser first imports its existing campaign wallet/builds once. Rejoining an old room with its original room token also imports that old room's wallet/builds once. The game cannot discover balances in forgotten rooms or browser data that was already erased. An existing cloud profile ignores subsequent seed balances, preventing reloading an old campaign save from repeatedly importing money.

## Persistence

`BungProfile` is a separate SQLite Durable Object namespace with no room-expiry alarm. Its record stores the wallet, builds and upgrade levels. A durable operation-id table makes retries idempotent. Profile changes use deltas, so another device's earnings are not overwritten by a stale whole-wallet upload. Wallet operations reject overdrafts. Garage ownership merges; deliberate equipment changes on the same trolley use the latest applied selection.

Solo changes go into a durable browser outbox before upload. Earnings made offline remain queued until connection returns. Unsent positive earnings are coalesced, limiting offline queue growth. Mode changes capture pending changes before replacing the game state. Purchases made against a stale/offline balance may be rejected on synchronization if another device already spent the funds; the canonical wallet and fitted parts are then restored. Online multiplayer requires a successful profile sync before joining.

Room economy changes use a SQLite write-ahead journal containing the next room state and stable profile operation IDs. A restart after a remote debit replays the same operation ID, recovers the fitted part and finalizes the room state without charging twice. Server-authorized purchases, collection and game rewards all use this path. The server refreshes the canonical wallet before commands; negative transactions are applied before rewards. Cloud profiles remain after a room is deleted.

"Permanent" here means profiles have no automatic room-based expiry. It is not a guarantee of eternal hosting or unlimited storage. Keep the recovery code: clearing browser storage removes the local identity, and there is no email-based recovery. The game is a casual client-side campaign, not a cheat-resistant competitive economy. Solo earnings are accepted from the player's authenticated browser.

## Verification

```sh
node --loader ./tools/tests/loader.mjs --test tools/tests/*.test.mjs
npm --prefix multiplayer test
node --loader ./tools/tests/profile-loader.mjs tools/tests/profile-storage.mjs
ROOM_SERVER=http://127.0.0.1:8796 node tools/tests/profile-server.cjs
ROOM_SERVER=http://127.0.0.1:8796 NODE_PATH=/path/to/playwright/node_modules node tools/tests/profile-browser.cjs
```

The native suite covers profile merging and overdrafts. The storage harness uses real SQLite with a test adapter for Durable Object methods and injects a failure after a durable debit. It checks restart recovery, duplicate-debit prevention, and stale-room spending. The local Worker API test checks one-time initialization, concurrent duplicate requests, concurrent spending, recovery and player isolation. The browser flow exercises actual room rewards, two different rooms, campaign/reset/replay boundaries, reload, recovery on a second browser, offline retry and concurrent earnings on two devices. These checks do not establish indefinite service availability or a complete campaign playthrough.
