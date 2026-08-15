package resolvers

import (
	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/graphql/models/actions"
)

func albumViewerState(state *models.UserAlbumData) *models.AlbumViewerState {
	return &models.AlbumViewerState{
		Featured:     state.Featured,
		ViewCount:    int(state.ViewCount),
		LastViewedAt: state.LastViewedAt,
	}
}

func albumEngagementFilter(viewFilter *models.AlbumViewFilter, onlyFeatured *bool) *actions.AlbumEngagementFilter {
	if viewFilter == nil && onlyFeatured == nil {
		return nil
	}

	filter := &actions.AlbumEngagementFilter{}
	if onlyFeatured != nil {
		filter.OnlyFeatured = *onlyFeatured
	}
	if viewFilter != nil {
		switch *viewFilter {
		case models.AlbumViewFilterViewed:
			filter.ViewStatus = actions.AlbumViewStatusViewed
		case models.AlbumViewFilterUnviewed:
			filter.ViewStatus = actions.AlbumViewStatusUnviewed
		}
	}

	return filter
}
