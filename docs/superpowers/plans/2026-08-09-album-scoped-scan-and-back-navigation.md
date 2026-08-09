# Album-scoped Scan and Back Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add administrator-controlled current/recursive album scans, optional forced thumbnail URL rotation, automatic album refresh, and a touch-friendly back-to-parent button, then deploy the verified image to the existing PhotoView production app.

**Architecture:** Extend scanner task contexts with immutable scan options, refactor filesystem discovery so it can start at an existing album, and expose the scoped operation through one admin-only GraphQL mutation. Reuse the existing queue and notification subscription, with strongest-request queue semantics and a browser event that lets the initiating album refetch on scanner completion. Forced refresh replaces derived thumbnails under new unique media names so PhotoView's one-year immutable HTTP cache cannot serve stale bytes.

**Tech Stack:** Go 1.26, GORM, gqlgen/GraphQL, React 18, TypeScript, Apollo Client, Headless UI, Vitest/Testing Library, Docker Buildx, TrueNAS Apps, PostgreSQL 18.

## Global Constraints

- Normal scans discover new media and child directories and fill missing cache files without re-encoding healthy thumbnails.
- forceRefresh defaults to false and is never persisted in browser storage.
- Forced refresh covers photo and video thumbnail files only; it never transcodes video streams and never modifies source media.
- Recursive discovery is limited to the selected album's filesystem subtree and must not call user-wide album cleanup.
- Existing .photoviewignore, hidden-directory, supported-media, and directory-symlink behavior must be preserved.
- The scan mutation and UI control are administrator-only.
- The back button follows album hierarchy: immediate parent when present, /albums for a user-visible root.
- Production remains photoview-gallery-next on port 20802; PostgreSQL, cache, read-only media mounts, resource limits, and NPM configuration remain unchanged.
- Preserve photoview-master-swipe:deb1b21-5b36acb-r6 as the immediate image rollback point.

---

### Task 1: Scanner options and strongest-request queue semantics

**Files:**
- Modify: api/scanner/scanner_task/scanner_task.go
- Create: api/scanner/scanner_task/scanner_task_test.go
- Modify: api/scanner/scanner_queue/queue.go
- Modify: api/scanner/scanner_queue/queue_test.go

**Interfaces:**
- Produces: scanner_task.ScanOptions{ForceRefresh bool}
- Produces: scanner_task.NewTaskContextWithOptions(parent, db, album, cache, options) TaskContext
- Produces: TaskContext.GetScanOptions() ScanOptions and TaskContext.WithScanOptions(options) TaskContext
- Consumed by: queue construction and photo/video processing tasks

- [ ] **Step 1: Write failing task-context and queue tests**

~~~go
func TestTaskContextScanOptions(t *testing.T) {
	ctx := NewTaskContext(context.Background(), nil, makeAlbum(1), scanner_cache.MakeAlbumCache())
	assert.False(t, ctx.GetScanOptions().ForceRefresh)

	forced := NewTaskContextWithOptions(
		context.Background(), nil, makeAlbum(1), scanner_cache.MakeAlbumCache(),
		ScanOptions{ForceRefresh: true},
	)
	assert.True(t, forced.GetScanOptions().ForceRefresh)
}

func TestScannerQueueUpgradesQueuedJobToForce(t *testing.T) {
	queue := makeTestQueue()
	normal := makeScannerJob(20, false)
	forced := makeScannerJob(20, true)
	require.NoError(t, queue.addJob(&normal))
	require.NoError(t, queue.addJob(&forced))
	require.Len(t, queue.up_next, 1)
	assert.True(t, queue.up_next[0].ctx.GetScanOptions().ForceRefresh)
}
~~~

Also assert that a running normal job accepts exactly one forced follow-up, a running forced job rejects duplicates, and a normal request never duplicates or downgrades a forced job.

- [ ] **Step 2: Run the focused tests and confirm the intended failure**

From api/:

~~~bash
go test ./scanner/scanner_task ./scanner/scanner_queue -run 'TestTaskContextScanOptions|TestScannerQueue' -v
~~~

Expected: compilation fails because the new option API and force-aware test helper do not exist.

- [ ] **Step 3: Add scan options while retaining the old constructor**

~~~go
type ScanOptions struct {
	ForceRefresh bool
}

