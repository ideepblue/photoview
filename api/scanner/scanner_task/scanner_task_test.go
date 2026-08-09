package scanner_task

import (
	"context"
	"testing"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner/scanner_cache"
)

func TestTaskContextScanOptions(t *testing.T) {
	album := &models.Album{}
	album.ID = 1
	cache := scanner_cache.MakeAlbumCache()

	normal := NewTaskContext(context.Background(), nil, album, cache)
	if normal.GetScanOptions().ForceRefresh {
		t.Fatal("expected the default task context not to force refresh thumbnails")
	}

	forced := NewTaskContextWithOptions(
		context.Background(), nil, album, cache, ScanOptions{ForceRefresh: true},
	)
	if !forced.GetScanOptions().ForceRefresh {
		t.Fatal("expected the explicit task context to force refresh thumbnails")
	}

	downgraded := forced.WithScanOptions(ScanOptions{})
	if downgraded.GetScanOptions().ForceRefresh {
		t.Fatal("expected WithScanOptions to replace the scan options")
	}
}
