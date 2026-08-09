package scanner

import (
	"container/list"
	"log"
	"os"
	"path"
	"strings"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner/scanner_cache"
	"github.com/photoview/photoview/api/utils"
	"github.com/pkg/errors"
	ignore "github.com/sabhiram/go-gitignore"
	"gorm.io/gorm"
)

type albumTreeScanInfo struct {
	path   string
	parent *models.Album
	album  *models.Album
	ignore []string
}

// FindAlbumsInSubtree discovers albums beneath an existing album without
// running the user-wide cleanup performed by FindAlbumsForUser.
func FindAlbumsInSubtree(db *gorm.DB, rootAlbum *models.Album, recursive bool, albumCache *scanner_cache.AlbumScannerCache) ([]*models.Album, []error) {
	if rootAlbum == nil {
		return nil, []error{errors.New("root album is required")}
	}
	if albumCache == nil {
		albumCache = scanner_cache.MakeAlbumCache()
	}

	inheritedIgnore, err := inheritedAlbumIgnore(db, rootAlbum)
	if err != nil {
		return nil, []error{err}
	}

	scanQueue := list.New()
	scanQueue.PushBack(albumTreeScanInfo{
		path:   rootAlbum.Path,
		album:  rootAlbum,
		ignore: inheritedIgnore,
	})

	albums := make([]*models.Album, 0)
	scanErrors := make([]error, 0)

	for scanQueue.Front() != nil {
		albumInfo := scanQueue.Remove(scanQueue.Front()).(albumTreeScanInfo)
		albumPath := albumInfo.path
		effectiveIgnore := append([]string(nil), albumInfo.ignore...)

		dirContent, err := os.ReadDir(albumPath)
		if err != nil {
			scanErrors = append(scanErrors, errors.Wrapf(err, "read directory (%s)", albumPath))
			continue
		}

		ignorePaths := ignore.CompileIgnoreLines(effectiveIgnore...)
		if ignorePaths.MatchesPath(albumPath + "/") {
			log.Printf("Skip, directory %s is in ignore file", albumPath)
			continue
		}

		localIgnore, err := getPhotoviewIgnore(albumPath)
		if err != nil {
			scanErrors = append(scanErrors, errors.Wrapf(err, "read ignore file (%s)", albumPath))
		} else {
			effectiveIgnore = append(effectiveIgnore, localIgnore...)
		}

		album := albumInfo.album
		if album == nil {
			album, err = findOrCreateSubAlbum(db, albumPath, albumInfo.parent)
			if err != nil {
				scanErrors = append(scanErrors, errors.Wrap(err, "create or load sub-album"))
				continue
			}
		}

		albumCache.InsertAlbumIgnore(albumPath, effectiveIgnore)
		albums = append(albums, album)

		if !recursive {
			continue
		}

		for _, item := range dirContent {
			if strings.HasPrefix(item.Name(), ".") {
				continue
			}

			subalbumPath := path.Join(albumPath, item.Name())
			isDirSymlink, err := utils.IsDirSymlink(subalbumPath)
			if err != nil {
				scanErrors = append(scanErrors, errors.Wrapf(err, "could not check for symlink target of %s", subalbumPath))
				continue
			}

			if (item.IsDir() || isDirSymlink) && directoryContainsPhotos(subalbumPath, albumCache, effectiveIgnore) {
				scanQueue.PushBack(albumTreeScanInfo{
					path:   subalbumPath,
					parent: album,
					ignore: effectiveIgnore,
				})
			}
		}
	}

	return albums, scanErrors
}

func inheritedAlbumIgnore(db *gorm.DB, rootAlbum *models.Album) ([]string, error) {
	ancestors := make([]models.Album, 0)
	seen := make(map[int]struct{})
	parentID := rootAlbum.ParentAlbumID

	for parentID != nil {
		if _, exists := seen[*parentID]; exists {
			return nil, errors.Errorf("album parent cycle detected at album %d", *parentID)
		}
		seen[*parentID] = struct{}{}

		var parent models.Album
		if err := db.First(&parent, *parentID).Error; err != nil {
			return nil, errors.Wrapf(err, "load parent album %d", *parentID)
		}
		ancestors = append(ancestors, parent)
		parentID = parent.ParentAlbumID
	}

	inheritedIgnore := make([]string, 0)
	for i := len(ancestors) - 1; i >= 0; i-- {
		ignoreLines, err := getPhotoviewIgnore(ancestors[i].Path)
		if err != nil {
			return nil, errors.Wrapf(err, "read inherited ignore file (%s)", ancestors[i].Path)
		}
		inheritedIgnore = append(inheritedIgnore, ignoreLines...)
	}

	return inheritedIgnore, nil
}

func findOrCreateSubAlbum(db *gorm.DB, albumPath string, parent *models.Album) (*models.Album, error) {
	if parent == nil {
		return nil, errors.New("sub-album parent is required")
	}

	var album *models.Album
	err := db.Transaction(func(tx *gorm.DB) error {
		var albumResult []models.Album
		if err := tx.Where("path_hash = ?", models.MD5Hash(albumPath)).Find(&albumResult).Error; err != nil {
			return err
		}

		if len(albumResult) != 0 {
			album = &albumResult[0]
			return nil
		}

		parentOwners := make([]models.User, 0)
		if err := tx.Model(parent).Association("Owners").Find(&parentOwners); err != nil {
			return errors.Wrap(err, "load parent album owners")
		}

		album = &models.Album{
			Title:         path.Base(albumPath),
			ParentAlbumID: &parent.ID,
			Path:          albumPath,
		}
		if err := tx.Create(album).Error; err != nil {
			return errors.Wrap(err, "insert album into database")
		}
		if err := tx.Model(album).Association("Owners").Append(parentOwners); err != nil {
			return errors.Wrap(err, "add owners to album")
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return album, nil
}