const taskCtxKeyScanOptions taskCtxKeyType = "task_scan_options"

func NewTaskContext(parent context.Context, db *gorm.DB, album *models.Album,
	cache *scanner_cache.AlbumScannerCache) TaskContext {
	return NewTaskContextWithOptions(parent, db, album, cache, ScanOptions{})
}

func NewTaskContextWithOptions(parent context.Context, db *gorm.DB, album *models.Album,
	cache *scanner_cache.AlbumScannerCache, options ScanOptions) TaskContext {
	ctx := TaskContext{Context: parent}
	ctx = ctx.WithValue(taskCtxKeyAlbum, album)
	ctx = ctx.WithValue(taskCtxKeyAlbumCache, cache)
	ctx = ctx.WithValue(taskCtxKeyScanOptions, options)
	return ctx.WithDB(db)
}

func (c TaskContext) GetScanOptions() ScanOptions {
	options, ok := c.Value(taskCtxKeyScanOptions).(ScanOptions)
	if !ok {
		return ScanOptions{}
	}
	return options
}

func (c TaskContext) WithScanOptions(options ScanOptions) TaskContext {
	return c.WithValue(taskCtxKeyScanOptions, options)
}
~~~

- [ ] **Step 4: Implement strongest-request behavior inside the locked queue**

Search queued jobs first. Upgrade a matching queued normal context when the incoming request is forced. Then search running jobs: return for a normal request or an already-forced job; otherwise append one forced follow-up.

~~~go
func (queue *ScannerQueue) addJob(job *ScannerJob) error {
	albumID := job.ctx.GetAlbum().ID
	requestedForce := job.ctx.GetScanOptions().ForceRefresh

	for i := range queue.up_next {
		if queue.up_next[i].ctx.GetAlbum().ID != albumID {
			continue
		}
		if requestedForce && !queue.up_next[i].ctx.GetScanOptions().ForceRefresh {
			queue.up_next[i].ctx = queue.up_next[i].ctx.WithScanOptions(
				scanner_task.ScanOptions{ForceRefresh: true},
			)
		}
		return nil
	}

	for i := range queue.in_progress {
		if queue.in_progress[i].ctx.GetAlbum().ID != albumID {
			continue
		}
		if !requestedForce || queue.in_progress[i].ctx.GetScanOptions().ForceRefresh {
			return nil
		}
		break
	}

	queue.up_next = append(queue.up_next, *job)
	queue.notify()
	return nil
}
~~~

Remove jobOnQueue only if no remaining caller uses it.

- [ ] **Step 5: Format, test, and commit**

~~~bash
gofmt -w scanner/scanner_task/scanner_task.go scanner/scanner_task/scanner_task_test.go scanner/scanner_queue/queue.go scanner/scanner_queue/queue_test.go
go test ./scanner/scanner_task ./scanner/scanner_queue -v
git add api/scanner/scanner_task api/scanner/scanner_queue
git commit -m "Add force-aware scanner queue jobs"
~~~

---

### Task 2: Scoped album filesystem discovery

**Files:**
- Create: api/scanner/scanner_album_tree.go
- Create: api/scanner/scanner_album_tree_test.go
- Modify: api/scanner/scanner_user.go

**Interfaces:**
- Produces: scanner.FindAlbumsInSubtree(db, rootAlbum, recursive, albumCache) ([]*models.Album, []error)
- Produces internally: discoverAlbumTrees(db, seeds, recursive, albumCache)
- Consumed by: scanner_queue.AddAlbumToQueue

- [ ] **Step 1: Write filesystem-scope tests**

Build a temporary root/child/grandchild and a separate sibling tree. Copy one repository JPEG fixture into directories that should count as albums. Cover current-only exclusion, recursive child creation, sibling exclusion, and an inherited .photoviewignore rule.

~~~go
func TestFindAlbumsInSubtreeRecursiveStaysInsideRoot(t *testing.T) {
	fixture := newAlbumTreeFixture(t)
	albums, errs := scanner.FindAlbumsInSubtree(
		fixture.db, fixture.root, true, scanner_cache.MakeAlbumCache(),
	)
	assert.Empty(t, errs)
	assert.Equal(t, []string{fixture.root.Path, fixture.childPath}, albumPaths(albums))
	assert.NotContains(t, albumPaths(albums), fixture.sibling.Path)
}

