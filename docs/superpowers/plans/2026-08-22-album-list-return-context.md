# Album List Return Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return a person to the previously opened child album in the same album list, restoring its visual position and keeping a durable, localized last-opened marker on that card.

**Architecture:** Keep all state browser-local in a versioned `localStorage` record. `AlbumBoxes` owns the current list identity, captures a card anchor before navigation, and restores only when navigation carries an explicit return intent or is a browser history POP. `AlbumTitle` preserves the exact parent/breadcrumb route (including filters and ordering) through a route-state return stack. `AlbumBox` displays the persistent per-parent marker and writes the click record.

**Tech Stack:** React 18, React Router 6, TypeScript, Tailwind utility classes, i18next JSON resources, Vitest + Testing Library.

**Spec:** `docs/plans/2026-08-22-album-list-return-context-design.md`

## Global Constraints

- No GraphQL, server, database, migration, or view-count changes.
- Store state only in browser `localStorage`; malformed/old data must fail closed.
- Marker identity is `parentListKey` only; restoration identity additionally includes route query and the active mobile layout.
- Direct visits to `/albums` or `/album/:id` begin at the top. Only explicit parent/breadcrumb returns and browser back restore.
- Do not alter existing featured/view-count behavior or mobile masonry ordering.
- Add every new visible or accessible string to en, zh-CN, zh-TW, and zh-HK and to `CustomUiTranslations.test.ts`.

---

### Task 1: Add a tested return-context storage and navigation helper

**Files:**

- Create: `ui/src/components/albumGallery/albumListReturnContext.ts`
- Create: `ui/src/components/albumGallery/albumListReturnContext.test.ts`

- [x] Write failing tests for:
  - independent latest records for `/albums` and `/album/:parentId`;
  - query/layout-sensitive presentation keys;
  - retaining a marker when a presentation key changes;
  - safe recovery from invalid JSON and invalid record fields;
  - replacing a duplicate parent entry in a return-target stack.
- [x] Define exported, typed helpers for:
  - building a parent-list key and route presentation key;
  - reading/writing an `AlbumListReturnRecord` map;
  - reading the stable marker record by parent key;
  - merging a return target (`pathname + search`) into route state;
  - obtaining a target for an ancestor route.
- [x] Run `npm test -- --run src/components/albumGallery/albumListReturnContext.test.ts`; confirm the test was red before the implementation and green after it.

### Task 2: Capture card navigation context and render the durable marker

**Files:**

- Modify: `ui/src/components/albumGallery/AlbumBox.tsx`
- Modify: `ui/src/components/albumGallery/AlbumBoxes.tsx`
- Modify: `ui/src/components/albumGallery/AlbumBoxes.test.tsx`

- [x] Add failing component tests that click a child album and assert:
  - its parent list record contains the clicked id/title, current scroll position, and card viewport offset;
  - its route state contains the parent route with current search parameters;
  - the selected card receives a localized last-opened badge and marker class, while a new click replaces the marker for that parent only.
- [x] Give each card a stable `data-album-id` anchor and an `onClick` handoff supplied by `AlbumBoxes`; preserve `customLink` behavior.
- [x] In `AlbumBoxes`, derive `parentListKey` from the current pathname and `presentationKey` from pathname, search, and selected layout. Pass a click callback and marker information to cards.
- [x] Add a lower-right marker that coexists with folder, view-count, and featured controls. In compact columns, render an icon-only badge with localized `aria-label`; in list/desktop layouts retain concise visible text.
- [x] Re-run the focused AlbumBoxes tests and ensure the existing masonry/card-link expectations remain unchanged.

### Task 3: Preserve return targets through parent and breadcrumb navigation

**Files:**

- Modify: `ui/src/components/album/AlbumTitle.tsx`
- Modify: `ui/src/components/album/AlbumTitle.test.tsx`
- Potentially modify: `ui/src/components/albumGallery/AlbumGallery.tsx`

