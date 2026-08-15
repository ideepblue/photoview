# Mobile Album Context Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the complete album context row to a fixed phone bottom bar and add a persistent right/left-hand layout preference.

**Architecture:** Keep one `AlbumTitle` context row and make it responsive rather than duplicating interactive controls. Store handedness in a focused browser-preference module consumed by the row and a small setting component inside `AlbumSidebar`; reserve additional album-page bottom space in CSS.

**Tech Stack:** React 18, TypeScript, styled-components, Tailwind utilities, Vitest, Testing Library, Vite.

## Global Constraints

- Phone layouts below `1024px` have no album context row at the top.
- The context row is fixed immediately above the existing global bottom menu.
- Right hand is the default; the left-hand setting mirrors the two actions to the left.
- Preference is browser-local and changes the open album immediately.
- Desktop layout, GraphQL, database state, media, and global navigation remain unchanged.

---

### Task 1: Handedness preference contract

**Files:**
- Create: `ui/src/components/album/mobileAlbumContextBarPreferences.ts`
- Create: `ui/src/components/album/mobileAlbumContextBarPreferences.test.tsx`

**Interfaces:**
- Produces: `MobileAlbumContextBarHandedness = 'left' | 'right'`, `MOBILE_ALBUM_CONTEXT_BAR_HANDEDNESS_KEY`, `readMobileAlbumContextBarHandedness()`, `writeMobileAlbumContextBarHandedness(value)`, and `useMobileAlbumContextBarHandedness()`.

- [ ] **Step 1: Write failing preference tests**

Test literal outcomes: missing or malformed storage reads `right`; writing `left` persists `left`; two hook consumers update in the same tab after one writes `left`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- --run src/components/album/mobileAlbumContextBarPreferences.test.tsx`

Expected: FAIL because the preference module does not exist.

- [ ] **Step 3: Implement the minimal preference module**

Use guarded `window.localStorage`, a named `CustomEvent`, a `storage` listener, and a React hook initialized from the safe reader. Accept only the literal values `left` and `right`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 1 command and require all preference tests to pass.

### Task 2: Fixed responsive album context bar

**Files:**
- Modify: `ui/src/components/album/AlbumTitle.tsx`
- Modify: `ui/src/components/album/AlbumTitle.test.tsx`
- Modify: `ui/src/Pages/AlbumPage/AlbumPage.tsx`
- Modify: `ui/src/index.css`

**Interfaces:**
- Consumes: `useMobileAlbumContextBarHandedness()` from Task 1.
- Produces: one `data-testid="album-context-bar"` row with `data-handedness`, and `mobile-album-context-bar-clearance` for album-page bottom padding.

- [ ] **Step 1: Write failing row tests**

Assert default DOM order is breadcrumb/title, back, options; persisted left order is options, back, breadcrumb/title; there is only one back link and one options button; parent/root targets remain unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/components/album/AlbumTitle.test.tsx`

Expected: FAIL because the existing row still includes a separate floating mobile link and has no handedness contract.

- [ ] **Step 3: Implement the single responsive row**

Replace `MobileBackNavigation` with a styled context bar fixed above the 5rem global menu on mobile and static on desktop. Render content/back/options in handed order on mobile, restore conventional back/content/options visual order at `lg`, use 48px targets, safe-area offset, constrained horizontal breadcrumb scrolling, and no duplicated controls.

- [ ] **Step 4: Reserve bottom content space**

Wrap the album gallery and pagination in `mobile-album-context-bar-clearance`; set mobile bottom padding to cover the context bar in addition to the existing global-menu clearance and reset it at `1024px`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 2 command and require every `AlbumTitle` test to pass.

### Task 3: Left/right setting in album options

**Files:**
- Create: `ui/src/components/album/MobileAlbumContextBarPreference.tsx`
- Create: `ui/src/components/album/MobileAlbumContextBarPreference.test.tsx`
- Modify: `ui/src/components/sidebar/AlbumSidebar.tsx`

**Interfaces:**
- Consumes: `useMobileAlbumContextBarHandedness()` from Task 1.
- Produces: a labelled two-option control with `aria-pressed` states for `Left hand` and `Right hand`.

- [ ] **Step 1: Write failing setting tests**

Render the real preference control, verify Right hand starts pressed, click Left hand, and assert pressed states plus persisted literal `left`.

- [ ] **Step 2: Run setting tests and verify RED**

Run: `npm test -- --run src/components/album/MobileAlbumContextBarPreference.test.tsx`

Expected: FAIL because the setting component does not exist.

- [ ] **Step 3: Implement and mount the setting**

Add a compact `One-handed album bar` section to `AlbumSidebar` below its header. Use two real buttons, translated fallback labels, and the shared hook writer.

- [ ] **Step 4: Run setting tests and verify GREEN**

Run the Task 3 command and require all setting tests to pass.

### Task 4: Integrated verification and release boundary

**Files:**
- Modify: `CUSTOMIZATION.md`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: documented mobile-navigation behavior and a verified source commit suitable for a candidate image.

- [ ] **Step 1: Update customization documentation**

Replace the separate bottom floating control description with the fixed complete context bar and its persistent left/right-hand option.

- [ ] **Step 2: Run focused and complete verification**

Run the three focused test files, `npm test -- --run`, `npm run lint`, `npm run format:check`, `npm run build -- --base=/`, and `git diff --check`.

- [ ] **Step 3: Perform browser QA**

At 390x844 and 320x568, verify the bar rectangle is fully visible above the global menu, no equivalent row remains at the page top, both preference choices mirror the controls, long breadcrumb content stays within viewport, back navigates to the parent, and options opens the sidebar.

- [ ] **Step 4: Commit the verified feature**

Commit only the source, tests, and documentation on `feature/mobile-album-context-bar`; then merge it into `main` with `git merge --no-ff` after candidate acceptance.