func TestFindAlbumsInSubtreeCurrentOnly(t *testing.T) {
	fixture := newAlbumTreeFixture(t)
	albums, errs := scanner.FindAlbumsInSubtree(
		fixture.db, fixture.root, false, scanner_cache.MakeAlbumCache(),
	)
	assert.Empty(t, errs)
	assert.Equal(t, []string{fixture.root.Path}, albumPaths(albums))
}
~~~

- [ ] **Step 2: Run and observe the undefined function**

~~~bash
go test ./scanner -run '^TestFindAlbumsInSubtree' -v
~~~

- [ ] **Step 3: Extract a shared breadth-first traversal**

Use an existing album row as each seed and keep inherited ignore lines explicit.

~~~go
type albumDiscoverySeed struct {
	album           *models.Album
	inheritedIgnore []string
}

func FindAlbumsInSubtree(db *gorm.DB, root *models.Album, recursive bool,
	cache *scanner_cache.AlbumScannerCache) ([]*models.Album, []error) {
	inherited, err := inheritedAlbumIgnore(root.Path)
	if err != nil {
		return nil, []error{err}
	}
	return discoverAlbumTrees(db, []albumDiscoverySeed{{
		album: root, inheritedIgnore: inherited,
	}}, recursive, cache)
}
~~~

The shared loop must:

1. Read the current directory.
2. Append local .photoviewignore lines to a copied inherited slice.
3. Call cache.InsertAlbumIgnore for every returned album.
4. Return immediately after the seed when recursive is false.
5. Skip hidden directories.
6. Preserve utils.IsDirSymlink and directoryContainsPhotos behavior.
7. Query children by path hash; create missing children with ParentAlbumID and all parent owners.
8. Accumulate per-directory errors and continue.
9. Never call DeleteOldUserAlbums.

- [ ] **Step 4: Reuse the traversal from FindAlbumsForUser**

Build seeds from readable user root albums, call discoverAlbumTrees with recursive true, then keep cleanup only at the full-user boundary.

~~~go
userAlbums, scanErrors := discoverAlbumTrees(db, seeds, true, albumCache)
scanErrors = append(scanErrors, cleanup_tasks.DeleteOldUserAlbums(db, userAlbums, user)...)
return userAlbums, scanErrors
~~~

- [ ] **Step 5: Format, run scoped and full scanner tests, and commit**

~~~bash
gofmt -w scanner/scanner_album_tree.go scanner/scanner_album_tree_test.go scanner/scanner_user.go
go test ./scanner -run 'TestFindAlbumsInSubtree|TestFullScan' -v
git add api/scanner/scanner_album_tree.go api/scanner/scanner_album_tree_test.go api/scanner/scanner_user.go
git commit -m "Add scoped album tree discovery"
~~~

---

### Task 3: Album scan GraphQL mutation and queue entry point

**Files:**
- Modify: api/graphql/resolvers/scanner.graphql
- Modify: api/graphql/resolvers/scanner.go
- Modify: api/graphql/generated.go
- Modify: api/scanner/scanner_queue/queue.go
- Modify: api/scanner/scanner_queue/queue_test.go
- Create: api/graphql/resolvers/scanner_test.go

**Interfaces:**
- Produces: scanner_queue.AddAlbumToQueue(album, recursive, forceRefresh) (int, error)
- Produces GraphQL: scanAlbum(albumId: ID!, recursive: Boolean!, forceRefresh: Boolean!): ScannerResult! @isAdmin
- Consumes: FindAlbumsInSubtree and ScanOptions

- [ ] **Step 1: Write failing queue-entry and resolver validation tests**

~~~go
func TestScanAlbumRejectsUnknownAlbum(t *testing.T) {
	resolver := NewRootResolver(test_utils.DatabaseTest(t))
	_, err := resolver.Mutation().ScanAlbum(context.Background(), 9999, false, false)
	assert.ErrorContains(t, err, "get album from database")
}
~~~

In queue tests, initialize an inert queue with a DB, call AddAlbumToQueue against a two-album fixture, and assert count 2 plus ForceRefresh true on both queued contexts.

- [ ] **Step 2: Run tests and confirm the API is missing**

