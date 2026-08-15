package actions

import (
	"errors"
	"fmt"
	"time"

	"github.com/photoview/photoview/api/graphql/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const albumViewDedupeWindow = 30 * time.Minute

func authorizedAlbum(db *gorm.DB, user *models.User, albumID int) (*models.Album, error) {
	if user == nil {
		return nil, errors.New("unauthorized")
	}

	var album models.Album
	if err := db.First(&album, albumID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("album not found")
		}
		return nil, fmt.Errorf("find album: %w", err)
	}

	owned, err := user.OwnsAlbum(db, &album)
	if err != nil {
		return nil, fmt.Errorf("check album ownership: %w", err)
	}
	if !owned {
		return nil, errors.New("forbidden")
	}

	return &album, nil
}

func findUserAlbumData(db *gorm.DB, userID int, albumID int) (*models.UserAlbumData, error) {
	var state models.UserAlbumData
	if err := db.First(&state, "user_id = ? AND album_id = ?", userID, albumID).Error; err != nil {
		return nil, fmt.Errorf("find user album data: %w", err)
	}
	return &state, nil
}

func AlbumViewerState(db *gorm.DB, user *models.User, albumID int) (*models.UserAlbumData, error) {
	if _, err := authorizedAlbum(db, user, albumID); err != nil {
		return nil, err
	}

	state, err := findUserAlbumData(db, user.ID, albumID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &models.UserAlbumData{UserID: user.ID, AlbumID: albumID}, nil
	}
	return state, err
}

func SetAlbumFeatured(db *gorm.DB, user *models.User, albumID int, featured bool) (*models.UserAlbumData, error) {
	if _, err := authorizedAlbum(db, user, albumID); err != nil {
		return nil, err
	}

	state := models.UserAlbumData{
		UserID:   user.ID,
		AlbumID:  albumID,
		Featured: featured,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "album_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"featured":   featured,
			"updated_at": time.Now(),
		}),
	}).Create(&state).Error; err != nil {
		return nil, fmt.Errorf("set album featured: %w", err)
	}

	return findUserAlbumData(db, user.ID, albumID)
}

func RecordAlbumView(db *gorm.DB, user *models.User, albumID int, mediaID int, viewedAt time.Time) (*models.UserAlbumData, error) {
	if _, err := authorizedAlbum(db, user, albumID); err != nil {
		return nil, err
	}

	var matchingMedia int64
	if err := db.Model(&models.Media{}).
		Where("id = ? AND album_id = ?", mediaID, albumID).
		Count(&matchingMedia).Error; err != nil {
		return nil, fmt.Errorf("validate album media: %w", err)
	}
	if matchingMedia == 0 {
		return nil, errors.New("media does not belong directly to album")
	}

	state := models.UserAlbumData{UserID: user.ID, AlbumID: albumID}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&state).Error; err != nil {
		return nil, fmt.Errorf("ensure user album data: %w", err)
	}

	cutoff := viewedAt.Add(-albumViewDedupeWindow)
	if err := db.Model(&models.UserAlbumData{}).
		Where("user_id = ? AND album_id = ?", user.ID, albumID).
		Updates(map[string]interface{}{
			"last_viewed_at": viewedAt,
			"last_counted_at": gorm.Expr(
				"CASE WHEN last_counted_at IS NULL OR last_counted_at <= ? THEN ? ELSE last_counted_at END",
				cutoff,
				viewedAt,
			),
			"view_count": gorm.Expr(
				"CASE WHEN last_counted_at IS NULL OR last_counted_at <= ? THEN view_count + 1 ELSE view_count END",
				cutoff,
			),
		}).Error; err != nil {
		return nil, fmt.Errorf("record album view: %w", err)
	}

	return findUserAlbumData(db, user.ID, albumID)
}
