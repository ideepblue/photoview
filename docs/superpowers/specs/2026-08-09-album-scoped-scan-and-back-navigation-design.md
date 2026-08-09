# Album-scoped scan, cache refresh, and parent navigation

Date: 2026-08-09

Status: approved direction, including optional forced cache refresh

## Goal

Make album maintenance practical from the album page without broad user-wide scans, and make hierarchical navigation usable without relying on a small breadcrumb target.

The feature has two visible parts:

1. An administrator-only album scan control with current-album and recursive-subtree scopes.
2. A prominent back-to-parent control at the upper left of an album page.

## User experience

### Scan control

The album toolbar gets one `Scan and cache` menu button. Opening it shows:

- `Current album only`
- `Current album and all child albums`
- `Force rebuild existing thumbnails`, an unchecked option
- A final `Start scan` action

The force option always starts unchecked when the menu opens. It is deliberately not persisted, so a one-off expensive request cannot become the accidental default for future scans.

Normal scans discover new media, discover new child directories when recursive scope is selected, and generate missing derived files. Existing healthy thumbnails are not re-encoded.

Forced scans regenerate existing photo and video thumbnails as well as filling missing ones. They do not transcode cached video streams or modify originals. If both recursive scope and force refresh are selected, the UI shows an explicit confirmation that the operation may take a long time.

The control is only rendered for administrators. Submitting it disables the action while the mutation is in flight and then reports how many album jobs were queued. Existing global scanner notifications continue to show queued/running work and completion.

### Parent navigation

An accessible 44-by-44-pixel back button is the first item in the album title row:

- In a nested album, it links to the immediate parent album.
- In a user-visible root album, it links to `/albums`.
- It follows album hierarchy rather than browser history, so it cannot unexpectedly return to search, settings, or an unrelated page.

The breadcrumb remains available for jumping more than one level. The title area uses a non-shrinking back button and a `min-width: 0` breadcrumb/title container so the button, breadcrumb, title, and album-options button do not overlap on narrow phones.

## API contract

Add one administrator-only mutation:

```graphql
scanAlbum(
  albumId: ID!
  recursive: Boolean!
  forceRefresh: Boolean!
): ScannerResult! @isAdmin
```

The resolver verifies that the album exists, builds the selected album set, and adds jobs to the existing scanner queue. `ScannerResult.message` contains the queued album count and selected mode.

The existing `scanAll` and `scanUser` behavior remains unchanged.

## Scoped filesystem discovery

Extract the directory traversal currently used by `FindAlbumsForUser` into a reusable scoped traversal that accepts an existing root album and a recursive flag.

For a current-album scan, the traversal prepares inherited and local `.photoviewignore` state and queues only the selected album.

For a recursive scan, it walks only beneath the selected album path. It retains PhotoView's current rules for hidden directories, directory symlinks, supported media detection, and inherited `.photoviewignore` files. Missing child album records are created with the selected tree's parent relationship and inherited owners.

The scoped traversal must not call user-wide album cleanup. Media cleanup inside each scanned album continues to use PhotoView's normal scanner behavior, which only updates database/cache state and never deletes source media. Albums elsewhere in the user's roots are not scanned or cleaned.

## Queue behavior

Each scanner job carries `forceRefresh` in its task context.

Queue deduplication uses strongest-request semantics:

- Repeated normal requests for an album collapse to one job.
- Repeated forced requests collapse to one forced job.
- A queued normal job is upgraded if a forced request arrives before it starts.
- If a normal job is already running, one forced follow-up job may be queued.
- A normal request never downgrades or duplicates an existing forced job.

This prevents repeated taps from multiplying expensive work while preserving an explicit later force-refresh request.

## Forced thumbnail refresh and browser caching

Photo routes currently return `Cache-Control: private, max-age=31536000, immutable`. Overwriting a thumbnail at the same URL would therefore leave some clients displaying the old file for up to a year.

Forced refresh uses URL rotation:

1. Encode the replacement thumbnail to a newly generated media name.
2. Validate its dimensions and file size.
3. Update the existing `MediaURL` database row to the new media name and metadata.
4. Remove the old derived file only after the database switch succeeds.
5. Remove the new file if the database update fails.

The existing URL remains usable until the replacement is complete, and the new unique URL bypasses immutable browser caches. The refreshed URL is included in scanner `updatedURLs`, so blurhash and enabled downstream image processing follow the normal pipeline.

After the global scanner-complete notification, an album page that initiated a scan refetches its album query. This makes new media and rotated thumbnail URLs visible without requiring a manual page reload.

## Safety and error handling

- Both the schema directive and UI enforce administrator-only access.
- The backend treats the album ID and its recorded absolute path as the scope boundary; client paths are never accepted.
- Recursive discovery cannot escape the selected tree except through directory symlinks already admitted by PhotoView's existing scanner rules.
- Source media is opened read-only by the processing pipeline.
- A failed replacement leaves the previous thumbnail URL/file intact whenever encoding or validation fails before the database switch.
- Partial album failures are reported through scanner errors while other queued albums continue.

## Verification

Backend tests cover:

- Current-only scan excludes children.
- Recursive scan creates and queues new child directories containing media.
- Recursive scan does not include sibling or ancestor albums.
- Inherited `.photoviewignore` behavior is preserved.
- Queue requests deduplicate and upgrade to force mode correctly.
- Normal processing keeps an existing thumbnail untouched.
- Forced processing rotates the thumbnail URL, deletes the old derived file after success, and preserves it on failure.

Frontend tests cover:

- The scan menu is hidden from non-admin users.
- Each scope sends the correct mutation variables.
- Force mode defaults off and requires confirmation when combined with recursion.
- Success and error feedback are visible.
- Nested albums link back to their immediate parent and roots link to `/albums`.

Browser verification covers phone and desktop widths, menu touch targets, no overlap with sorting/breadcrumb/options controls, correct parent navigation, a small local normal scan, and a forced refresh whose thumbnail URL changes.

## Rollout and rollback

Build and test a versioned candidate image without replacing production. Record the current production image and app configuration as the rollback point. After local/API/browser verification, deploy through the existing TrueNAS Apps workflow, verify container and database health, perform one bounded production scan, and verify the formal HTTPS route.

Rollback is an image-only application rollback. The mutation is additive, and no schema migration is required. Rotated cache rows remain valid if the previous image is restored.