~~~bash
go test ./scanner/scanner_queue ./graphql/resolvers -run 'TestAddAlbumToQueue|TestScanAlbum' -v
~~~

- [ ] **Step 3: Add the queue entry point**

~~~go
func AddAlbumToQueue(album *models.Album, recursive bool, forceRefresh bool) (int, error) {
	cache := scanner_cache.MakeAlbumCache()
	albums, scanErrors := scanner.FindAlbumsInSubtree(
		global_scanner_queue.db, album, recursive, cache,
	)
	if len(scanErrors) != 0 {
		return 0, errors.Wrap(scanErrors[0], "discover selected album subtree")
	}

	options := scanner_task.ScanOptions{ForceRefresh: forceRefresh}
	global_scanner_queue.mutex.Lock()
	defer global_scanner_queue.mutex.Unlock()

	for _, selected := range albums {
		job := NewScannerJob(scanner_task.NewTaskContextWithOptions(
			context.Background(), global_scanner_queue.db, selected, cache, options,
		))
		if err := global_scanner_queue.addJob(&job); err != nil {
			return 0, err
		}
	}
	return len(albums), nil
}
~~~

- [ ] **Step 4: Add the admin mutation and regenerate gqlgen**

~~~graphql
"Scan one album, optionally including child albums and rebuilding thumbnails"
scanAlbum(
  albumId: ID!
  recursive: Boolean!
  forceRefresh: Boolean!
): ScannerResult! @isAdmin
~~~

~~~go
func (r *mutationResolver) ScanAlbum(ctx context.Context, albumID int,
	recursive bool, forceRefresh bool) (*models.ScannerResult, error) {
	var album models.Album
	if err := r.DB(ctx).First(&album, albumID).Error; err != nil {
		return nil, fmt.Errorf("get album from database: %w", err)
	}
	queued, err := scanner_queue.AddAlbumToQueue(&album, recursive, forceRefresh)
	if err != nil {
		return nil, err
	}
	message := fmt.Sprintf("Queued %d album(s) for scanning", queued)
	return &models.ScannerResult{Finished: false, Success: true, Message: &message}, nil
}
~~~

~~~bash
go generate ./graphql/resolvers
~~~

- [ ] **Step 5: Test, compile, and commit**

~~~bash
gofmt -w scanner/scanner_queue/queue.go scanner/scanner_queue/queue_test.go graphql/resolvers/scanner.go graphql/resolvers/scanner_test.go
go test ./scanner/scanner_queue ./graphql/resolvers ./graphql/models/actions -v
go test ./scanner/... ./graphql/... -run '^$'
git add api/graphql api/scanner/scanner_queue
git commit -m "Expose album-scoped scanner mutation"
~~~

---

### Task 4: Safe forced thumbnail URL rotation

**Files:**
- Modify: api/scanner/scanner_tasks/processing_tasks/processing_functions.go
- Modify: api/scanner/scanner_tasks/processing_tasks/process_photo_task.go
- Modify: api/scanner/scanner_tasks/processing_tasks/process_video_task.go
- Create: api/scanner/scanner_tasks/processing_tasks/processing_functions_test.go
- Create: api/scanner/scanner_tasks/processing_tasks/process_photo_task_test.go

**Interfaces:**
- Produces: replaceCachedThumbnail(db, mediaURL, cacheDir, newName, encode) (*models.MediaURL, error)
- Consumes: TaskContext.GetScanOptions().ForceRefresh
- Produces a new MediaName while preserving the existing MediaURL row ID

- [ ] **Step 1: Write replacement safety tests**

Assert success rotates name and deletes the old file. Encoder failure and DB failure must leave the old row/file intact and remove any partial new file. Also prove a normal scan keeps an existing healthy name.

~~~go
func TestReplaceCachedThumbnailRotatesNameAfterEncode(t *testing.T) {
	fixture := newThumbnailReplacementFixture(t)
	updated, err := replaceCachedThumbnail(
		fixture.db, fixture.url, fixture.cacheDir, "thumbnail_new.jpg",
		func(output string) (media_encoding.Dimension, error) {
			require.NoError(t, os.WriteFile(output, fixture.jpeg, 0o644))
			return media_encoding.Dimension{Width: 40, Height: 60}, nil
		},
	)
	require.NoError(t, err)
	assert.Equal(t, fixture.url.ID, updated.ID)
	assert.Equal(t, "thumbnail_new.jpg", updated.MediaName)
	assert.NoFileExists(t, fixture.oldPath)
	assert.FileExists(t, path.Join(fixture.cacheDir, "thumbnail_new.jpg"))
}
~~~

