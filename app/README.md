# SkinScope Journey Redesign

This is the new default application at `/ScinScope/index.html`, implemented in
plain HTML, CSS and ES modules. The previous Home is preserved at
`pages/legacy-home.html`; existing account, scan and plan handlers are retained.
No authentication checks have been disabled on the server. Entering the journey
without signing in uses a separate guest journal, not a fabricated session.

## Interface

- Five routes: Home, Photo, Progress, Leaderboard and Profile.
- Fixed five-item mobile navigation, safe-area spacing, desktop sidebar and
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
  bottle welcome animation, white transition, Skip and Replay welcome.

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
touch the real database or email outbox. Use a static server from the parent
directory so existing absolute `/ScinScope/` legacy links continue working.

## Visual Assets

Built-in image generation was used, not a remote image dependency:

- `app/welcome-bottle.png`: transparent, friendly white 3D pump bottle with a
  blue pump, water drop and SkinScope label, full silhouette, soft studio light.
- `app/skin-texture.jpg`: illustrative macro cheek-skin texture, subtle pores,
  pale peach tone, diffuse light, no identifiable face or diagnostic condition.

The texture was converted to JPEG for delivery; the bottle preserves alpha.
`icons.js` extends the existing project-local vector illustration family.
