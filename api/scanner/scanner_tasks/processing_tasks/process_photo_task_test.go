package processing_tasks

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner/media_encoding"
	"github.com/photoview/photoview/api/scanner/scanner_cache"
	"github.com/photoview/photoview/api/scanner/scanner_task"
	"github.com/photoview/photoview/api/test_utils"
	"gorm.io/gorm"
)

type processPhotoFixture struct {
	db        *gorm.DB
	album     *models.Album
	media     *models.Media
	thumbnail *models.MediaURL
	cacheDir  string
	oldPath   string
}

func newProcessPhotoFixture(t *testing.T) processPhotoFixture {
	t.Helper()

	db := openProcessingTestDB(t)
	photoPath := test_utils.PathFromAPIRoot("scanner", "test_media", "real_media", "standalone_jpg.jpg")
	album := &models.Album{Title: "album", Path: filepath.Dir(photoPath)}
	if err := db.Create(album).Error; err != nil {
		t.Fatal(err)
	}
	media := &models.Media{
		Title:   filepath.Base(photoPath),
		Path:    photoPath,
		AlbumID: album.ID,
		Type:    models.MediaTypePhoto,
	}
	if err := db.Create(media).Error; err != nil {
		t.Fatal(err)
	}
	original := &models.MediaURL{
		MediaID:     media.ID,
		MediaName:   "original.jpg",
		Width:       1,
		Height:      1,
		Purpose:     models.MediaOriginal,
		ContentType: "image/jpeg",
		FileSize:    1,
	}
	thumbnail := &models.MediaURL{
		MediaID:     media.ID,
		MediaName:   "thumbnail_old.jpg",
		Width:       1,
		Height:      1,
		Purpose:     models.PhotoThumbnail,
		ContentType: "image/jpeg",
		FileSize:    1,
	}
	if err := db.Create(original).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(thumbnail).Error; err != nil {
		t.Fatal(err)
	}

	photo, err := os.ReadFile(photoPath)
	if err != nil {
		t.Fatal(err)
	}
	cacheDir := t.TempDir()
	oldPath := filepath.Join(cacheDir, thumbnail.MediaName)
	if err := os.WriteFile(oldPath, photo, 0o600); err != nil {
		t.Fatal(err)
	}

	return processPhotoFixture{
		db:        db,
		album:     album,
		media:     media,
		thumbnail: thumbnail,
		cacheDir:  cacheDir,
		oldPath:   oldPath,
	}
}

func (fixture processPhotoFixture) process(t *testing.T, forceRefresh bool) []*models.MediaURL {
	t.Helper()

	ctx := scanner_task.NewTaskContextWithOptions(
		context.Background(),
		fixture.db,
		fixture.album,
		scanner_cache.MakeAlbumCache(),
		scanner_task.ScanOptions{ForceRefresh: forceRefresh},
	)
	mediaData := media_encoding.NewEncodeMediaData(fixture.media)
	updated, err := (ProcessPhotoTask{}).ProcessMedia(ctx, &mediaData, fixture.cacheDir)
	if err != nil {
		t.Fatal(err)
	}

	return updated
}

func TestProcessPhotoNormalScanKeepsHealthyThumbnailName(t *testing.T) {
	fixture := newProcessPhotoFixture(t)
	updated := fixture.process(t, false)

	if len(updated) != 0 {
		t.Fatalf("normal scan unexpectedly updated %d URLs", len(updated))
	}
	var stored models.MediaURL
	if err := fixture.db.First(&stored, fixture.thumbnail.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.MediaName != fixture.thumbnail.MediaName {
		t.Fatalf("normal scan rotated thumbnail from %s to %s", fixture.thumbnail.MediaName, stored.MediaName)
	}
	if _, err := os.Stat(fixture.oldPath); err != nil {
		t.Fatalf("normal scan removed healthy thumbnail: %v", err)
	}
}

func TestProcessPhotoForceRefreshRotatesThumbnailName(t *testing.T) {
	fixture := newProcessPhotoFixture(t)
	updated := fixture.process(t, true)

	if len(updated) != 1 {
		t.Fatalf("forced scan updated %d URLs, want 1", len(updated))
	}
	if updated[0].ID != fixture.thumbnail.ID {
		t.Fatalf("forced scan replaced URL row %d with %d", fixture.thumbnail.ID, updated[0].ID)
	}
	if updated[0].MediaName == fixture.thumbnail.MediaName {
		t.Fatal("forced scan did not rotate thumbnail name")
	}
	if _, err := os.Stat(fixture.oldPath); !os.IsNotExist(err) {
		t.Fatalf("forced scan kept old thumbnail: %v", err)
	}
	if _, err := os.Stat(filepath.Join(fixture.cacheDir, updated[0].MediaName)); err != nil {
		t.Fatalf("forced replacement thumbnail missing: %v", err)
	}

	var stored models.MediaURL
	if err := fixture.db.First(&stored, fixture.thumbnail.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.MediaName != updated[0].MediaName {
		t.Fatalf("database name %s differs from replacement %s", stored.MediaName, updated[0].MediaName)
	}
}
