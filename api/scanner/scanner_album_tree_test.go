package scanner_test

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner"
	"github.com/photoview/photoview/api/scanner/scanner_cache"
	"github.com/photoview/photoview/api/test_utils"
	"gorm.io/gorm"
)

type scopedAlbumFixture struct {
	db             *gorm.DB
	owner          *models.User
	root           *models.Album
	rootPath       string
	childPath      string
	grandchildPath string
	ignoredPath    string
	sibling        *models.Album
}

func copyAlbumTestPhoto(t *testing.T, destination string) {
	t.Helper()

	data, err := os.ReadFile("test_media/real_media/standalone_jpg.jpg")
	if err != nil {
		t.Fatalf("read photo fixture: %v", err)
	}
	if err := os.WriteFile(destination, data, 0o600); err != nil {
		t.Fatalf("write photo fixture: %v", err)
	}
}

func newScopedAlbumFixture(t *testing.T) scopedAlbumFixture {
	t.Helper()

	db := test_utils.DatabaseTest(t)
	owner := &models.User{Username: "scoped-scan-owner"}
	if err := db.Create(owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	libraryPath := t.TempDir()
	rootPath := filepath.Join(libraryPath, "selected")
	childPath := filepath.Join(rootPath, "child")
	grandchildPath := filepath.Join(childPath, "grandchild")
	ignoredPath := filepath.Join(rootPath, "ignored")
	siblingPath := filepath.Join(libraryPath, "sibling")

	for _, directory := range []string{rootPath, childPath, grandchildPath, ignoredPath, siblingPath} {
		if err := os.MkdirAll(directory, 0o700); err != nil {
			t.Fatalf("create test directory %s: %v", directory, err)
		}
		copyAlbumTestPhoto(t, filepath.Join(directory, "photo.jpg"))
	}
	if err := os.WriteFile(filepath.Join(rootPath, ".photoviewignore"), []byte("ignored/\n"), 0o600); err != nil {
		t.Fatalf("write ignore file: %v", err)
	}

	root := &models.Album{Title: "selected", Path: rootPath}
	sibling := &models.Album{Title: "sibling", Path: siblingPath}
	if err := db.Create(root).Error; err != nil {
		t.Fatalf("create selected album: %v", err)
	}
	if err := db.Create(sibling).Error; err != nil {
		t.Fatalf("create sibling album: %v", err)
	}
	if err := db.Model(owner).Association("Albums").Append(root, sibling); err != nil {
		t.Fatalf("assign album owner: %v", err)
	}

	return scopedAlbumFixture{
		db:             db,
		owner:          owner,
		root:           root,
		rootPath:       rootPath,
		childPath:      childPath,
		grandchildPath: grandchildPath,
		ignoredPath:    ignoredPath,
		sibling:        sibling,
	}
}

func sortedAlbumPaths(albums []*models.Album) []string {
	paths := make([]string, len(albums))
	for i, album := range albums {
		paths[i] = album.Path
	}
	slices.Sort(paths)
	return paths
}

func TestFindAlbumsInSubtreeCurrentOnly(t *testing.T) {
	fixture := newScopedAlbumFixture(t)

	albums, errs := scanner.FindAlbumsInSubtree(
		fixture.db, fixture.root, false, scanner_cache.MakeAlbumCache(),
	)
	if len(errs) != 0 {
		t.Fatalf("unexpected scan errors: %v", errs)
	}
	if got := sortedAlbumPaths(albums); !slices.Equal(got, []string{fixture.rootPath}) {
		t.Fatalf("unexpected current-only albums: %v", got)
	}

	var childCount int64
	if err := fixture.db.Model(&models.Album{}).Where("path_hash = ?", models.MD5Hash(fixture.childPath)).Count(&childCount).Error; err != nil {
		t.Fatalf("count child albums: %v", err)
	}
	if childCount != 0 {
		t.Fatalf("current-only scan created %d child albums", childCount)
	}
}

func TestFindAlbumsInSubtreeRecursiveStaysInsideRoot(t *testing.T) {
	fixture := newScopedAlbumFixture(t)

	albums, errs := scanner.FindAlbumsInSubtree(
		fixture.db, fixture.root, true, scanner_cache.MakeAlbumCache(),
	)
	if len(errs) != 0 {
		t.Fatalf("unexpected scan errors: %v", errs)
	}

	want := []string{fixture.childPath, fixture.grandchildPath, fixture.rootPath}
	slices.Sort(want)
	if got := sortedAlbumPaths(albums); !slices.Equal(got, want) {
		t.Fatalf("unexpected recursive albums: got %v, want %v", got, want)
	}

	var child models.Album
	if err := fixture.db.Where("path_hash = ?", models.MD5Hash(fixture.childPath)).First(&child).Error; err != nil {
		t.Fatalf("load created child: %v", err)
	}
	if child.ParentAlbumID == nil || *child.ParentAlbumID != fixture.root.ID {
		t.Fatalf("created child has incorrect parent: %v", child.ParentAlbumID)
	}
	if ownerCount := fixture.db.Model(&child).Association("Owners").Count(); ownerCount != 1 {
		t.Fatalf("created child has %d owners, want 1", ownerCount)
	}

	var ignoredCount int64
	if err := fixture.db.Model(&models.Album{}).Where("path_hash = ?", models.MD5Hash(fixture.ignoredPath)).Count(&ignoredCount).Error; err != nil {
		t.Fatalf("count ignored albums: %v", err)
	}
	if ignoredCount != 0 {
		t.Fatalf("recursive scan created %d ignored albums", ignoredCount)
	}

	if slices.Contains(sortedAlbumPaths(albums), fixture.sibling.Path) {
		t.Fatal("recursive scan escaped into a sibling album")
	}
}

func TestFindAlbumsInSubtreeInheritsParentIgnoreRules(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	owner := &models.User{Username: "inherited-ignore-owner"}
	if err := db.Create(owner).Error; err != nil {
		t.Fatal(err)
	}

	parentPath := t.TempDir()
	rootPath := filepath.Join(parentPath, "selected")
	blockedPath := filepath.Join(rootPath, "blocked")
	if err := os.MkdirAll(blockedPath, 0o700); err != nil {
		t.Fatal(err)
	}
	copyAlbumTestPhoto(t, filepath.Join(rootPath, "photo.jpg"))
	copyAlbumTestPhoto(t, filepath.Join(blockedPath, "photo.jpg"))
	if err := os.WriteFile(filepath.Join(parentPath, ".photoviewignore"), []byte("blocked/\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	parent := &models.Album{Title: "parent", Path: parentPath}
	if err := db.Create(parent).Error; err != nil {
		t.Fatal(err)
	}
	root := &models.Album{Title: "selected", Path: rootPath, ParentAlbumID: &parent.ID}
	if err := db.Create(root).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(owner).Association("Albums").Append(parent, root); err != nil {
		t.Fatal(err)
	}

	cache := scanner_cache.MakeAlbumCache()
	albums, errs := scanner.FindAlbumsInSubtree(db, root, true, cache)
	if len(errs) != 0 {
		t.Fatalf("unexpected scan errors: %v", errs)
	}
	if got := sortedAlbumPaths(albums); !slices.Equal(got, []string{rootPath}) {
		t.Fatalf("inherited ignore did not exclude blocked child: %v", got)
	}
	ignoreLines := cache.GetAlbumIgnore(rootPath)
	if ignoreLines == nil || !slices.Contains(*ignoreLines, "blocked/") {
		t.Fatalf("root album cache does not include inherited ignore rule: %v", ignoreLines)
	}
}
