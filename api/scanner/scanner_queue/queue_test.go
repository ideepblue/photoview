package scanner_queue

import (
	"context"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner/externaltools/exif"
	"github.com/photoview/photoview/api/scanner/scanner_cache"
	"github.com/photoview/photoview/api/scanner/scanner_task"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var _ = flag.Bool("database", false, "run database integration tests")
var _ = flag.Bool("filesystem", false, "run filesystem integration tests")

func makeAlbumWithID(id int) *models.Album {
	var album models.Album
	album.ID = id

	return &album
}

func TestAddAlbumToQueueUsesScopedDiscoveryAndOptions(t *testing.T) {
	exifCleanup, err := exif.Initialize()
	if err != nil {
		t.Fatal(err)
	}
	defer exifCleanup()

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "queue.db")))
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Album{}, &models.UserAlbums{}); err != nil {
		t.Fatal(err)
	}

	rootPath := filepath.Join(t.TempDir(), "root")
	childPath := filepath.Join(rootPath, "child")
	if err := os.MkdirAll(childPath, 0o700); err != nil {
		t.Fatal(err)
	}
	photo, err := os.ReadFile("../test_media/real_media/standalone_jpg.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(childPath, "photo.jpg"), photo, 0o600); err != nil {
		t.Fatal(err)
	}

	root := &models.Album{Title: "root", Path: rootPath}
	if err := db.Create(root).Error; err != nil {
		t.Fatal(err)
	}
	child := &models.Album{Title: "child", Path: childPath, ParentAlbumID: &root.ID}
	if err := db.Create(child).Error; err != nil {
		t.Fatal(err)
	}

	previousQueue := global_scanner_queue
	t.Cleanup(func() { global_scanner_queue = previousQueue })
	global_scanner_queue = ScannerQueue{
		idle_chan:   make(chan bool, 1),
		in_progress: make([]ScannerJob, 0),
		up_next:     make([]ScannerJob, 0),
		db:          db,
	}

	queued, err := AddAlbumToQueue(root, true, true)
	if err != nil {
		t.Fatal(err)
	}
	if queued != 2 {
		t.Fatalf("queued %d albums, want 2", queued)
	}
	if len(global_scanner_queue.up_next) != 2 {
		t.Fatalf("queue contains %d jobs, want 2", len(global_scanner_queue.up_next))
	}
	for _, job := range global_scanner_queue.up_next {
		if !job.ctx.GetScanOptions().ForceRefresh {
			t.Fatalf("album %d did not inherit force-refresh options", job.ctx.GetAlbum().ID)
		}
	}
}

func makeScannerJob(albumID int, forceRefresh bool) ScannerJob {
	return NewScannerJob(scanner_task.NewTaskContextWithOptions(
		context.Background(),
		nil,
		makeAlbumWithID(albumID),
		scanner_cache.MakeAlbumCache(),
		scanner_task.ScanOptions{ForceRefresh: forceRefresh},
	))
}

func TestScannerQueueAddJob(t *testing.T) {

	scannerJobs := []ScannerJob{
		makeScannerJob(100, false),
		makeScannerJob(20, false),
	}

	mockScannerQueue := ScannerQueue{
		idle_chan:   make(chan bool, 1),
		in_progress: make([]ScannerJob, 0),
		up_next:     scannerJobs,
		db:          nil,
	}

	t.Run("add new job to scanner queue", func(t *testing.T) {
		newJob := makeScannerJob(42, false)

		startingJobs := len(mockScannerQueue.up_next)

		err := mockScannerQueue.addJob(&newJob)
		if err != nil {
			t.Errorf(".AddJob() returned an unexpected error: %s", err)
		}

		if len(mockScannerQueue.up_next) != startingJobs+1 {
			t.Errorf("Expected scanner queue length to be %d but got %d", startingJobs+1, len(mockScannerQueue.up_next))
		} else if mockScannerQueue.up_next[len(mockScannerQueue.up_next)-1] != newJob {
			t.Errorf("Expected scanner queue to contain the job that was added: %+v", newJob)
		}

	})

	t.Run("add existing job to scanner queue", func(t *testing.T) {
		startingJobs := len(mockScannerQueue.up_next)

		job := makeScannerJob(20, false)
		err := mockScannerQueue.addJob(&job)
		if err != nil {
			t.Errorf(".AddJob() returned an unexpected error: %s", err)
		}

		if len(mockScannerQueue.up_next) != startingJobs {
			t.Errorf("Expected scanner queue length not to change: start length %d, new length %d", startingJobs, len(mockScannerQueue.up_next))
		}

	})
}

func TestScannerQueueStrongestRequestWins(t *testing.T) {
	newQueue := func() ScannerQueue {
		return ScannerQueue{
			idle_chan:   make(chan bool, 1),
			in_progress: make([]ScannerJob, 0),
			up_next:     make([]ScannerJob, 0),
		}
	}

	t.Run("forced request upgrades queued normal job", func(t *testing.T) {
		queue := newQueue()
		normal := makeScannerJob(20, false)
		forced := makeScannerJob(20, true)

		if err := queue.addJob(&normal); err != nil {
			t.Fatal(err)
		}
		if err := queue.addJob(&forced); err != nil {
			t.Fatal(err)
		}

		if len(queue.up_next) != 1 {
			t.Fatalf("expected one queued job, got %d", len(queue.up_next))
		}
		if !queue.up_next[0].ctx.GetScanOptions().ForceRefresh {
			t.Fatal("expected queued job to be upgraded to force refresh")
		}
	})

	t.Run("normal request does not downgrade queued forced job", func(t *testing.T) {
		queue := newQueue()
		forced := makeScannerJob(20, true)
		normal := makeScannerJob(20, false)

		if err := queue.addJob(&forced); err != nil {
			t.Fatal(err)
		}
		if err := queue.addJob(&normal); err != nil {
			t.Fatal(err)
		}

		if len(queue.up_next) != 1 || !queue.up_next[0].ctx.GetScanOptions().ForceRefresh {
			t.Fatal("expected the queued forced job to remain unchanged")
		}
	})

	t.Run("forced request adds exactly one follow-up behind running normal job", func(t *testing.T) {
		queue := newQueue()
		queue.in_progress = append(queue.in_progress, makeScannerJob(20, false))
		forced := makeScannerJob(20, true)

		if err := queue.addJob(&forced); err != nil {
			t.Fatal(err)
		}
		if err := queue.addJob(&forced); err != nil {
			t.Fatal(err)
		}

		if len(queue.up_next) != 1 {
			t.Fatalf("expected one forced follow-up, got %d", len(queue.up_next))
		}
		if !queue.up_next[0].ctx.GetScanOptions().ForceRefresh {
			t.Fatal("expected the follow-up job to force refresh")
		}
	})

	t.Run("running forced job rejects duplicate requests", func(t *testing.T) {
		queue := newQueue()
		queue.in_progress = append(queue.in_progress, makeScannerJob(20, true))

		forced := makeScannerJob(20, true)
		normal := makeScannerJob(20, false)
		if err := queue.addJob(&forced); err != nil {
			t.Fatal(err)
		}
		if err := queue.addJob(&normal); err != nil {
			t.Fatal(err)
		}

		if len(queue.up_next) != 0 {
			t.Fatalf("expected no follow-up behind a running forced job, got %d", len(queue.up_next))
		}
	})
}
