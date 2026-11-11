# SkinScope Journey Redesign

This is the new default application at `/ScinScope/index.html`, implemented in
plain HTML, CSS and ES modules. The previous Home is preserved at
`pages/legacy-home.html`; existing account, scan and plan handlers are retained.
No authentication checks have been disabled on the server. Entering the journey
without signing in uses a separate guest journal, not a fabricated session.

## Interface

- Five routes: Home, Photo, Progress, Leaderboard and Profile.
- Fixed four-item mobile navigation matching the supplied image, safe-area
  spacing, five-route desktop sidebar and
  contextual right column. All navigation entries have real destinations.
- Three header metrics only: real check-in streak, opt-in rank or an empty dash,
  and locally saved photo count. No fabricated users, scores or completions.
- Ten illustrated, three-question self-reported check-ins. Choices, completion
  dates and progress are saved. Answers can be reviewed and check-ins retaken.
- Camera/file selection, drag-and-drop, type selection, preview, replace,
  remove, private journal save, notes, download, comparison and deletion.
- Progress Overview / Tests / Photos tabs and profile subviews for edit,
  statistics, photos, friends, groups and settings.
- Keyboard focus states, labels, skip link, reduced motion, press feedback,
  bottle welcome animation, white transition, Skip and Replay welcome. Only
  the pump head moves; opaque cream follows the press. Recorded pump audio is
  gesture-triggered, optional, and never plays on page load or Skip.

## Storage And Privacy

`store.js` keeps guest and authenticated journals under different owner keys.
Photo blobs are resized locally and stored in IndexedDB, indexed by owner.
Photos are not sent to the social API and are never included in shared profiles.
Browser storage is not an encrypted vault; someone with access to the same
browser profile can inspect it. Export is available in Profile / Settings.
There is no automatic transfer of guest photos into a signed-in account.

The own Node/SQLite backend adds `journey_journals`, `journey_friends`,
`journey_groups` and `journey_members`. It requires a verified existing session.
Private journal routes always derive the owner from the session, not a supplied
user ID. Strangers see name, avatar and bio only. Accepted friends see stats or
test names/dates only when the owner explicitly opts in. Answers never appear
in friend/public responses. Group membership does not imply friendship.
Removing a friend revokes friend-only access. Only members can read a group
and its invite code. Leaderboard inclusion is opt-in, based on valid completed
check-ins (10 points each), not appearance. Completion times are server-assigned.

Routes under `/api/journey`:

| Path | Methods | Purpose |
| --- | --- | --- |
| `/journal` | GET, PUT | Own profile, answers, check-in activity |
| `/social` | GET | Friends, incoming requests, groups, rank |
| `/leaderboard?period=week,month,all` | GET | Opt-in participation ranking |
| `/search?q=...` | GET | Public names/avatars, no emails |
| `/people/:id` | GET | Privacy-filtered public/friend profile |
| `/friends` | POST, DELETE | Request friendship / remove |
| `/friends/respond` | POST | Recipient-only accept/reject |
| `/groups` | POST | Create group and invite code |
| `/groups/:id` | GET | Members-only group detail |
| `/groups/join` | POST | Join with a code |
| `/groups/leave` | POST | Leave a group |

## Deliberate Limits

- AI skin/product analysis is **not connected**. Photos can be saved, but no
  scores, skin ages or health conclusions are invented. Skin Score is an honest
  empty state until actual analyses exist.
- Nearby discovery is explicitly unavailable and never asks for location.
- Existing registration requires a reachable own backend and configured SMTP
  for actual emails. This redesign does not claim to fix missing public hosting
  or SMTP. GitHub Pages cannot execute the Node/SQLite server.
- The new guest experience works without the backend. Friends/groups, public
  ranking and signed-in journal sync need the updated server. Existing payments
  remain demonstrational; no real checkout is added.
- Photos are device-local, not cross-device cloud uploads. Guests never publish
  a profile or participate in rankings.

## Checks

Run `node --test tests/journey-server.test.mjs` for isolated in-memory privacy,
ownership, request direction, ranking and group access tests. These tests never
touch the real database or email outbox. Run `node --test tests/welcome.test.mjs`
for intro timing, mute, reduced-motion and audio-failure checks.
Use a static server from the parent
directory so existing absolute `/ScinScope/` legacy links continue working.

## Visual Assets

The November 11 pass uses the first supplied image for mobile, and ONLY the
computer portion of the second supplied image for desktop. The screenshots
are not rendered as a fake app: the text, inputs, buttons and navigation are
real HTML controls. Artwork and common icon shapes are literal cropped source
pixels in `reference/`, not another generated approximation or emoji atlas.

`interface.css` is now the active UI refinement stylesheet. Desktop has a
190px sidebar, four course columns, a white metrics capsule and four right
panels: Your Progress, Daily Goal, Leaderboard and Your Stats. On narrow tablets
the side panels hide and the grid adapts. Mobile has the first image's two
course columns and four bottom items, not the second image's mobile design.
The header crown opens Leaderboard; the desktop sidebar has five routes.

`reference-art.js` chooses the correct mobile/desktop originals. The rings,
crowns, locks, camera/gallery art, product/skin option images, navigation glyphs
and decorative desktop podium come from the user references. Common masks use
module-absolute URLs. Unpictured controls reuse the existing local SVG family.
The podium is decorative art, not invented accounts or real ranking results.
No reference photos of actual people or complete screenshots are published.

`scripts/extract-reference-assets.mjs` records deterministic crop coordinates
and outputs `reference/manifest.json`. Rebuilding requires Sharp and the two
original reference PNGs, passed as arguments; `SHARP_PATH` can select an existing
Sharp installation. No image generation is used for these UI assets. Original
resolution limits apply; replace them with original high-resolution exports
if the user supplies those. Older generated atlases are retained but inactive.

`Roboto.ttf` is self-hosted with `ROBOTO-OFL.txt`. The app does not fetch fonts
or UI images from external servers at runtime.

`welcome.css` and `welcome-pump-v4.png` replace the old gray bottle intro.
The generated white/cobalt dispenser uses aligned head/body masks. A real tap
depresses the head, releases an opaque cream/foam ribbon and triggers a white
wipe. The primary button and bottle both enter; Skip also interrupts an active
animation and cancels its timers. Mute persists; there is no autoplay audio.
The upgraded intro is shown once with `welcomeVersion=4`, without clearing
any journal/profile data. Reduced-motion users bypass the physical animation.

Sensitivities and Goal unlock after the first eight check-ins; already completed
tests are never relocked. Daily Goal counts real test activity on the user's
local day. Empty health metrics stay empty, not copied from the mockup. See
`tests/course-state.test.mjs` and `tests/reference-art.test.mjs` for focused tests.

The original login remains reachable; guest access never creates a session.
`soap-pump.mp3` remains the CC0 recorded dispenser. Source details and generation
provenance are in `ASSET_CREDITS.md`.
