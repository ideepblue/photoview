# Album Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add account-scoped album view counts and personal featured state, with exact two-second fullscreen tracking, current-directory filters and activity sorting, then safely deploy the verified image to TrueNAS using the consolidated production directory layout.

**Architecture:** Persist one `user_album_data` row per user and album. Authorized model actions own validation, atomic 30-minute deduplication, feature toggles, and list filtering; GraphQL only adapts authenticated requests. Album list actions batch-load viewer state into transient model fields so cards do not create N+1 queries. The React UI keeps album filters in the URL, uses one reusable optimistic featured control in cards and the album context bar, and drives a tested presentation timer from real photo-load/video-play lifecycle events.

**Tech Stack:** Go, GORM, PostgreSQL/SQLite test dialects, gqlgen GraphQL, React 18, TypeScript, Apollo Client, Vitest/Testing Library, Docker BuildKit, TrueNAS Apps/Docker, ZFS.

---

## Task 1: Add the per-user album state model and migration

**Files:**
- Modify: `api/graphql/models/user.go`
- Modify: `api/graphql/models/album.go`
- Modify: `api/database/database.go`
- Test: `api/graphql/models/user_album_data_test.go`

- [ ] Write a database test proving the composite key, zero/default state, per-user isolation, and cascade deletion.
- [ ] Run the focused database test against an isolated PostgreSQL test database and confirm it fails because the model/table is absent.
- [ ] Add `UserAlbumData` with cascade foreign keys, `featured`, `view_count`, nullable activity timestamps, timestamps, and the three account-scoped indexes.
- [ ] Add transient viewer-state storage to `Album` without persisting it in the scanner-owned album table.
- [ ] Register the model with automatic migration and database cleanup.
- [ ] Rerun the focused test and commit the minimal model/migration change.

## Task 2: Implement authorized feature toggles and atomic view recording

**Files:**
- Create: `api/graphql/models/actions/album_engagement.go`
- Create: `api/graphql/models/actions/album_engagement_test.go`

- [ ] Write tests for ownership denial, exact media-to-album validation, per-user feature toggles, and preservation of existing counts during toggles.
- [ ] Write deterministic timestamp tests for first count, repeated reports at 29:59, the 30:00 boundary, `last_viewed_at` advancement, and different users.
- [ ] Add a concurrent-call PostgreSQL test proving only one increment occurs inside a dedupe window.
- [ ] Run the focused tests and confirm the missing actions fail.
- [ ] Implement a shared authorization validator, feature upsert, and a single conditional database update that atomically enforces the rolling 30-minute window.
- [ ] Rerun the focused tests and commit the action layer.

## Task 3: Add current-directory filters, activity ordering, and batched viewer state

**Files:**
- Modify: `api/graphql/models/actions/album_actions.go`
- Modify: `api/graphql/models/actions/album_actions_test.go`
- Modify: `api/graphql/resolvers/album.go`

- [ ] Write action tests for direct-child scope, All/Viewed/Unviewed, Featured-only combinations, per-user isolation, view-count order, recent-view order, and unseen/null values last.
- [ ] Run the focused tests and confirm the new query behavior is absent.
- [ ] Add allowlisted album engagement filter/order helpers that join only the authenticated user's rows.
- [ ] Batch-attach viewer state to returned album models in a second query, including default zero values when no row exists.
- [ ] Use the same helper for `myAlbums` root entries and `subAlbums` direct children without flattening descendants.
- [ ] Rerun the focused tests and commit the list-query behavior.

## Task 4: Expose and verify the GraphQL contract

**Files:**
- Modify: `api/graphql/resolvers/album.graphql`
- Modify: `api/graphql/resolvers/album.go`
- Modify: `api/gqlgen.yml`
- Regenerate: `api/graphql/generated.go`
- Regenerate: `api/graphql/models/generated.go`
- Test: `api/graphql/resolvers/album_engagement_test.go`

- [ ] Write resolver/operation tests for default `viewerState`, authenticated mutations, unauthorized requests, invalid album/media pairs, and list arguments.
- [ ] Run the focused tests and confirm schema operations are unavailable.
- [ ] Add `AlbumViewerState`, `AlbumViewFilter`, `viewerState`, both mutations, and list filter arguments to the schema.
- [ ] Bind the viewer-state GraphQL model, regenerate gqlgen output inside the project Go build environment, and implement thin resolvers over the tested action layer.
- [ ] Rerun focused resolver and action tests, then commit the GraphQL contract and generated output.

## Task 5: Add album URL state and filter/sort controls

**Files:**
- Create: `ui/src/hooks/useAlbumEngagementParams.ts`
- Create: `ui/src/hooks/useAlbumEngagementParams.test.tsx`
- Modify: `ui/src/components/album/AlbumFilter.tsx`
- Modify: `ui/src/components/album/AlbumFilter.test.tsx`
- Modify: `ui/src/Pages/AlbumPage/AlbumPage.tsx`
- Modify: `ui/src/Pages/AllAlbumsPage/AlbumsPage.tsx`
- Modify: `ui/src/components/albumGallery/AlbumGallery.tsx`
- Regenerate: affected files under `ui/src/**/__generated__/`

- [ ] Write hook tests for URL defaults and persistence of `viewed`, `featured`, `albumOrderBy`, and `albumOrderDirection`.
- [ ] Write UI tests for the three-state album view selector, independent Featured-only toggle, and View count/Recently viewed sorting without conflating media favorites.
- [ ] Run focused UI tests and confirm they fail.
- [ ] Implement the URL hook, controls, GraphQL variables, current/root directory queries, and activity sorting options.
- [ ] Generate Apollo types and rerun focused tests.
- [ ] Commit URL/query/filter behavior.

## Task 6: Add reusable personal-feature controls to cards and the album context bar

