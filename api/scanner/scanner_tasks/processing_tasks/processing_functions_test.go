package processing_tasks

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner/media_encoding"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type thumbnailReplacementFixture struct {
	db       *gorm.DB
	url      *models.MediaURL
	cacheDir string
	oldPath  string
}

func openProcessingTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "processing.db")))
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Album{},
		&models.UserAlbums{},
		&models.Media{},
		&models.MediaURL{},
	); err != nil {
		t.Fatal(err)
	}

	return db
}

func newThumbnailReplacementFixture(t *testing.T) thumbnailReplacementFixture {
	t.Helper()

	db := openProcessingTestDB(t)
	album := &models.Album{Title: "album", Path: filepath.Join(t.TempDir(), "album")}
	if err := db.Create(album).Error; err != nil {
		t.Fatal(err)
	}
	media := &models.Media{
		Title:   "photo.jpg",
		Path:    filepath.Join(album.Path, "photo.jpg"),
		AlbumID: album.ID,
		Type:    models.MediaTypePhoto,
	}
	if err := db.Create(media).Error; err != nil {
		t.Fatal(err)
	}
	mediaURL := &models.MediaURL{
		MediaID:     media.ID,
		MediaName:   "thumbnail_old.jpg",
		Width:       10,
		Height:      20,
		Purpose:     models.PhotoThumbnail,
		ContentType: "image/jpeg",
		FileSize:    3,
	}
	if err := db.Create(mediaURL).Error; err != nil {
		t.Fatal(err)
	}

	cacheDir := t.TempDir()
	oldPath := filepath.Join(cacheDir, mediaURL.MediaName)
	if err := os.WriteFile(oldPath, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}

	return thumbnailReplacementFixture{
		db:       db,
		url:      mediaURL,
		cacheDir: cacheDir,
		oldPath:  oldPath,
	}
}

func TestReplaceCachedThumbnailRotatesNameAfterEncode(t *testing.T) {
	fixture := newThumbnailReplacementFixture(t)
	newName := "thumbnail_new.jpg"

	updated, err := replaceCachedThumbnail(
		fixture.db,
		fixture.url,
		fixture.cacheDir,
		newName,
		func(outputPath string) (media_encoding.Dimension, error) {
			if err := os.WriteFile(outputPath, []byte("replacement"), 0o600); err != nil {
				return media_encoding.Dimension{}, err
			}
			return media_encoding.Dimension{Width: 40, Height: 60}, nil
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ID != fixture.url.ID {
		t.Fatalf("replacement changed row ID from %d to %d", fixture.url.ID, updated.ID)
	}
	if updated.MediaName != newName || updated.Width != 40 || updated.Height != 60 {
		t.Fatalf("unexpected replacement metadata: %+v", updated)
	}
	if _, err := os.Stat(fixture.oldPath); !os.IsNotExist(err) {
		t.Fatalf("old thumbnail still exists: %v", err)
	}
	if _, err := os.Stat(filepath.Join(fixture.cacheDir, newName)); err != nil {
		t.Fatalf("replacement thumbnail missing: %v", err)
	}

	var stored models.MediaURL
	if err := fixture.db.First(&stored, fixture.url.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.MediaName != newName || stored.FileSize != int64(len("replacement")) {
		t.Fatalf("database was not switched to replacement: %+v", stored)
	}
}

func TestReplaceCachedThumbnailEncoderFailureKeepsOldFile(t *testing.T) {
	fixture := newThumbnailReplacementFixture(t)
	newName := "thumbnail_partial.jpg"

	_, err := replaceCachedThumbnail(
		fixture.db,
		fixture.url,
		fixture.cacheDir,
		newName,
		func(outputPath string) (media_encoding.Dimension, error) {
			if writeErr := os.WriteFile(outputPath, []byte("partial"), 0o600); writeErr != nil {
				return media_encoding.Dimension{}, writeErr
			}
			return media_encoding.Dimension{}, errors.New("encoder failed")
		},
	)
	if err == nil {
		t.Fatal("expected encoder failure")
	}
	if _, err := os.Stat(fixture.oldPath); err != nil {
		t.Fatalf("old thumbnail was removed after encoder failure: %v", err)
	}
	if _, err := os.Stat(filepath.Join(fixture.cacheDir, newName)); !os.IsNotExist(err) {
		t.Fatalf("partial replacement was not removed: %v", err)
	}

	var stored models.MediaURL
	if err := fixture.db.First(&stored, fixture.url.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.MediaName != fixture.url.MediaName {
		t.Fatalf("database changed after encoder failure: %s", stored.MediaName)
	}
}

func TestReplaceCachedThumbnailDatabaseFailureKeepsOldFile(t *testing.T) {
	fixture := newThumbnailReplacementFixture(t)
	newName := "thumbnail_unsaved.jpg"
	sqlDB, err := fixture.db.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}

	_, err = replaceCachedThumbnail(
		fixture.db,
		fixture.url,
		fixture.cacheDir,
		newName,
		func(outputPath string) (media_encoding.Dimension, error) {
			if writeErr := os.WriteFile(outputPath, []byte("replacement"), 0o600); writeErr != nil {
				return media_encoding.Dimension{}, writeErr
			}
			return media_encoding.Dimension{Width: 40, Height: 60}, nil
		},
	)
	if err == nil {
		t.Fatal("expected database failure")
	}
	if _, err := os.Stat(fixture.oldPath); err != nil {
		t.Fatalf("old thumbnail was removed after database failure: %v", err)
	}
	if _, err := os.Stat(filepath.Join(fixture.cacheDir, newName)); !os.IsNotExist(err) {
		t.Fatalf("unsaved replacement was not removed: %v", err)
	}
}