- [ ] **Step 2: Run focused tests and verify failure**

~~~bash
go test ./scanner/scanner_tasks/processing_tasks -run 'TestReplaceCachedThumbnail|TestProcessPhotoForceRefresh' -v
~~~

- [ ] **Step 3: Implement encode-validate-switch-delete ordering**

~~~go
type thumbnailEncoder func(outputPath string) (media_encoding.Dimension, error)

func replaceCachedThumbnail(tx *gorm.DB, mediaURL *models.MediaURL, cacheDir string,
	newName string, encode thumbnailEncoder) (*models.MediaURL, error) {
	oldPath := path.Join(cacheDir, mediaURL.MediaName)
	newPath := path.Join(cacheDir, newName)

	dimensions, err := encode(newPath)
	if err != nil {
		_ = os.Remove(newPath)
		return nil, err
	}
	stats, err := os.Stat(newPath)
	if err != nil {
		_ = os.Remove(newPath)
		return nil, errors.Wrap(err, "stat replacement thumbnail")
	}
	if stats.Size() == 0 {
		_ = os.Remove(newPath)
		return nil, errors.New("replacement thumbnail is empty")
	}

	replacement := *mediaURL
	replacement.MediaName = newName
	replacement.Width = dimensions.Width
	replacement.Height = dimensions.Height
	replacement.FileSize = stats.Size()
	if err := tx.Save(&replacement).Error; err != nil {
		_ = os.Remove(newPath)
		return nil, errors.Wrap(err, "save replacement thumbnail url")
	}
	if err := os.Remove(oldPath); err != nil && !os.IsNotExist(err) {
		log.Warn(nil, "Could not remove superseded thumbnail", "path", oldPath, "error", err)
	}
	return &replacement, nil
}
~~~

- [ ] **Step 4: Add force branches for existing photo/video thumbnails**

For a photo, generate a new unique thumbnail name and use EncodeThumbnail. For a video, use the same helper with EncodeVideoThumbnail. Keep missing-file repair as else-if, append the replacement to updatedURLs, and never rotate VideoWeb or originals. A disabled FFmpeg error must leave the existing video thumbnail intact.

- [ ] **Step 5: Test and commit**

~~~bash
gofmt -w scanner/scanner_tasks/processing_tasks/processing_functions.go scanner/scanner_tasks/processing_tasks/processing_functions_test.go scanner/scanner_tasks/processing_tasks/process_photo_task.go scanner/scanner_tasks/processing_tasks/process_photo_task_test.go scanner/scanner_tasks/processing_tasks/process_video_task.go
go test ./scanner/scanner_tasks/processing_tasks -v
go test ./scanner -run '^TestFullScan$' -v
git add api/scanner/scanner_tasks/processing_tasks
git commit -m "Rotate thumbnail URLs on forced scans"
~~~

---

### Task 5: Hierarchical back button

**Files:**
- Modify: ui/src/components/album/AlbumTitle.tsx
- Modify: ui/src/components/album/AlbumTitle.test.tsx
- Modify: ui/src/components/album/__generated__/albumPathQuery.ts
- Modify: ui/src/extractedTranslations/en/translation.json
- Modify: ui/src/extractedTranslations/zh-CN/translation.json

**Interfaces:**
- Consumes albumPathQuery.album.path, whose first element is the immediate parent
- Produces a 44px hierarchy link to /album/{parent.id} or /albums

- [ ] **Step 1: Write nested/root link tests**

~~~tsx
expect(await screen.findByRole('link', { name: 'Back to parent album' }))
  .toHaveAttribute('href', '/album/2')

expect(await screen.findByRole('link', { name: 'Back to albums' }))
  .toHaveAttribute('href', '/albums')
~~~

Mock authToken as authenticated and supply paths [parent, root] and [] through MockedProvider.

- [ ] **Step 2: Run and observe missing-link failure**

~~~bash
npm test -- --run src/components/album/AlbumTitle.test.tsx
~~~

