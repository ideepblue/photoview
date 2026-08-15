# Mobile Album Context Bar Design

## Intent

On phone-sized layouts, the album context row must no longer occupy the top of
the album page. The existing back action, breadcrumb/current album title, and
album-options action become one fixed bar immediately above PhotoView's global
bottom navigation. It remains reachable while the user scrolls an album. The
desktop layout remains the existing top row.

The default phone arrangement is right-hand optimized: breadcrumb/title on the
left, then back, then album options at the right edge. A persistent setting in
the album-options sidebar switches to a mirrored left-hand arrangement: album
options, back, then breadcrumb/title. The two action buttons therefore stay
together in the active thumb zone. The preference is browser-local, defaults
to right hand, and falls back safely when storage is unavailable or malformed.

## Structure and behavior

`AlbumTitle` continues to own the single context row. Responsive styling makes
that same DOM row fixed on widths below the existing `lg` breakpoint and
returns it to normal document flow at `lg` and above, avoiding duplicated links
or buttons. The mobile bar includes safe-area offset, an opaque/blurred surface,
48-pixel action targets, and a horizontally constrained breadcrumb/title area.
Long paths may scroll horizontally while the current title remains truncated.
Album-page content receives enough bottom clearance for both fixed bars.

A small preference module owns the `left | right` value, local-storage key,
safe read/write functions, and a same-tab change event. Both the bar and the
sidebar setting consume one hook so switching hands updates the open page
immediately. No GraphQL schema, account setting, database row, media path, or
desktop navigation behavior changes.

## Verification

Tests cover default/right and persisted/left ordering, invalid-storage fallback,
immediate synchronization, the sidebar control, parent navigation targets, and
desktop-compatible structure. The complete UI suite, lint/format checks, and a
production build must pass. Browser QA at 390x844 and 320x568 verifies the top
row is absent, the fixed bar clears the global menu, both handed layouts mirror
correctly, breadcrumb scrolling does not overflow the viewport, and back/options
remain operable.