**Files:**
- Create: `ui/src/components/album/AlbumFeaturedButton.tsx`
- Create: `ui/src/components/album/AlbumFeaturedButton.test.tsx`
- Modify: `ui/src/components/albumGallery/AlbumBox.tsx`
- Modify: `ui/src/components/albumGallery/AlbumBoxes.tsx`
- Modify: `ui/src/components/albumGallery/AlbumBoxes.test.tsx`
- Modify: `ui/src/components/album/AlbumTitle.tsx`
- Modify: `ui/src/components/album/AlbumTitle.test.tsx`

- [ ] Write tests for outlined/filled star state, a 44-pixel touch target, card-link event suppression, optimistic cache update, rollback, and concise non-blocking failure text.
- [ ] Write context-bar tests proving the star is present once, shares state with cards, and mirrors with right/left-handed mobile action ordering while desktop order remains stable.
- [ ] Run focused tests and confirm they fail.
- [ ] Implement one normalized Apollo mutation control reused by both entry points.
- [ ] Add the count badge only when `viewCount > 0`, keep the folder badge legible, and adapt labels for compact/list layouts.
- [ ] Rerun focused tests and commit the card/context UI.

## Task 7: Implement exact two-second fullscreen presentation tracking

**Files:**
- Create: `ui/src/components/photoGallery/presentView/useAlbumViewTracking.ts`
- Create: `ui/src/components/photoGallery/presentView/useAlbumViewTracking.test.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentMedia.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentMedia.test.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentSwipeTrack.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentView.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentView.test.tsx`
- Modify: `ui/src/components/photoGallery/MediaGallery.tsx`
- Modify: `ui/src/components/albumGallery/AlbumGallery.tsx`
- Regenerate: affected files under `ui/src/**/__generated__/`

- [ ] Write fake-timer tests proving photos start only after displayed high-resolution load and videos start only after `play`.
- [ ] Add cancellation tests for media change, close/unmount, hidden tab, video pause/end, and sub-two-second activity.
- [ ] Add success, 30-minute client suppression, expiry/re-report, and silent failure/retry tests.
- [ ] Run focused tests and confirm tracking is absent.
- [ ] Implement the lifecycle hook and propagate album/media readiness events through the fullscreen component chain without affecting non-album galleries.
- [ ] Add the passive GraphQL mutation call with no blocking viewer UI.
- [ ] Rerun focused tests and commit presentation tracking.

## Task 8: Run complete local and isolated-stack verification

**Files:**
- Modify only if verification reveals an in-scope defect.

- [ ] Run formatting, lint, all UI tests, production UI build, gqlgen freshness, and all API unit tests.
- [ ] Build the API/full image through the Docker build stage because the Mac host has no Go toolchain.
- [ ] Start an isolated PostgreSQL candidate stack and run database integration tests, including concurrency and migration from a pre-feature schema.
- [ ] Exercise real GraphQL operations for two users, direct-child filters, both sorts, the 29/30-minute boundary, and invalid media ownership.
- [ ] Browser-test 320px, 390px, and desktop layouts, both handedness choices, every mobile album layout, combined filters, card/context stars, photo tracking, video tracking, and absence of overflow/overlap.
- [ ] Record the exact candidate image digest and commit any narrowly scoped fixes with their regression tests.

## Task 9: Merge and update the operational source of truth

**Files:**
- Modify in parent repo: `photoview/source` submodule pointer
- Modify if required: `photoview/deploy/production/README.md`
- Modify if required: `photoview/deploy/production/docker-compose.yml`

- [ ] Recheck both worktrees for unrelated user changes and confirm the feature branch is fully verified.
- [ ] Merge `feature/album-engagement` into source `main` with explicit `git merge --no-ff`; do not force-push.
- [ ] Build the timestamped production candidate from merged source and verify its embedded source SHA.
- [ ] Update the parent submodule pointer in a separate commit.
- [ ] Preserve the production Compose directory `/mnt/hot-data/docker-compose/photoview-gallery-next` and data root `/mnt/hot-data/docker/photoview-gallery-next`.
- [ ] Ensure the overlay mount source remains `/mnt/hot-data/docker/photoview-gallery-next/library` while its compatibility destination remains `/mnt/hot-data/docker/photoview-gallery/library:ro`; preserve `/mnt/main/media-library/picture:ro`.
- [ ] Document the exact candidate, rollback image, migration behavior, and verification commands without duplicating unstable pins outside the production runbook.

## Task 10: Back up, deploy to TrueNAS, and verify production

**Files:**
- Production host: `/mnt/hot-data/docker-compose/photoview-gallery-next`
- Production data root: `/mnt/hot-data/docker/photoview-gallery-next`
- Repository record: `photoview/deploy/production/README.md`

- [ ] Re-read live app/container/Compose state and current database/media/cache/scanner counts; do not rely on older recorded counts.
- [ ] Create and verify a fresh PostgreSQL dump, Compose backup, and ZFS snapshot; retain the current first-line image as rollback.
- [ ] Compare candidate and live Compose so the image is the only intended runtime change and both read-only gallery mounts remain exact.
- [ ] Deploy through the existing TrueNAS application workflow, never by an unmanaged parallel Compose stack.
- [ ] Verify automatic migration created `user_album_data` without modifying scanner-owned media, album, or overlay content.
- [ ] Verify container health, restart/OOM state, logs, direct HTTP, formal HTTPS, authentication, album/media/cache counts, and scanner idle/healthy state.
- [ ] Perform a real production UI smoke test for featured toggle, filters, count badge, right/left-handed context bar, and one qualifying two-second view followed by a deduplicated repeat.
- [ ] Update the production runbook with candidate digest, source SHA, backups/snapshot, rollback command, and observed post-deploy checks; stop and roll back on any failed gate.
