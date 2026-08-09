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
)

func TestProcessVideoForceRefreshRotatesOnlyThumbnail(t *testing.T) {
	db := openProcessingTestDB(t)
	videoPath := test_utils.PathFromAPIRoot("scanner", "test_media", "real_media", "mkv.mkv")
	album := &models.Album{Title: "album", Path: filepath.Dir(videoPath)}
	if err := db.Create(album).Error; err != nil {
		t.Fatal(err)
	}
	video := &models.Media{
		Title:   filepath.Base(videoPath),
		Path:    videoPath,
		AlbumID: album.ID,
		Type:    models.MediaTypeVideo,
	}
	if err := db.Create(video).Error; err != nil {
		t.Fatal(err)
	}
	thumbnail := &models.MediaURL{
		MediaID:     video.ID,
		MediaName:   "video_thumb_old.jpg",
		Width:       1,
		Height:      1,
		Purpose:     models.VideoThumbnail,
		ContentType: "image/jpeg",
		FileSize:    1,
	}
	if err := db.Create(thumbnail).Error; err != nil {
		t.Fatal(err)
	}

	photoPath := test_utils.PathFromAPIRoot("scanner", "test_media", "real_media", "standalone_jpg.jpg")
	photo, err := os.ReadFile(photoPath)
	if err != nil {
		t.Fatal(err)
	}
	cacheDir := t.TempDir()
	oldPath := filepath.Join(cacheDir, thumbnail.MediaName)
	if err := os.WriteFile(oldPath, photo, 0o600); err != nil {
		t.Fatal(err)
	}

	ctx := scanner_task.NewTaskContextWithOptions(
		context.Background(),
		db,
		album,
		scanner_cache.MakeAlbumCache(),
		scanner_task.ScanOptions{ForceRefresh: true},
	)
	mediaData := media_encoding.NewEncodeMediaData(video)
	updated, err := (ProcessVideoTask{}).ProcessMedia(ctx, &mediaData, cacheDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated) != 1 || updated[0].Purpose != models.VideoThumbnail {
		t.Fatalf("forced video scan updated unexpected URLs: %+v", updated)
	}
	if updated[0].ID != thumbnail.ID || updated[0].MediaName == thumbnail.MediaName {
		t.Fatalf("video thumbnail URL was not rotated in place: %+v", updated[0])
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("old video thumbnail still exists: %v", err)
	}
	if _, err := os.Stat(filepath.Join(cacheDir, updated[0].MediaName)); err != nil {
		t.Fatalf("new video thumbnail is missing: %v", err)
	}

	var videoWebCount int64
	if err := db.Model(&models.MediaURL{}).
		Where("media_id = ? AND purpose = ?", video.ID, models.VideoWeb).
		Count(&videoWebCount).Error; err != nil {
		t.Fatal(err)
	}
	if videoWebCount != 0 {
		t.Fatalf("forced thumbnail refresh created %d transcoded video streams", videoWebCount)
	}
}
