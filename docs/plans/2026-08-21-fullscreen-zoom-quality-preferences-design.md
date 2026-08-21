# Fullscreen zoom controls and high-resolution preference

## Goal

Replace the unreliable fullscreen long-press interaction with a zoom-only
vertical control and let each browser decide whether fullscreen photos should
load their high-resolution resource. Keep the viewer unobstructed, preserve
the existing double-tap exit and single-finger pan, and never re-enable image
navigation while zoomed.

## Confirmed interaction

- Double-tap enters zoom at 2.5x and double-tap exits.
- While zoomed, a right-side vertical rail offers 1.5x, 2.5x, and 4x.
  Tapping the rail cycles those presets; dragging within it sets a continuous
  1.5x--4x value in 0.1x increments.
- The current value appears only while the rail is being used. The rail follows
  the existing tap-to-show / two-second auto-hide convention and occupies the
  now-disabled right navigation area, not the bottom action rail.
- Pan works only outside the rail. Pointer, keyboard, and button navigation
  stay disabled until zoom exits.

## High-resolution preference and indicator

- Add `loadHighRes: true` to the existing local browser fullscreen preference.
- Add the independent switch to the fullscreen display settings. Toggling off
  cancels an active request and returns to the thumbnail; toggling on starts the
  request for the current photo immediately.
- The top-left 12px status indicator is always visible for photos:
  - High-resolution disabled: static slate pixel-grid icon.
  - Loading with Content-Length: blue determinate ring.
  - Loading without Content-Length: blue indeterminate ring.
  - Decoded and displayed: green circle.
  - Failed: amber crossed circle; tapping it retries once.
- A streamed `fetch` with credentials reads Content-Length and byte progress.
  The response is decoded from a Blob URL; cleanup aborts requests and revokes
  Blob URLs on image/preference changes and unmount.

## Verification

Tests cover preference defaults/persistence, preset cycle and rail drag,
pan-versus-rail arbitration, navigation lock, determinate and indeterminate
progress, cancellation, retry, and the no-high-resolution preference state.
Run the full UI suite, changed-file lint, production build, PWA verification,
then the normal isolated TrueNAS candidate and production health checks.