- [x] Write failing navigation tests for a child route entered with a return stack:
  - the one-handed Back action targets the exact prior parent route including query parameters and sets restoration intent;
  - breadcrumb ancestors target their matching stored route and set restoration intent;
  - absence of a stack retains today’s simple parent/root fallback.
- [x] Read `useLocation()` in `AlbumTitle`; use the storage/navigation helper to resolve each parent/breadcrumb target. Put an explicit `albumListRestore` flag into the `Link` state while preserving the stack for deeper navigation.
- [x] Ensure opening a subalbum appends/replaces its current parent list return target so repeated nested navigation remains correct.
- [x] Run focused AlbumTitle and AlbumGallery tests.

### Task 4: Restore visual position safely after list rendering

**Files:**

- Create: `ui/src/components/albumGallery/useAlbumListReturnRestore.ts`
- Create: `ui/src/components/albumGallery/useAlbumListReturnRestore.test.tsx`
- Modify: `ui/src/components/albumGallery/AlbumBoxes.tsx`

- [x] First write tests with mocked `window.scrollTo` and card geometry for:
  - explicit restoration returning the anchor to its recorded viewport offset;
  - browser-back (`POP`) restoration;
  - fallback to stored `scrollY` if the card is filtered out/not rendered;
  - no restoration on a direct list entry;
  - cancelling a pending restore after user `scroll`, `touchstart`, `pointerdown`, or `wheel` input.
- [x] Implement a hook that waits for album data and a rendered card, schedules restoration after layout has settled (two animation frames), and cleans up all animation/input listeners.
- [x] Use the stable card anchor first, then `scrollY` only if no matching card is present. Do not force scroll after cancellation.
- [x] Expose a short-lived restored id/result so `AlbumBoxes` can apply an accent ring/pulse and emit a polite localized live announcement.
- [x] Run the hook and AlbumBoxes suites, including narrow mobile layout coverage.

### Task 5: Complete translations and regression coverage

**Files:**

- Modify: `ui/src/extractedTranslations/en/translation.json`
- Modify: `ui/src/extractedTranslations/zh-CN/translation.json`
- Modify: `ui/src/extractedTranslations/zh-TW/translation.json`
- Modify: `ui/src/extractedTranslations/zh-HK/translation.json`
- Modify: `ui/src/components/CustomUiTranslations.test.ts`

- [x] Add keys for `Last opened` and `Returned to {{title}}`, with genuinely localized Chinese values.
- [x] Add keys to the customized UI translation contract.
- [x] Run `npm test -- --run src/components/CustomUiTranslations.test.ts` and verify all four locales are non-empty/non-English where required.

### Task 6: Validate, integrate, build, and deploy

**Files:**

- Modify: `docs/superpowers/plans/2026-08-22-album-list-return-context.md` (check off completed items)
- Modify: `CUSTOMIZATION.md` only if its feature inventory requires an explicit entry
- Modify: parent `photoview/` submodule pointer and deployment release record after source integration

- [x] Run focused Vitest suites, targeted ESLint, `npm run build`, and `npm run verify:pwa` from `ui/`. The full lint baseline has unrelated existing failures, and the full test run retains one pre-existing `PresentView` expectation that omits the already-established `loadHighRes: true` preference.
- [ ] Inspect `git diff`, create a source feature commit, merge it into source `main` with `git merge --no-ff`, and push the fork’s `main` only after tests are green.
- [ ] Build the exact source SHA using `photoview/build/build-latest.sh`; if the Mac engine is unavailable, use the documented TrueNAS image-transfer path without changing read-only library mounts.
- [ ] Update the GUI-managed `photoview-gallery-next` Compose image through its existing full-config `midclt app.update` payload. Preserve the known-good image/health checks as rollback.
- [ ] Verify the authenticated endpoint and container health. Report the release SHA/image and any browser-only verification limitations.
