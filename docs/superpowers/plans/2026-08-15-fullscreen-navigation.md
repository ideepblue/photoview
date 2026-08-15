# Fullscreen Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent fullscreen position and filename indicators with quick independent switches, a thumb-reachable mobile fullscreen exit, and a mobile parent-album action.

**Architecture:** Keep browser-only display preferences in a focused `presentViewPreferences` module and render all fullscreen overlays from `PresentNavigationOverlay`. Reuse `AlbumTitle`'s resolved parent target for a second mobile-only link so navigation semantics remain centralized.

**Tech Stack:** React 18, TypeScript, styled-components, Apollo GraphQL fragments, React Router 6, Vitest, Testing Library, Vite.

## Global Constraints

- Display position exactly as `23 / 186`, without surrounding words.
- Position and filename switches are independent, quick to reach, enabled by default, and persisted per browser.
- Fullscreen exit and quick settings remain hidden until the existing light-tap control reveal.
- The mobile exit must not permanently cover the photo; desktop placement stays unchanged.
- The parent-album action is mobile-only, bottom-reachable, and does not replace the existing header action yet.
- Do not deploy this source change to TrueNAS production as part of this plan.

---

### Task 1: Browser preference contract

**Files:**
- Create: `ui/src/components/photoGallery/presentView/presentViewPreferences.ts`
- Test: `ui/src/components/photoGallery/presentView/presentViewPreferences.test.ts`

**Interfaces:**
- Produces: `PresentViewPreferences`, `getPresentViewPreferences(storage?)`, and `setPresentViewPreferences(preferences, storage?)`.

- [ ] **Step 1: Write failing tests for defaults, valid persistence, malformed values, and unavailable storage**

```ts
expect(getPresentViewPreferences(storage)).toEqual({
  showPosition: true,
  showFilename: true,
})
setPresentViewPreferences(
  { showPosition: false, showFilename: true },
  storage
)
expect(getPresentViewPreferences(storage)).toEqual({
  showPosition: false,
  showFilename: true,
})
```

- [ ] **Step 2: Run `npm test -- --run src/components/photoGallery/presentView/presentViewPreferences.test.ts` and confirm failure because the module does not exist**
- [ ] **Step 3: Implement strict boolean parsing with safe `localStorage` access and default-on fallback**
- [ ] **Step 4: Rerun the focused test and confirm it passes**

### Task 2: Fullscreen metadata and quick switches

**Files:**
- Modify: `ui/src/components/photoGallery/MediaGallery.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentMedia.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentView.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentNavigationOverlay.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentView.test.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentNavigationOverlay.test.tsx`
- Regenerate: `ui/src/components/photoGallery/__generated__/MediaGalleryFields.ts`

**Interfaces:**
- Consumes: `getPresentViewPreferences` and `setPresentViewPreferences` from Task 1.
- Produces: overlay props `activeIndex: number`, `mediaCount: number`, and `filename: string`.

- [ ] **Step 1: Extend media fixtures with literal titles and write failing tests for `2 / 3`, the active filename, and independent toggle behavior**

```tsx
expect(screen.getByText('2 / 3')).toBeInTheDocument()
expect(screen.getByText('current.jpg')).toBeInTheDocument()
fireEvent.click(screen.getByRole('checkbox', { name: 'Show position' }))
expect(screen.queryByText('2 / 3')).not.toBeInTheDocument()
expect(screen.getByText('current.jpg')).toBeInTheDocument()
```

- [ ] **Step 2: Run the two focused viewer test files and confirm they fail because metadata/settings are absent**
- [ ] **Step 3: Add `title` to `MediaGalleryFields`, run `npm run genSchemaTypes`, and pass active metadata into the overlay**
- [ ] **Step 4: Render top-center non-interactive metadata plus a lower-right settings popover; persist each switch immediately**
- [ ] **Step 5: Keep the popover open without the auto-hide timer, then restore the timer when it closes**
- [ ] **Step 6: Rerun focused viewer and preference tests until green**

### Task 3: Thumb-reachable mobile navigation

**Files:**
- Modify: `ui/src/components/photoGallery/presentView/PresentNavigationOverlay.tsx`
- Modify: `ui/src/components/photoGallery/presentView/PresentNavigationOverlay.test.tsx`
- Modify: `ui/src/components/album/AlbumTitle.tsx`
- Modify: `ui/src/components/album/AlbumTitle.test.tsx`

**Interfaces:**
- Consumes: the existing `backTarget` derived from `album.path`.
- Produces: a mobile exit placement and `mobile-parent-navigation` link.

- [ ] **Step 1: Write failing tests that require the mobile exit marker and a second parent link using `/album/2` or `/albums`**
- [ ] **Step 2: Run the focused tests and confirm failure because the mobile affordances are absent**
- [ ] **Step 3: Move the existing exit button to the lower-left only under the mobile media query while retaining its hidden class behavior**
- [ ] **Step 4: Render a circular, fixed, mobile-only parent link centered above the bottom menu after path resolution**
- [ ] **Step 5: Rerun the focused navigation tests until green**

### Task 4: Documentation and full verification

**Files:**
- Modify: `CUSTOMIZATION.md`

**Interfaces:**
- Consumes: verified behavior from Tasks 1-3.
- Produces: an updated customization inventory and a buildable feature branch.

- [ ] **Step 1: Document fullscreen metadata, quick switches, and bottom-reachable navigation in `CUSTOMIZATION.md`**
- [ ] **Step 2: Run focused tests for all changed components**
- [ ] **Step 3: Run `npm test -- --run` and require zero failures**
- [ ] **Step 4: Run ESLint on every changed TypeScript/TSX file and fix all new errors**
- [ ] **Step 5: Run Prettier checks on changed source, test, and documentation files**
- [ ] **Step 6: Run `npm run build -- --base=/` and require exit code zero**
- [ ] **Step 7: Review `git diff`, `git diff --check`, and branch status before integration**
