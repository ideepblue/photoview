package actions_test

import (
	"testing"
	"time"

	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/graphql/models/actions"
	"github.com/photoview/photoview/api/test_utils"
	"github.com/stretchr/testify/require"
)

func ordering(orderBy string, direction models.OrderDirection) *models.Ordering {
	return &models.Ordering{OrderBy: &orderBy, OrderDirection: &direction}
}

func albumTitles(albums []*models.Album) []string {
	titles := make([]string, len(albums))
	for index, album := range albums {
		titles[index] = album.Title
	}
	return titles
}

func TestSubAlbumsFiltersOnlyDirectChildrenForCurrentUser(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	user, err := models.RegisterUser(db, "filter-viewer", nil, false)
	require.NoError(t, err)
	otherUser, err := models.RegisterUser(db, "other-filter-viewer", nil, false)
	require.NoError(t, err)

	root := models.Album{Title: "Root", Path: "/albums"}
	require.NoError(t, db.Create(&root).Error)
	require.NoError(t, db.Model(user).Association("Albums").Append(&root))
	require.NoError(t, db.Model(otherUser).Association("Albums").Append(&root))

	children := []models.Album{
		{Title: "A viewed", Path: "/albums/a", ParentAlbumID: &root.ID},
		{Title: "B viewed featured", Path: "/albums/b", ParentAlbumID: &root.ID},
		{Title: "C unviewed featured", Path: "/albums/c", ParentAlbumID: &root.ID},
		{Title: "D unviewed", Path: "/albums/d", ParentAlbumID: &root.ID},
	}
	require.NoError(t, db.Create(&children).Error)
	grandchild := models.Album{Title: "E nested viewed", Path: "/albums/a/e", ParentAlbumID: &children[0].ID}
	require.NoError(t, db.Create(&grandchild).Error)

	viewedA := time.Date(2026, time.August, 16, 10, 0, 0, 0, time.UTC)
	viewedB := time.Date(2026, time.August, 16, 12, 0, 0, 0, time.UTC)
	require.NoError(t, db.Create(&[]models.UserAlbumData{
		{UserID: user.ID, AlbumID: children[0].ID, ViewCount: 5, LastViewedAt: &viewedA, LastCountedAt: &viewedA},
		{UserID: user.ID, AlbumID: children[1].ID, Featured: true, ViewCount: 2, LastViewedAt: &viewedB, LastCountedAt: &viewedB},
		{UserID: user.ID, AlbumID: children[2].ID, Featured: true},
		{UserID: user.ID, AlbumID: grandchild.ID, Featured: true, ViewCount: 99, LastViewedAt: &viewedB, LastCountedAt: &viewedB},
		{UserID: otherUser.ID, AlbumID: children[3].ID, Featured: true, ViewCount: 100, LastViewedAt: &viewedB, LastCountedAt: &viewedB},
	}).Error)

	tests := []struct {
		name   string
		filter *actions.AlbumEngagementFilter
		want   []string
	}{
		{name: "all", want: []string{"A viewed", "B viewed featured", "C unviewed featured", "D unviewed"}},
		{name: "viewed", filter: &actions.AlbumEngagementFilter{ViewStatus: actions.AlbumViewStatusViewed}, want: []string{"A viewed", "B viewed featured"}},
		{name: "unviewed", filter: &actions.AlbumEngagementFilter{ViewStatus: actions.AlbumViewStatusUnviewed}, want: []string{"C unviewed featured", "D unviewed"}},
		{name: "featured", filter: &actions.AlbumEngagementFilter{OnlyFeatured: true}, want: []string{"B viewed featured", "C unviewed featured"}},
		{name: "viewed featured", filter: &actions.AlbumEngagementFilter{ViewStatus: actions.AlbumViewStatusViewed, OnlyFeatured: true}, want: []string{"B viewed featured"}},
		{name: "unviewed featured", filter: &actions.AlbumEngagementFilter{ViewStatus: actions.AlbumViewStatusUnviewed, OnlyFeatured: true}, want: []string{"C unviewed featured"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			albums, err := actions.SubAlbums(db, user, root.ID, ordering("title", models.OrderDirectionAsc), nil, test.filter)
			require.NoError(t, err)
			require.Equal(t, test.want, albumTitles(albums))
		})
	}

	all, err := actions.SubAlbums(db, user, root.ID, ordering("title", models.OrderDirectionAsc), nil, nil)
	require.NoError(t, err)
	require.EqualValues(t, 5, all[0].ViewerState.ViewCount)
	require.True(t, all[1].ViewerState.Featured)
	require.EqualValues(t, 0, all[3].ViewerState.ViewCount, "another user's row must not leak into this user's cards")
	require.False(t, all[3].ViewerState.Featured)
}

