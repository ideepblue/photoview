# Album List Return Context Design

## Goal

When a person opens a child album and returns to its containing album list,
PhotoView should restore the previous visual context without requiring a manual
search. The returned-to card must remain visibly identifiable as the last
opened album until another child album from the same containing list is opened.

## Scope and rules

- A parent list is either the root `/albums` list or one concrete
  `/album/:parentId` subalbum list.
- Each parent list has one independently remembered child album. Opening a
  child from that list replaces only that list's remembered child.
- The position record is additionally scoped by the current list route, its
  filter/sort query, and mobile layout. A changed ordering or filter therefore
  cannot restore a stale pixel position into a different presentation.
- The persistent visual marker is scoped only to the parent list, so it still
  identifies the last child when the person changes a compatible filter or
  ordering.
- Automatic restoration runs for explicit parent/back/breadcrumb navigation
  and browser back. Directly opening an album-list route intentionally starts
  at the top.

## Stored browser state

Use a versioned browser-local storage record. It contains no media data:

```ts
type AlbumListReturnRecord = {
  parentListKey: string // /albums or /album/:parentId
  presentationKey: string // parent key + relevant query + mobile layout
  albumId: string
  albumTitle: string
  scrollY: number
  cardViewportOffset: number
  updatedAt: number
}
```

`parentListKey` identifies the one persistent marker. `presentationKey`
isolates the scroll position. Saving both an album-card anchor and its
viewport offset makes restoration resilient to masonry-card height changes,
lazy-loaded covers, and responsive layout changes; raw `scrollY` is only the
fallback.

## Navigation and restoration flow

1. An `AlbumBox` click records the list context before navigation and attaches
   a lightweight return intent to the destination route.
2. Parent/back and breadcrumb links retain or create that return intent.
3. The destination list waits until the relevant card is rendered and its
   layout has settled. It first positions the card at its saved viewport
   offset, then uses `scrollY` only when the card is unavailable.
4. A user scroll or touch gesture before restoration finishes cancels the
   automatic movement. This prevents the page from fighting intentional input.
5. If the remembered card is filtered out, renamed, or removed, no forced
   anchor jump occurs; the saved scroll position is the graceful fallback.

## Visual and accessibility behavior

The remembered card gets a compact localized `Last opened` badge and a subtle
accent outline. They remain until another child from the same parent list is
opened. On an automatic return, the outline briefly pulses to make the
restored location obvious without a modal or a toast. In compact column
layouts the badge becomes an icon with a localized accessible name. A polite
live announcement identifies the restored album for screen-reader users.

The marker must coexist with the existing folder, view-count, and featured
badges: it uses the remaining lower-right cover corner and does not change the
card's clickable target.

## Implementation boundaries

- Add a focused return-context hook/store under `ui/src/components/albumGallery/`.
- Teach `AlbumBox`, `AlbumBoxes`, and `AlbumTitle` how to preserve return
  context across child, parent, breadcrumb, and root-list navigation.
- Keep the feature browser-local and user-private; no GraphQL schema,
  database migration, view-count mutation, or server-side tracking is needed.
- Add all visible labels and accessible names to English, Simplified Chinese,
  Traditional Chinese (Taiwan), and Traditional Chinese (Hong Kong), extending
  the existing customized-translation contract.

## Verification

- Unit tests for independent parent-list records, presentation-key isolation,
  malformed-storage recovery, and anchor/fallback selection.
- Component tests for saved context on card entry, restoration after list data
  renders, persistent marker transfer, filtered-out fallback, and cancellation
  on user scroll.
- Mobile tests for list and masonry layouts, including badge placement and
  narrow viewport overflow.
- Production Vite build, PWA verification, targeted lint/format checks, then
  the normal isolated TrueNAS candidate and release checks before deployment.
