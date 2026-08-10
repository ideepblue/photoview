# PhotoView Fork Agent Notes

This repository is the canonical modified source for ideepblue's PhotoView
fork. Read `CUSTOMIZATION.md` for the supported behavior and branch model, then
follow the upstream `CONTRIBUTING.md` conventions for the affected code.

## Git workflow

- `origin` is `ideepblue/photoview`; `upstream` is `photoview/photoview`.
- `main` is the long-lived customized integration branch.
- Local `master` tracks `upstream/master` and must remain free of custom commits.
- Start each change from `main` on `feature/<name>`.
- Verify the feature branch before merging it into `main` with
  `git merge --no-ff`.
- Import upstream changes through `feature/sync-upstream-YYYYMMDD`; do not
  rebase or force-push `main` or another shared branch.
- Retain the existing `codex/*` branches as historical feature boundaries.

## Change boundaries

- Make the smallest change that satisfies the requested behavior and keep
  upstream structure and style.
- Add or update focused tests for every behavior change, then run the broader
  affected suite and build before claiming success.
- UI behavior lives under `ui/`; scanner and GraphQL behavior lives under
  `api/`. Keep generated GraphQL files synchronized with their schemas and
  queries.
- Do not add private hostnames, LAN addresses, credentials, media paths,
  database/cache data, production Compose files, or deployment evidence here.
- A deployment patch stack is a reproducible release artifact, not a second
  source tree. Compare its resulting Git tree with the accepted source commit.

## Useful checks

```bash
cd ui
npm test -- --run
npm run build -- --base=/
```

Run focused Go tests for API changes and use `git diff --check` for every
change. This project is AGPL-3.0; preserve source-availability obligations when
shipping modified images or running the modified service for other users.
