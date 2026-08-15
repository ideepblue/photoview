# Fullscreen Navigation and Mobile Parent Controls

## Goal

Make long photo-browsing sessions easier on a phone without permanently
covering the image. The fullscreen viewer shows the active position as
`23 / 186` and the media filename. Each line can be disabled independently
from a quick control inside the viewer. Album pages also gain a thumb-reachable
parent action near the bottom of the screen.

## Fullscreen viewer

The position and filename sit at the top center. They use white text with a
shadow instead of an opaque panel, truncate long filenames, and do not accept
pointer events. Both are enabled by default. Their values come from the current
media index, media count, and the existing GraphQL media `title` field.

A settings button appears at the lower right with the existing viewer controls
after a light tap. It opens a compact two-checkbox popover for position and
filename. Preferences are stored in browser `localStorage`; malformed or
unavailable storage falls back to both options enabled. The popover remains
visible while it is open. Closing it resumes the existing two-second control
timeout.

On narrow screens, the existing exit action moves from the top left to the
lower left and retains the current show-on-tap behavior. Desktop placement and
keyboard behavior remain unchanged. Exiting returns to the current gallery and
does not change its selected media.

## Parent-album action

The existing header back button remains unchanged. When an authenticated album
page has resolved its path, a second circular mobile-only link appears centered
above the fixed main menu. It uses the same resolved target as the header link:
the immediate parent album, or `/albums` for a root album. The control is hidden
at desktop widths and while path data is loading.

## Verification

Component tests cover defaults, independent toggles, persisted preferences,
metadata updates, control timeout behavior, fullscreen exit, and parent link
targets. The focused tests run first, followed by the complete UI suite, lint
for changed UI files, formatting checks, and a production Vite build.
