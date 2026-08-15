# Album Viewing and Personal Curation Design

## Intent

PhotoView should remember which albums the signed-in user has genuinely viewed,
how often they have viewed them, and which albums they have personally curated.
The resulting state must follow the account across browsers and devices. Album
lists should expose compact viewing and curation markers, support filtering the
direct children of the current directory, and sort those children by viewing
activity without changing PhotoView's filesystem hierarchy.

An album is viewed only after one of its photos has been visibly presented for
two continuous seconds, or one of its videos has actually played for two
continuous seconds. Merely opening the album or browsing thumbnails does not
count. A user and album may increment at most once in any rolling 30-minute
window. Only the album containing the presented media is affected; ancestors
and descendants do not inherit the event.

## Chosen approach

Persist the state in a dedicated per-user, per-album table. Browser-local state
would not synchronize and could be lost; fields on `albums` would incorrectly
make viewing and curation global. A separate relation follows the existing
per-user media-favorite pattern while keeping scanner-owned album metadata
independent from user activity.

The first version deliberately excludes manual view-count editing, reset, and
"mark unread" operations. Personal curation is an explicit toggle; viewing
state is derived only from qualifying media presentation.

## Data model

Add `UserAlbumData`, stored as `user_album_data`, with:

- `user_id` and `album_id` as a composite primary key;
- foreign keys to users and albums with cascade deletion;
- `featured boolean not null default false`;
- `view_count bigint not null default 0`;
- nullable `last_viewed_at` for the latest qualifying two-second presentation;
- nullable `last_counted_at` for the start of the rolling deduplication window;
- normal created/updated timestamps if they are consistent with the existing
  model helpers.

Indexes should support `(user_id, featured)`, `(user_id, view_count)`, and
`(user_id, last_viewed_at)`. The current library is small enough that these are
not required for initial correctness, but they make the intended access paths
explicit and keep sorting predictable as the library grows.

Albums without a `user_album_data` row resolve as `featured=false`,
`viewCount=0`, and null viewing timestamps. Scanning existing libraries therefore
requires no backfill and does not rewrite album or media records.

## GraphQL contract

Expose an account-scoped state on `Album`, for example:

```graphql
type AlbumViewerState {
  featured: Boolean!
  viewCount: Int!
  lastViewedAt: Time
}

type Album {
  viewerState: AlbumViewerState!
}
```

Add two authorized mutations:

```graphql
recordAlbumView(albumId: ID!, mediaId: ID!): AlbumViewerState!
setAlbumFeatured(albumId: ID!, featured: Boolean!): AlbumViewerState!
```

Both mutations obtain the user from the authenticated request. They must verify
that the user owns or is otherwise authorized for the album. `recordAlbumView`
also verifies that the supplied media exists and belongs directly to that
album. Client-supplied user IDs, counts, and timestamps are never accepted.

The record mutation performs a single database upsert/update under a row lock
or equivalent atomic PostgreSQL expression. Every qualifying presentation may
advance `last_viewed_at`. It increments `view_count` and advances
`last_counted_at` only when no prior count exists or the previous counted time
is at least 30 minutes old. Concurrent devices therefore cannot both increment
the same window.

## Current-directory filtering and ordering

Filtering applies only to the direct child albums already displayed by the
current album page. It does not flatten descendants or turn the root albums
page into a global search result.

Extend the sub-album query with account-scoped inputs equivalent to:

- viewing state: all, viewed (`view_count > 0`), or unviewed (no row or zero);
- `onlyFeatured`, independently combinable with viewing state;
- ordering by `view_count` or `last_viewed_at`, in addition to existing album
  ordering.

The backend joins or correlates `user_album_data` for the current user only.
Unseen albums sort as a count of zero. Albums with no `last_viewed_at` always
sort after viewed albums when recent-view sorting is selected. Query-building
must allowlist the new computed order keys instead of interpolating arbitrary
column names.

The UI stores these choices in URL parameters, such as:

```text
?viewed=seen&featured=1&orderBy=view_count&orderDirection=DESC
```

Refreshing, navigating back, and sharing a local route preserve the selected
view. No filter remains the default, so existing directory browsing is
unchanged.

## Album-card and context-bar UI

Each album card receives two compact controls:

- a top-left eye/count badge for viewed albums, hidden when the count is zero;
- a top-right curation star, outlined when inactive and filled warm yellow when
  active.

The star is a real button with an accessible name and at least a 44-pixel touch
target. Activating it stops link navigation. The three- and four-column phone
layouts display only the eye icon and number; list layout may use the full
"Viewed N times" label. Existing album/folder badges remain legible and must
not overlap the new controls.

Personal curation has a second entry in the album context row. On phones it
lives in the fixed bottom album bar and mirrors with the existing left/right
hand preference. On desktop it lives in the normal album-title row. Both
entries mutate the same viewer state and update all visible representations.

The filter row gains a three-state All/Viewed/Unviewed control, an independent
Featured-only toggle, and View count/Recently viewed sorting options. Labels
must distinguish album curation from the existing media-favorite filter.

## Presentation timer and client data flow

The presentation view receives the containing album ID and active media ID.
For photos, the two-second timer starts only after the presented image reports
that it is displayed. For videos, it starts on actual playback. The timer is
cancelled and reset when the active media changes, the presentation closes, the
component unmounts, the page becomes hidden, or a video pauses or ends before
the threshold. Showing or hiding the overlay controls does not interrupt it.

At two continuous seconds, the client calls `recordAlbumView`. An in-memory map
may suppress repeat reports for that album for 30 minutes to reduce traffic,
but the server remains authoritative. Once 30 minutes have elapsed, another
media item that satisfies the timer may report and count again without
requiring a browser reload.

Passive tracking failures must never close or obstruct the viewer. The client
may log the failure and allow a later qualifying media item to retry. Curation
is an explicit user action, so it updates optimistically, rolls back on failure,
and displays a concise non-blocking error.

## Verification

Backend tests cover migration, default state, per-user isolation, ownership,
direct media-to-album validation, cascade deletion, curation updates, the
29-minute and 30-minute boundaries, concurrent deduplication, current-directory
filter combinations, ordering, and null placement.

Frontend tests use fake timers and media events to cover photo load, video play,
pause, media changes, presentation close, tab visibility, successful reporting,
silent retry, optimistic curation rollback, URL persistence, and prevention of
card navigation when the star is pressed.

Browser QA at 320 and 390 pixel phone widths and at desktop width verifies all
album layouts, both handed bottom-bar arrangements, combined filters, count and
recent-view ordering, accessible touch targets, and no overlay collisions or
horizontal overflow. A real two-second photo and video presentation must prove
the mutation and 30-minute dedupe against an isolated PostgreSQL instance.

Production rollout remains image-only after migration validation. Before
redeployment, create a fresh PostgreSQL dump, Compose backup, and ZFS snapshot;
validate the exact Compose diff; preserve both read-only gallery mounts; and
verify container health, restarts/OOM, album/media/cache counts, scanner state,
direct HTTP, and formal HTTPS after deployment.
