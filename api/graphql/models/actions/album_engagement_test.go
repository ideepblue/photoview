package actions_test

import (
	"sync"
	"testing"
	"time"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/graphql/models/actions"
	"github.com/photoview/photoview/api/test_utils"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type albumEngagementFixture struct {
	db           *gorm.DB
	user         *models.User
	otherUser    *models.User
	album        *models.Album
	childAlbum   *models.Album
	outsideAlbum *models.Album
	media        *models.Media
	childMedia   *models.Media
	outsideMedia *models.Media
}

func newAlbumEngagementFixture(t *testing.T) albumEngagementFixture {
	t.Helper()
	db := test_utils.DatabaseTest(t)

	user, err := models.RegisterUser(db, "album-viewer", nil, false)
	require.NoError(t, err)
	otherUser, err := models.RegisterUser(db, "other-album-viewer", nil, false)
	require.NoError(t, err)

	album := models.Album{Title: "Trip", Path: "/photos/trip"}
	require.NoError(t, db.Create(&album).Error)
	childAlbum := models.Album{Title: "Day one", Path: "/photos/trip/day-one", ParentAlbumID: &album.ID}
	require.NoError(t, db.Create(&childAlbum).Error)
	outsideAlbum := models.Album{Title: "Private", Path: "/photos/private"}
	require.NoError(t, db.Create(&outsideAlbum).Error)
	require.NoError(t, db.Model(user).Association("Albums").Append(album))

	media := models.Media{Title: "trip.jpg", Path: "/photos/trip/trip.jpg", AlbumID: album.ID, Type: models.MediaTypePhoto}
	require.NoError(t, db.Create(&media).Error)
	childMedia := models.Media{Title: "day-one.jpg", Path: "/photos/trip/day-one/day-one.jpg", AlbumID: childAlbum.ID, Type: models.MediaTypePhoto}
	require.NoError(t, db.Create(&childMedia).Error)
	outsideMedia := models.Media{Title: "private.jpg", Path: "/photos/private/private.jpg", AlbumID: outsideAlbum.ID, Type: models.MediaTypePhoto}
	require.NoError(t, db.Create(&outsideMedia).Error)

	return albumEngagementFixture{
		db:           db,
		user:         user,
		otherUser:    otherUser,
		album:        &album,
		childAlbum:   &childAlbum,
		outsideAlbum: &outsideAlbum,
		media:        &media,
		childMedia:   &childMedia,
		outsideMedia: &outsideMedia,
	}
}

func TestRecordAlbumViewUsesRollingThirtyMinuteWindow(t *testing.T) {
	fixture := newAlbumEngagementFixture(t)
	firstView := time.Date(2026, time.August, 16, 8, 0, 0, 0, time.UTC)

	state, err := actions.RecordAlbumView(fixture.db, fixture.user, fixture.album.ID, fixture.media.ID, firstView)
	require.NoError(t, err)
	require.EqualValues(t, 1, state.ViewCount)
	require.True(t, state.LastViewedAt.Equal(firstView))
	require.True(t, state.LastCountedAt.Equal(firstView))

	withinWindow := firstView.Add(29*time.Minute + 59*time.Second)
	state, err = actions.RecordAlbumView(fixture.db, fixture.user, fixture.album.ID, fixture.media.ID, withinWindow)
	require.NoError(t, err)
	require.EqualValues(t, 1, state.ViewCount, "a view before 30 minutes must not increment")
	require.True(t, state.LastViewedAt.Equal(withinWindow), "qualifying views still advance recent activity")
	require.True(t, state.LastCountedAt.Equal(firstView))

	atBoundary := firstView.Add(30 * time.Minute)
	state, err = actions.RecordAlbumView(fixture.db, fixture.user, fixture.album.ID, fixture.media.ID, atBoundary)
	require.NoError(t, err)
	require.EqualValues(t, 2, state.ViewCount, "a view exactly 30 minutes later must increment")
	require.True(t, state.LastViewedAt.Equal(atBoundary))
	require.True(t, state.LastCountedAt.Equal(atBoundary))

	otherState, err := actions.RecordAlbumView(fixture.db, fixture.otherUser, fixture.album.ID, fixture.media.ID, atBoundary)
	require.Error(t, err)
	require.Nil(t, otherState, "a user without album access must not create viewer state")

	require.NoError(t, fixture.db.Model(fixture.otherUser).Association("Albums").Append(fixture.album))
	otherState, err = actions.RecordAlbumView(fixture.db, fixture.otherUser, fixture.album.ID, fixture.media.ID, atBoundary)
	require.NoError(t, err)
	require.EqualValues(t, 1, otherState.ViewCount, "each authorized user must have an independent count")
}

func TestRecordAlbumViewRequiresDirectMediaMembership(t *testing.T) {
	fixture := newAlbumEngagementFixture(t)
	now := time.Date(2026, time.August, 16, 9, 0, 0, 0, time.UTC)

	state, err := actions.RecordAlbumView(fixture.db, fixture.user, fixture.album.ID, fixture.childMedia.ID, now)
	require.EqualError(t, err, "media does not belong directly to album")
	require.Nil(t, state)

	state, err = actions.RecordAlbumView(fixture.db, fixture.user, fixture.outsideAlbum.ID, fixture.outsideMedia.ID, now)
	require.EqualError(t, err, "forbidden")
	require.Nil(t, state)

	state, err = actions.RecordAlbumView(fixture.db, fixture.user, fixture.childAlbum.ID, fixture.childMedia.ID, now)
	require.NoError(t, err, "ownership inherited from an ancestor must allow the exact child album")
	require.EqualValues(t, 1, state.ViewCount)
}

func TestSetAlbumFeaturedPreservesViewingStateAndIsPerUser(t *testing.T) {
	fixture := newAlbumEngagementFixture(t)
	viewedAt := time.Date(2026, time.August, 16, 10, 0, 0, 0, time.UTC)

	viewed, err := actions.RecordAlbumView(fixture.db, fixture.user, fixture.album.ID, fixture.media.ID, viewedAt)
	require.NoError(t, err)

	featured, err := actions.SetAlbumFeatured(fixture.db, fixture.user, fixture.album.ID, true)
	require.NoError(t, err)
	require.True(t, featured.Featured)
	require.Equal(t, viewed.ViewCount, featured.ViewCount)
	require.Equal(t, viewed.LastViewedAt, featured.LastViewedAt)
	require.Equal(t, viewed.LastCountedAt, featured.LastCountedAt)

	unfeatured, err := actions.SetAlbumFeatured(fixture.db, fixture.user, fixture.album.ID, false)
	require.NoError(t, err)
	require.False(t, unfeatured.Featured)
	require.EqualValues(t, 1, unfeatured.ViewCount)

	otherState, err := actions.SetAlbumFeatured(fixture.db, fixture.otherUser, fixture.album.ID, true)
	require.Error(t, err)
	require.Nil(t, otherState)

	require.NoError(t, fixture.db.Model(fixture.otherUser).Association("Albums").Append(fixture.album))
	otherState, err = actions.SetAlbumFeatured(fixture.db, fixture.otherUser, fixture.album.ID, true)
	require.NoError(t, err)
	require.True(t, otherState.Featured)

	var originalState models.UserAlbumData
	require.NoError(t, fixture.db.First(&originalState, "user_id = ? AND album_id = ?", fixture.user.ID, fixture.album.ID).Error)
	require.False(t, originalState.Featured, "another user's curation must not change this user's state")
	require.EqualValues(t, 1, originalState.ViewCount)
}

func TestRecordAlbumViewDeduplicatesConcurrentRequests(t *testing.T) {
	fixture := newAlbumEngagementFixture(t)
	now := time.Date(2026, time.August, 16, 11, 0, 0, 0, time.UTC)

	const callers = 12
	start := make(chan struct{})
	errors := make(chan error, callers)
	var wait sync.WaitGroup
	wait.Add(callers)

	for range callers {
		go func() {
			defer wait.Done()
			<-start
			_, err := actions.RecordAlbumView(fixture.db, fixture.user, fixture.album.ID, fixture.media.ID, now)
			errors <- err
		}()
	}

	close(start)
	wait.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}

	var stored models.UserAlbumData
	require.NoError(t, fixture.db.First(&stored, "user_id = ? AND album_id = ?", fixture.user.ID, fixture.album.ID).Error)
	require.EqualValues(t, 1, stored.ViewCount, "concurrent devices must increment once inside the same window")
}