func TestSubAlbumsOrdersActivityAndKeepsUnviewedLastForRecentSort(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	user, err := models.RegisterUser(db, "sort-viewer", nil, false)
	require.NoError(t, err)
	root := models.Album{Title: "Root", Path: "/sorted"}
	require.NoError(t, db.Create(&root).Error)
	require.NoError(t, db.Model(user).Association("Albums").Append(&root))

	children := []models.Album{
		{Title: "Alpha", Path: "/sorted/a", ParentAlbumID: &root.ID},
		{Title: "Beta", Path: "/sorted/b", ParentAlbumID: &root.ID},
		{Title: "Charlie", Path: "/sorted/c", ParentAlbumID: &root.ID},
		{Title: "Delta", Path: "/sorted/d", ParentAlbumID: &root.ID},
	}
	require.NoError(t, db.Create(&children).Error)
	older := time.Date(2026, time.August, 16, 8, 0, 0, 0, time.UTC)
	newer := time.Date(2026, time.August, 16, 9, 0, 0, 0, time.UTC)
	require.NoError(t, db.Create(&[]models.UserAlbumData{
		{UserID: user.ID, AlbumID: children[0].ID, ViewCount: 9, LastViewedAt: &older, LastCountedAt: &older},
		{UserID: user.ID, AlbumID: children[1].ID, ViewCount: 3, LastViewedAt: &newer, LastCountedAt: &newer},
		{UserID: user.ID, AlbumID: children[2].ID},
	}).Error)

	byCount, err := actions.SubAlbums(db, user, root.ID, ordering("view_count", models.OrderDirectionDesc), nil, nil)
	require.NoError(t, err)
	require.Equal(t, []string{"Alpha", "Beta", "Charlie", "Delta"}, albumTitles(byCount))

	recentDescending, err := actions.SubAlbums(db, user, root.ID, ordering("last_viewed_at", models.OrderDirectionDesc), nil, nil)
	require.NoError(t, err)
	require.Equal(t, []string{"Beta", "Alpha", "Charlie", "Delta"}, albumTitles(recentDescending))

	recentAscending, err := actions.SubAlbums(db, user, root.ID, ordering("last_viewed_at", models.OrderDirectionAsc), nil, nil)
	require.NoError(t, err)
	require.Equal(t, []string{"Alpha", "Beta", "Charlie", "Delta"}, albumTitles(recentAscending), "unviewed albums must remain last in either direction")
}

func TestMyAlbumsAppliesEngagementToCurrentRootDirectory(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	user, err := models.RegisterUser(db, "root-filter-viewer", nil, false)
	require.NoError(t, err)

	roots := []models.Album{
		{Title: "Root viewed", Path: "/root-viewed"},
		{Title: "Root unviewed", Path: "/root-unviewed"},
	}
	require.NoError(t, db.Model(user).Association("Albums").Append(&roots))
	require.NoError(t, db.Create(&models.UserAlbumData{UserID: user.ID, AlbumID: roots[0].ID, ViewCount: 4}).Error)

	trueValue := true
	albums, err := actions.MyAlbums(
		db,
		user,
		ordering("view_count", models.OrderDirectionDesc),
		nil,
		&trueValue,
		&trueValue,
		nil,
		&actions.AlbumEngagementFilter{ViewStatus: actions.AlbumViewStatusViewed},
	)
	require.NoError(t, err)
	require.Equal(t, []string{"Root viewed"}, albumTitles(albums))
	require.EqualValues(t, 4, albums[0].ViewerState.ViewCount)
}