- [ ] **Step 3: Render the hierarchy link**

Compute parent from path[0] before reversing a copy for breadcrumbs. Reserve the 44px location with a non-clickable placeholder while the path query loads.

~~~tsx
const parent = path[0]
const backTarget = parent ? '/album/' + parent.id : '/albums'
const backLabel = parent
  ? t('album_navigation.back_to_parent', 'Back to parent album')
  : t('album_navigation.back_to_albums', 'Back to albums')
~~~

Render a Link with h-11 w-11 shrink-0 and an inline left-chevron SVG. Keep the text container min-w-0 flex-1 and the gear shrink-0 so narrow phones cannot overlap controls.

- [ ] **Step 4: Add English and Simplified Chinese labels and regenerate types**

English: Back to albums, Back to parent album.
Chinese: 返回相册首页, 返回上一级相册.

~~~bash
npm run genSchemaTypes
npm test -- --run src/components/album/AlbumTitle.test.tsx
npx eslint src/components/album/AlbumTitle.tsx src/components/album/AlbumTitle.test.tsx --max-warnings 0
npx prettier --check src/components/album/AlbumTitle.tsx src/components/album/AlbumTitle.test.tsx
~~~

- [ ] **Step 5: Commit**

~~~bash
git add ui/src/components/album ui/src/extractedTranslations/en/translation.json ui/src/extractedTranslations/zh-CN/translation.json
git commit -m "Add album parent navigation button"
~~~

---

### Task 6: Administrator scan menu and completion refetch

**Files:**
- Create: ui/src/components/album/AlbumScanControl.tsx
- Create: ui/src/components/album/AlbumScanControl.test.tsx
- Create: ui/src/components/album/scannerEvents.ts
- Modify: ui/src/components/album/AlbumFilter.tsx
- Modify: ui/src/components/albumGallery/AlbumGallery.tsx
- Modify: ui/src/Pages/AlbumPage/AlbumPage.tsx
- Modify: ui/src/components/messages/SubscriptionsHook.ts
- Create: ui/src/components/messages/SubscriptionsHook.test.ts
- Modify: ui/src/extractedTranslations/en/translation.json
- Modify: ui/src/extractedTranslations/zh-CN/translation.json
- Create: ui/src/components/album/__generated__/scanAlbumMutation.ts

**Interfaces:**
- Produces: AlbumScanControl({albumId, onScanComplete})
- Produces: SCANNER_COMPLETE_EVENT = photoview:scanner-complete
- Consumes: scanAlbum mutation, useIsAdmin, Modal, Checkbox, Headless UI Popover
- Produces local aria-live state visible on phones

- [ ] **Step 1: Write failing UI and subscription tests**

Cover non-admin hiding; default variables recursive=false/forceRefresh=false; recursive variables; recursive+force confirmation; mutation error; completion callback; and dispatch only for a positive global-scanner-progress notification.

~~~tsx
await user.click(screen.getByRole('button', { name: 'Scan and cache' }))
await user.click(screen.getByRole('button', { name: 'Start scan' }))
expect(await screen.findByText('Queued 1 album(s) for scanning')).toBeVisible()
~~~

- [ ] **Step 2: Run tests and verify missing modules**

~~~bash
npm test -- --run src/components/album/AlbumScanControl.test.tsx src/components/messages/SubscriptionsHook.test.ts
~~~

- [ ] **Step 3: Implement the admin-only popover and mutation**

~~~graphql
mutation scanAlbumMutation(
  $albumId: ID!
  $recursive: Boolean!
  $forceRefresh: Boolean!
) {
  scanAlbum(albumId: $albumId, recursive: $recursive, forceRefresh: $forceRefresh) {
    success
    message
  }
}
~~~

The popover contains two radio scopes, one Checkbox for force refresh, and Start scan. Force and recursive default false every time the menu opens. Recursive+force opens Modal before mutation. The action is disabled while loading. Render queue/error/completion text with role=status and aria-live=polite beside the control.

- [ ] **Step 4: Dispatch and consume scanner completion**

~~~ts
export const SCANNER_COMPLETE_EVENT = 'photoview:scanner-complete'
~~~

In SubscriptionsHook:

~~~ts
if (msg.key === 'global-scanner-progress' && msg.positive) {
  window.dispatchEvent(new Event(SCANNER_COMPLETE_EVENT))
}
~~~

AlbumScanControl listens only after its mutation succeeds. On the first completion event it awaits onScanComplete(), displays the translated completion message, and removes pending state.

- [ ] **Step 5: Pass album ID and refetch through the component tree**

Add albumId and onAlbumScanComplete to AlbumFilter; add onAlbumScanComplete to AlbumGallery; pass onAlbumScanComplete={() => refetch()} from AlbumPage. Render AlbumScanControl only when both values exist; the control itself checks useIsAdmin.

- [ ] **Step 6: Add translations and generate TypeScript GraphQL types**

Add English strings for Scan and cache, Current album only, Current album and all child albums, Force rebuild existing thumbnails, Start scan, Continue, warning, complete, and error. Add Simplified Chinese equivalents including 扫描与补缓存, 仅当前相册, 当前相册及所有子相册, 强制重建已有缩略图.

~~~bash
npm run genSchemaTypes
~~~

- [ ] **Step 7: Run focused and full UI verification**

~~~bash
npm test -- --run src/components/album/AlbumScanControl.test.tsx src/components/album/AlbumTitle.test.tsx src/components/albumGallery/AlbumGallery.test.tsx src/Pages/AlbumPage/AlbumPage.test.tsx src/components/messages/SubscriptionsHook.test.ts
npm test -- --run
npm run build
npx eslint src/components/album/AlbumScanControl.tsx src/components/album/AlbumScanControl.test.tsx src/components/album/scannerEvents.ts src/components/album/AlbumFilter.tsx src/components/albumGallery/AlbumGallery.tsx src/Pages/AlbumPage/AlbumPage.tsx src/components/messages/SubscriptionsHook.ts --max-warnings 0
npm run format:check
~~~

- [ ] **Step 8: Commit**

~~~bash
git add ui
git commit -m "Add album scan and cache controls"
~~~

---

### Task 7: Full verification and reproducible candidate image

**Files:**
- Create: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-master-swipe-preview/patches/0014-*.patch and following feature patches
- Modify: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-master-swipe-preview/Dockerfile
- Modify: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-master-swipe-preview/compose.album-lanes.yaml
- Modify: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-master-swipe-preview/README.md

**Interfaces:**
- Produces a patch chain from official deb1b216e047a30803dc0f48a9fc3d4c4abda594 through feature HEAD
- Produces local image photoview-album-scan-preview:deb1b21-$photoview_feature_short, where the task-specific variable is set with git rev-parse

- [ ] **Step 1: Regenerate and run all source checks**

~~~bash
cd api
go generate ./graphql/resolvers
find graphql scanner -name '*.go' -print0 | xargs -0 gofmt -l
go test ./scanner/... ./graphql/... -v
cd ../ui
npm run genSchemaTypes
npm test -- --run
npm run build
npm run format:check
~~~

Run git diff --check and commit generated-only changes if the worktree is not clean.

- [ ] **Step 2: Create deployment branch without touching user files**

From /Users/ideepblue/Workspaces/truenas-ideepblue:

~~~bash
git switch -c codex/photoview-album-scan-production
~~~

Preserve .playwright-mcp/ and the existing screenshot files.

- [ ] **Step 3: Export ordered patches**

~~~bash
git -C /Users/ideepblue/Workspaces/photoview-custom format-patch --no-signature \
  --start-number 14 \
  -o /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-master-swipe-preview/patches \
  5b36acb..codex/album-scoped-scan-controls
~~~

Set exact task-specific revisions before editing the Docker and Compose files:

~~~bash
photoview_feature_head=$(git -C /Users/ideepblue/Workspaces/photoview-custom rev-parse codex/album-scoped-scan-controls)
photoview_feature_short=$(git -C /Users/ideepblue/Workspaces/photoview-custom rev-parse --short=7 codex/album-scoped-scan-controls)
~~~

Set PHOTOVIEW_PATCHSET to $photoview_feature_head and the preview tag to photoview-album-scan-preview:deb1b21-$photoview_feature_short. Keep port 20823 and the external SQLite/cache volumes.

- [ ] **Step 4: Verify replay and build local preview**

Apply every patch in order to a temporary checkout at the fixed official commit, compare its Git tree with feature HEAD, then:

~~~bash
docker compose -f photoview-master-swipe-preview/compose.album-lanes.yaml build
docker compose -f photoview-master-swipe-preview/compose.album-lanes.yaml up -d
~~~

Verify health, HTTP 200, schema scanAlbum presence, and clean logs.

- [ ] **Step 5: Browser-test at 390x844 and 1280x900**

Verify nested and root back targets; 44px hit area; no overlap with sort, breadcrumb, favorites, or gear; admin-only scan visibility; current-only normal completion/refetch; forced current-only thumbnail URL change; and no sibling URL change.

- [ ] **Step 6: Commit reproducible build inputs**

~~~bash
git add photoview-master-swipe-preview
git commit -m "Build PhotoView album scan controls"
~~~

---

### Task 8: Protected production deployment

**Files:**
- Modify: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-gallery/postgres-next/docker-compose.yml
- Modify: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-gallery/README.md
- Modify: /Users/ideepblue/Workspaces/truenas-ideepblue/photoview-gallery/postgres-next/README.md

**Interfaces:**
- Produces image photoview-master-swipe:deb1b21-$photoview_feature_short-r7
- Rollback image: photoview-master-swipe:deb1b21-5b36acb-r6

- [ ] **Step 1: Recheck live production**

Confirm app RUNNING; PhotoView/PostgreSQL healthy; restart counts 0; current r6 image; empty scanner queue; no current OOM/error storm; DB album/media/media URL/thumbnail counts; and HTTP 200 on direct 20802 and formal HTTPS. Stop and diagnose if the baseline materially differs.

- [ ] **Step 2: Create protection points**

Set photoview_rollout_stamp=$(date +%Y%m%d-%H%M%S), create /mnt/intermedia/app-config-backups/photoview-album-scan-$photoview_rollout_stamp, copy live Compose, create a compressed PostgreSQL logical dump and SHA-256, and create hot-data/docker@pre-photoview-album-scan-$photoview_rollout_stamp. Never print postgres.env contents.

- [ ] **Step 3: Build, transfer, and load amd64 r7**

~~~bash
docker buildx build --platform linux/amd64 --load \
  --tag photoview-master-swipe:deb1b21-$photoview_feature_short-r7 \
  photoview-master-swipe-preview
docker save -o /tmp/photoview-album-scan-r7.tar \
  photoview-master-swipe:deb1b21-$photoview_feature_short-r7
scp /tmp/photoview-album-scan-r7.tar root@truenas-local:/tmp/photoview-album-scan-r7.tar
ssh root@truenas-local docker load -i /tmp/photoview-album-scan-r7.tar
~~~

Record local manifest and TrueNAS image IDs. Delete only the transferred temporary tar after a successful load.

- [ ] **Step 4: Change only the image and redeploy through Apps**

Patch the repo and live Compose image, run docker compose config, and verify the exact diff changes only services.photoview.image.

~~~bash
ssh truenas-local midclt call -j app.redeploy photoview-gallery-next
~~~

Do not run direct docker compose up.

- [ ] **Step 5: Verify production**

Confirm RUNNING, both containers healthy, restart count 0, r7 image/label, unchanged mounts/resources/port, unchanged immediate DB counts, direct/formal HTTP 200 and TLS success, new asset hashes, and no panic/migration/permission/OOM logs.

- [ ] **Step 6: Run one bounded production functional check**

Using the existing authenticated browser session, verify parent/root navigation and run current-only normal scan on one small album through completion/refetch. Do not trigger recursive forced refresh as the deployment smoke test.

- [ ] **Step 7: Document and integrate**

Append dated r7 sections to both runbooks with source commit, image IDs, test totals, backup/snapshot paths, pre/post counts, health, URLs, functional check, and the r6 rollback command path.

~~~bash
git add photoview-gallery photoview-master-swipe-preview
git commit -m "Deploy PhotoView album scan controls"
git switch main
git merge --no-ff codex/photoview-album-scan-production -m "Merge PhotoView album scan controls"
~~~

Do not push main without explicit authorization.

- [ ] **Step 8: Final post-merge recheck**

Rerun app state, health/restarts, image label, DB counts, logs, direct/formal HTTPS, and scanner queue checks. Report production URL and rollback image first.
