package models_test

import (
	"testing"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/test_utils"
	"github.com/stretchr/testify/require"
)

func TestUserAlbumDataDefaultsIsolationAndCascade(t *testing.T) {
	db := test_utils.DatabaseTest(t)

	userOne, err := models.RegisterUser(db, "album-viewer-one", nil, false)
	require.NoError(t, err)
	userTwo, err := models.RegisterUser(db, "album-viewer-two", nil, false)
	require.NoError(t, err)

	album := models.Album{Title: "Trip", Path: "/photos/trip"}
	require.NoError(t, db.Create(&album).Error)

	userOneState := models.UserAlbumData{
		UserID:  userOne.ID,
		AlbumID: album.ID,
	}
	require.NoError(t, db.Create(&userOneState).Error)

	var storedDefault models.UserAlbumData
	require.NoError(t, db.First(&storedDefault, "user_id = ? AND album_id = ?", userOne.ID, album.ID).Error)
	require.False(t, storedDefault.Featured)
	require.EqualValues(t, 0, storedDefault.ViewCount)
	require.Nil(t, storedDefault.LastViewedAt)
	require.Nil(t, storedDefault.LastCountedAt)
	require.Error(t, db.Create(&models.UserAlbumData{
		UserID:  userOne.ID,
		AlbumID: album.ID,
	}).Error, "the user and album pair must be the composite primary key")

	userTwoState := models.UserAlbumData{
		UserID:    userTwo.ID,
		AlbumID:   album.ID,
		Featured:  true,
		ViewCount: 7,
	}
	require.NoError(t, db.Create(&userTwoState).Error)

	var rows int64
	require.NoError(t, db.Model(&models.UserAlbumData{}).Where("album_id = ?", album.ID).Count(&rows).Error)
	require.EqualValues(t, 2, rows, "the same album must keep independent rows for each user")

	require.NoError(t, db.Delete(userOne).Error)
	require.NoError(t, db.Model(&models.UserAlbumData{}).Where("album_id = ?", album.ID).Count(&rows).Error)
	require.EqualValues(t, 1, rows, "deleting one user must only cascade that user's row")

	require.NoError(t, db.Delete(&album).Error)
	require.NoError(t, db.Model(&models.UserAlbumData{}).Where("album_id = ?", album.ID).Count(&rows).Error)
	require.EqualValues(t, 0, rows, "deleting an album must cascade all of its viewer state")
}
