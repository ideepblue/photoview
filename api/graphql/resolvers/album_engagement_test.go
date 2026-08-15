package resolvers

import (
	"context"
	"testing"

	"github.com/photoview/photoview/api/graphql/auth"
	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/test_utils"
	"github.com/stretchr/testify/require"
)

func TestAlbumEngagementResolversAuthorizeAndExposeDefaultState(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	user, err := models.RegisterUser(db, "resolver-viewer", nil, false)
	require.NoError(t, err)

	album := models.Album{Title: "Resolver album", Path: "/resolver-album"}
	require.NoError(t, db.Create(&album).Error)
	require.NoError(t, db.Model(user).Association("Albums").Append(&album))
	media := models.Media{Title: "resolver.jpg", Path: "/resolver-album/resolver.jpg", AlbumID: album.ID, Type: models.MediaTypePhoto}
	require.NoError(t, db.Create(&media).Error)

	root := NewRootResolver(db)
	mutation := &mutationResolver{Resolver: &root}
	albumFields := &albumResolver{Resolver: &root}

	state, err := mutation.RecordAlbumView(context.Background(), album.ID, media.ID)
	require.ErrorIs(t, err, auth.ErrUnauthorized)
	require.Nil(t, state)

	ctx := auth.AddUserToContext(context.Background(), user)
	state, err = albumFields.ViewerState(ctx, &album)
	require.NoError(t, err)
	require.False(t, state.Featured)
	require.Equal(t, 0, state.ViewCount)
	require.Nil(t, state.LastViewedAt)

	state, err = mutation.RecordAlbumView(ctx, album.ID, media.ID)
	require.NoError(t, err)
	require.Equal(t, 1, state.ViewCount)
	require.NotNil(t, state.LastViewedAt)

	state, err = mutation.SetAlbumFeatured(ctx, album.ID, true)
	require.NoError(t, err)
	require.True(t, state.Featured)
	require.Equal(t, 1, state.ViewCount)
}

func TestAlbumResolversApplyViewerFiltersToDirectChildren(t *testing.T) {
	db := test_utils.DatabaseTest(t)
	user, err := models.RegisterUser(db, "resolver-filter-viewer", nil, false)
	require.NoError(t, err)
	rootAlbum := models.Album{Title: "Root", Path: "/resolver-filter"}
	require.NoError(t, db.Create(&rootAlbum).Error)
	require.NoError(t, db.Model(user).Association("Albums").Append(&rootAlbum))
	children := []models.Album{
		{Title: "Viewed", Path: "/resolver-filter/viewed", ParentAlbumID: &rootAlbum.ID},
		{Title: "Unviewed featured", Path: "/resolver-filter/featured", ParentAlbumID: &rootAlbum.ID},
	}
	require.NoError(t, db.Create(&children).Error)
	require.NoError(t, db.Create(&[]models.UserAlbumData{
		{UserID: user.ID, AlbumID: children[0].ID, ViewCount: 3},
		{UserID: user.ID, AlbumID: children[1].ID, Featured: true},
	}).Error)

	root := NewRootResolver(db)
	resolver := &albumResolver{Resolver: &root}
	ctx := auth.AddUserToContext(context.Background(), user)
	viewed := models.AlbumViewFilterViewed
	featured := true

	albums, err := resolver.SubAlbums(ctx, &rootAlbum, nil, nil, &viewed, nil)
	require.NoError(t, err)
	require.Equal(t, []string{"Viewed"}, albumTitlesForResolverTest(albums))

	albums, err = resolver.SubAlbums(ctx, &rootAlbum, nil, nil, nil, &featured)
	require.NoError(t, err)
	require.Equal(t, []string{"Unviewed featured"}, albumTitlesForResolverTest(albums))
}

func albumTitlesForResolverTest(albums []*models.Album) []string {
	titles := make([]string, len(albums))
	for index, album := range albums {
		titles[index] = album.Title
	}
	return titles
}
