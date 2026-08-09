package processing_tasks

import (
	"os"
	"path"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/log"
	"github.com/photoview/photoview/api/scanner/media_encoding"
	"github.com/pkg/errors"
	"gorm.io/gorm"
)

type thumbnailEncoder func(outputPath string) (media_encoding.Dimension, error)

func replaceCachedThumbnail(tx *gorm.DB, mediaURL *models.MediaURL, cacheDir string, newName string, encode thumbnailEncoder) (*models.MediaURL, error) {
	if mediaURL == nil {
		return nil, errors.New("thumbnail media URL is required")
	}
	if path.Base(newName) != newName {
		return nil, errors.New("replacement thumbnail name must not contain a path")
	}
	if newName == mediaURL.MediaName {
		return nil, errors.New("replacement thumbnail name must be different")
	}

	oldPath := path.Join(cacheDir, mediaURL.MediaName)
	newPath := path.Join(cacheDir, newName)
	if _, err := os.Lstat(newPath); err == nil {
		return nil, errors.Errorf("replacement thumbnail already exists (%s)", newPath)
	} else if !os.IsNotExist(err) {
		return nil, errors.Wrap(err, "check replacement thumbnail path")
	}

	dimensions, err := encode(newPath)
	if err != nil {
		_ = os.Remove(newPath)
		return nil, err
	}

	fileStats, err := os.Stat(newPath)
	if err != nil {
		_ = os.Remove(newPath)
		return nil, errors.Wrap(err, "stat replacement thumbnail")
	}
	if !fileStats.Mode().IsRegular() || fileStats.Size() == 0 {
		_ = os.Remove(newPath)
		return nil, errors.New("replacement thumbnail is not a non-empty regular file")
	}

	replacement := *mediaURL
	replacement.MediaName = newName
	replacement.Width = dimensions.Width
	replacement.Height = dimensions.Height
	replacement.FileSize = fileStats.Size()
	if err := tx.Save(&replacement).Error; err != nil {
		_ = os.Remove(newPath)
		return nil, errors.Wrap(err, "save replacement thumbnail url")
	}

	if err := os.Remove(oldPath); err != nil && !os.IsNotExist(err) {
		log.Warn(nil, "Could not remove superseded thumbnail", "path", oldPath, "error", err)
	}

	return &replacement, nil
}

func generateSaveHighResJPEG(tx *gorm.DB, media *models.Media, imageData *media_encoding.EncodeMediaData, highResName string, imagePath string, mediaURL *models.MediaURL) (*models.MediaURL, error) {

	err := imageData.EncodeHighRes(imagePath)
	if err != nil {
		return nil, errors.Wrap(err, "creating high-res cached image")
	}

	photoDimensions, err := media_encoding.GetPhotoDimensions(imagePath)
	if err != nil {
		return nil, err
	}

	fileStats, err := os.Stat(imagePath)
	if err != nil {
		return nil, errors.Wrap(err, "reading file stats of highres photo")
	}

	if mediaURL == nil {

		mediaURL = &models.MediaURL{
			MediaID:     media.ID,
			MediaName:   highResName,
			Width:       photoDimensions.Width,
			Height:      photoDimensions.Height,
			Purpose:     models.PhotoHighRes,
			ContentType: "image/jpeg",
			FileSize:    fileStats.Size(),
		}

		if err := tx.Create(&mediaURL).Error; err != nil {
			return nil, errors.Wrapf(err, "could not insert highres media url (%d, %s)", media.ID, highResName)
		}
	} else {
		mediaURL.Width = photoDimensions.Width
		mediaURL.Height = photoDimensions.Height
		mediaURL.FileSize = fileStats.Size()

		if err := tx.Save(&mediaURL).Error; err != nil {
			return nil, errors.Wrapf(err, "could not update media url after side car changes (%d, %s)", media.ID, highResName)
		}
	}

	return mediaURL, nil
}

func generateSaveThumbnailJPEG(tx *gorm.DB, media *models.Media, thumbnailName string, photoCachePath string, baseImagePath string, mediaURL *models.MediaURL) (*models.MediaURL, error) {
	thumbOutputPath := path.Join(photoCachePath, thumbnailName)

	thumbSize, err := media_encoding.EncodeThumbnail(tx, baseImagePath, thumbOutputPath)
	if err != nil {
		return nil, errors.Wrap(err, "could not create thumbnail cached image")
	}

	fileStats, err := os.Stat(thumbOutputPath)
	if err != nil {
		return nil, errors.Wrap(err, "reading file stats of thumbnail photo")
	}

	if mediaURL == nil {

		mediaURL = &models.MediaURL{
			MediaID:     media.ID,
			MediaName:   thumbnailName,
			Width:       thumbSize.Width,
			Height:      thumbSize.Height,
			Purpose:     models.PhotoThumbnail,
			ContentType: "image/jpeg",
			FileSize:    fileStats.Size(),
		}

		if err := tx.Create(&mediaURL).Error; err != nil {
			return nil, errors.Wrapf(err, "could not insert thumbnail media url (%d, %s)", media.ID, thumbnailName)
		}
	} else {
		mediaURL.Width = thumbSize.Width
		mediaURL.Height = thumbSize.Height
		mediaURL.FileSize = fileStats.Size()

		if err := tx.Save(&mediaURL).Error; err != nil {
			return nil, errors.Wrapf(err, "could not update media url after side car changes (%d, %s)", media.ID, thumbnailName)
		}
	}

	return mediaURL, nil
}
