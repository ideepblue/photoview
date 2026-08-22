# ideepblue PhotoView customization

This fork keeps a small set of gallery-navigation and album-management changes
on top of the official PhotoView `master` branch. This repository is the
canonical implementation. The private operations repository consumes an
accepted commit through a Git submodule and builds directly from this source
tree; it does not maintain a second checkout or deployment patch stack.

## User-visible differences

| Area               | Customized behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fullscreen viewer  | Pointer-driven left/right/up/down swipes with a following neighbor, commit/rebound animation, axis locking, keyboard/button compatibility, and reduced-motion support. The active position, filename, and high-resolution loading are individually switchable from persistent quick-control preferences. Double tap enters a 2.5x detail mode; a temporary lower-right vertical rail supports 1.5x/2.5x/4x taps and continuous 1.1x–4x adjustment while one finger pans, with its scale label and marker moving from bottom to top. A tiny status mark distinguishes disabled loading, streamed high-resolution progress, displayed high resolution, and recoverable load failure without covering the photo. |
| Mobile albums      | Compact list plus 2/3/4-column natural-ratio masonry choices below 480 px; the choice persists in `localStorage`; cards are assigned deterministically to the estimated shortest lane. Each parent list also remembers its last opened child locally: parent/back, breadcrumbs, and browser back retain the original filter/order route and restore that card’s visual position when the presentation still matches. A persistent localized marker remains on the card until another child from the same parent list is opened.                                                                                                                                             |
| Mobile navigation  | Nested albums and photos are visually separated, album cards carry a folder badge, and fixed bottom controls cannot cover the final card. On phones, the complete album context row (breadcrumb/title, parent/back, and album options) moves from the top to a fixed bar above the global menu; it defaults to a right-hand layout and can be mirrored persistently for left-hand use from Album options. The fullscreen exit moves to the lower left on narrow screens and appears only with the other tap-revealed controls. |
| Details and covers | Fullscreen controls start hidden and appear on a light tap. The existing Info sidebar remains available on touch devices and can set the selected photo as the current or parent album cover.                                                                                                                                                                                                                                                                                                                                  |
| Automatic covers   | Without a manual cover, direct `cover.*` files win, then direct filenames containing `cover`, then the same two rules in descendants, before the normal fallback.                                                                                                                                                                                                                                                                                                                                                              |
| Album maintenance  | Administrators can scan only the current album or recurse through descendants. Normal mode discovers media and fills missing caches; the optional force mode atomically replaces existing thumbnail URLs/files.                                                                                                                                                                                                                                                                                                                |
| Album ordering     | A normal album with no explicit ordering query defaults to title ascending. Explicit URL choices, share pages, and the all-albums page keep their own behavior.                                                                                                                                                                                                                                                                                                                                                                |
| Album engagement   | Each user can feature albums and gets a private viewed count. A view is counted only after a photo has loaded or a video has actually played continuously for two seconds; the exact containing album is counted at most once per rolling 30-minute window. Album cards show non-zero counts and a feature toggle. Current-directory album lists can combine viewed/unviewed and featured filters, then sort by view count or recent viewing; these choices remain in the URL.                                                                 |
| Home preference    | The authenticated root page defaults to Albums instead of Timeline. Each account can switch the destination between Albums and Timeline in User preferences.                                                                                                                                                                                                                                                                                                                                                                  |
| Installed web app  | The manifest and service worker provide a standalone PWA app shell. On installed mobile displays, a pull from the top refreshes the application and checks for a new service worker; fullscreen viewing and interactive controls opt out of the gesture, and media URLs are never cached by the app shell.                                                                                                                                                                                                                       |

The main implementation entry points are:

- `ui/src/components/photoGallery/presentView/` for fullscreen gestures,
  controls, and the loaded-resource quality indicator;
- `ui/src/components/layout/PullToRefresh.tsx`, `ui/public/service-worker.js`,
  and `ui/src/serviceWorkerRegistration.ts` for installed-PWA refresh and app
  shell behavior;
- `ui/src/components/routes/Routes.tsx`,
  `ui/src/Pages/SettingsPage/UserPreferences.tsx`, and
  `api/graphql/models/user.go` for the per-account home-page preference;
- `ui/src/components/albumGallery/` and `ui/src/components/album/` for mobile
  layout, parent navigation, and album scan controls;
- `ui/src/components/sidebar/AlbumCovers.tsx` for manual cover actions;
- `api/graphql/models/album.go` for automatic cover selection;
- `api/graphql/resolvers/scanner.go` and `api/scanner/` for scoped scans and
  force-aware thumbnail processing;
- `api/graphql/models/user_album_data.go`,
  `api/graphql/models/actions/album_engagement.go`, and the album resolvers for
  per-user engagement state, deduplicated counting, filtering, and sorting;
- `ui/src/hooks/useAlbumEngagementParams.ts`,
  `ui/src/components/album/AlbumFeaturedButton.tsx`, and
  `ui/src/components/photoGallery/presentView/AlbumViewTracking.tsx` for the
  engagement controls and qualifying-view timer;
- `ui/src/Pages/AlbumPage/AlbumPage.tsx` for the album-specific ordering default.

## Branch and remote model

```text
origin/main       long-lived customized integration branch
upstream/master   official PhotoView update feed
local master      clean tracking branch for upstream/master
feature/*         one reviewable change or upstream-sync effort
codex/*           retained historical feature branches from the initial build
```

Create every new change from `main`, verify it on its feature branch, and merge
it with an explicit merge commit:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/<name>
# edit and verify
git switch main
git merge --no-ff feature/<name>
git push origin main
```

Do not rebase or force-push `main`. To import official changes, use a dedicated
`feature/sync-upstream-YYYYMMDD` branch, merge `upstream/master` there, resolve
and test the complete customized behavior, then merge that branch into `main`
with `--no-ff`.

```bash
git fetch --prune origin
git fetch --prune upstream
git switch main
git pull --ff-only origin main
git switch -c feature/sync-upstream-YYYYMMDD
git merge upstream/master
# run the verification relevant to every affected area
git switch main
git merge --no-ff feature/sync-upstream-YYYYMMDD
```

## Verification

For UI-only changes, run the focused Vitest files first, then the complete UI
suite and production build:

```bash
cd ui
npm ci
npm test -- --run
npm run build -- --base=/
```

Run `npm run lint` when the touched area has a clean lint baseline; at minimum,
lint and format every changed UI file. API/scanner changes must also run the
focused Go packages and the relevant database-backed integration tests. Before
release, record the accepted commit and ensure the operations repository's
submodule pointer identifies that exact revision.

## Release boundary and license

Keep credentials, media paths, database dumps, cache contents, private network
details, and production Compose state out of this public source repository.
Deployment-specific image pins, backups, health evidence, and rollback commands
belong in the operator's private infrastructure repository.

PhotoView and these modifications remain licensed under
[GNU AGPL-3.0](./LICENSE.txt). Anyone providing a modified network service must
make its corresponding source available as required by that license.
