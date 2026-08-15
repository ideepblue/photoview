package actions

import (
	"github.com/photoview/photoview/api/graphql/models"
	"github.com/pkg/errors"
	"gorm.io/gorm"
)

type AlbumViewStatus string

const (
	AlbumViewStatusAll      AlbumViewStatus = ""
	AlbumViewStatusViewed   AlbumViewStatus = "viewed"
	AlbumViewStatusUnviewed AlbumViewStatus = "unviewed"
)

type AlbumEngagementFilter struct {
	ViewStatus   AlbumViewStatus
	OnlyFeatured bool
}

func MyAlbums(db *gorm.DB, user *models.User, order *models.Ordering, paginate *models.Pagination,
	onlyRoot *bool, showEmpty *bool, onlyWithFavorites *bool, engagement *AlbumEngagementFilter) ([]*models.Album, error) {

	if err := user.FillAlbums(db); err != nil {
		return nil, err
	}

	if len(user.Albums) == 0 {
		return nil, nil
	}

	userAlbumIDs := make([]int, len(user.Albums))
	for i, album := range user.Albums {
		userAlbumIDs[i] = album.ID
	}

	query := db.Model(models.Album{}).Where("id IN (?)", userAlbumIDs)

	if onlyRoot != nil && *onlyRoot {

		singleRootAlbumID := getSingleRootAlbumID(user)

		if singleRootAlbumID != -1 && len(user.Albums) > 1 {
			query = query.Where("parent_album_id = ?", singleRootAlbumID)
		} else {
			query = query.Where("parent_album_id IS NULL OR parent_album_id NOT IN (?)", userAlbumIDs)
		}
	}

	query = favoritesQuery(showEmpty, db, onlyWithFavorites, user, query)

	query = formatAlbumEngagementSQL(query, user, order, paginate, engagement)

	var albums []*models.Album
	if err := query.Find(&albums).Error; err != nil {
		return nil, err
	}
	if err := attachAlbumViewerStates(db, user, albums); err != nil {
		return nil, err
	}

	return albums, nil
}

func SubAlbums(db *gorm.DB, user *models.User, parentAlbumID int, order *models.Ordering,
	paginate *models.Pagination, engagement *AlbumEngagementFilter) ([]*models.Album, error) {
	query := db.Model(&models.Album{}).Where("albums.parent_album_id = ?", parentAlbumID)
	query = formatAlbumEngagementSQL(query, user, order, paginate, engagement)

	var albums []*models.Album
	if err := query.Find(&albums).Error; err != nil {
		return nil, err
	}
	if err := attachAlbumViewerStates(db, user, albums); err != nil {
		return nil, err
	}

	return albums, nil
}

func formatAlbumEngagementSQL(query *gorm.DB, user *models.User, order *models.Ordering,
	paginate *models.Pagination, engagement *AlbumEngagementFilter) *gorm.DB {
	if user == nil {
		return models.FormatSQL(query, order, paginate)
	}

	query = query.Joins(
		"LEFT JOIN user_album_data AS album_viewer_state ON album_viewer_state.album_id = albums.id AND album_viewer_state.user_id = ?",
		user.ID,
	)

	if engagement != nil {
		switch engagement.ViewStatus {
		case AlbumViewStatusViewed:
			query = query.Where("COALESCE(album_viewer_state.view_count, 0) > 0")
		case AlbumViewStatusUnviewed:
			query = query.Where("COALESCE(album_viewer_state.view_count, 0) = 0")
		}
		if engagement.OnlyFeatured {
			query = query.Where("COALESCE(album_viewer_state.featured, FALSE) = TRUE")
		}
	}

	if order == nil || order.OrderBy == nil {
		return models.FormatSQL(query, order, paginate)
	}

	direction := "ASC"
	if order.OrderDirection != nil && *order.OrderDirection == models.OrderDirectionDesc {
		direction = "DESC"
	}

	switch *order.OrderBy {
	case "view_count":
		query = query.Order("COALESCE(album_viewer_state.view_count, 0) " + direction)
		query = query.Order("albums.title ASC")
		return models.FormatSQL(query, nil, paginate)
	case "last_viewed_at":
		query = query.Order("album_viewer_state.last_viewed_at IS NULL ASC")
		query = query.Order("album_viewer_state.last_viewed_at " + direction)
		query = query.Order("albums.title ASC")
		return models.FormatSQL(query, nil, paginate)
	default:
		return models.FormatSQL(query, order, paginate)
	}
}

func attachAlbumViewerStates(db *gorm.DB, user *models.User, albums []*models.Album) error {
	if user == nil || len(albums) == 0 {
		return nil
	}

	albumIDs := make([]int, len(albums))
	for index, album := range albums {
		albumIDs[index] = album.ID
		album.ViewerState = &models.UserAlbumData{UserID: user.ID, AlbumID: album.ID}
	}

	var states []models.UserAlbumData
	if err := db.Where("user_id = ? AND album_id IN (?)", user.ID, albumIDs).Find(&states).Error; err != nil {
		return err
	}

	statesByAlbum := make(map[int]*models.UserAlbumData, len(states))
	for index := range states {
		statesByAlbum[states[index].AlbumID] = &states[index]
	}
	for _, album := range albums {
		if state, ok := statesByAlbum[album.ID]; ok {
			album.ViewerState = state
		}
	}

	return nil
}

func getSingleRootAlbumID(user *models.User) int {
	var singleRootAlbumID int = -1
	for _, album := range user.Albums {
		if album.ParentAlbumID == nil {
			if singleRootAlbumID == -1 {
				singleRootAlbumID = album.ID
			} else {
				singleRootAlbumID = -1
				break
			}
		}
	}
	return singleRootAlbumID
}

func favoritesQuery(showEmpty *bool, db *gorm.DB, onlyWithFavorites *bool, user *models.User, query *gorm.DB) *gorm.DB {
	if showEmpty == nil || !*showEmpty {
		subQuery := db.Model(&models.Media{}).Where("album_id = albums.id")

		if onlyWithFavorites != nil && *onlyWithFavorites {
			favoritesSubquery := db.
				Model(&models.UserMediaData{UserID: user.ID}).
				Where("user_media_data.media_id = media.id").
				Where("user_media_data.favorite = true")

			subQuery = subQuery.Where("EXISTS (?)", favoritesSubquery)
		}

		query = query.Where("EXISTS (?)", subQuery)
	}
	return query
}

func Album(db *gorm.DB, user *models.User, id int) (*models.Album, error) {
	var album models.Album
	if err := db.First(&album, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("album not found")
		}
		return nil, err
	}

	ownsAlbum, err := user.OwnsAlbum(db, &album)
	if err != nil {
		return nil, err
	}

	if !ownsAlbum {
		return nil, errors.New("forbidden")
	}

	return &album, nil
}

func AlbumPath(db *gorm.DB, user *models.User, album *models.Album) ([]*models.Album, error) {
	var albumPath []*models.Album

	err := db.Raw(`
		WITH recursive path_albums AS (
			SELECT * FROM albums anchor WHERE anchor.id = ?
			UNION
			SELECT parent.* FROM path_albums child JOIN albums parent ON parent.id = child.parent_album_id
		)
		SELECT * FROM path_albums WHERE id != ?
	`, album.ID, album.ID).Scan(&albumPath).Error

	// Make sure to only return albums this user owns
	for i := len(albumPath) - 1; i >= 0; i-- {
		album := albumPath[i]

		owns, err := user.OwnsAlbum(db, album)
		if err != nil {
			return nil, err
		}

		if !owns {
			albumPath = albumPath[i+1:]
			break
		}

	}

	if err != nil {
		return nil, err
	}

	return albumPath, nil
}

func SetAlbumCover(db *gorm.DB, user *models.User, mediaID int) (*models.Album, error) {
	var media models.Media

	if err := db.First(&media, mediaID).Error; err != nil {
		return nil, err
	}

	return SetAlbumCoverForAlbum(db, user, mediaID, media.AlbumID)
}

func SetAlbumCoverForAlbum(db *gorm.DB, user *models.User, mediaID int, albumID int) (*models.Album, error) {
	var media models.Media
	if err := db.First(&media, mediaID).Error; err != nil {
		return nil, err
	}

	var album models.Album
	if err := db.First(&album, albumID).Error; err != nil {
		return nil, err
	}

	ownsAlbum, err := user.OwnsAlbum(db, &album)
	if err != nil {
		return nil, err
	}

	if !ownsAlbum {
		return nil, errors.New("forbidden")
	}

	var mediaAlbum models.Album
	if err := db.First(&mediaAlbum, media.AlbumID).Error; err != nil {
		return nil, err
	}
	ownsMediaAlbum, err := user.OwnsAlbum(db, &mediaAlbum)
	if err != nil {
		return nil, err
	}
	if !ownsMediaAlbum {
		return nil, errors.New("forbidden")
	}

	matchingAlbums, err := album.GetChildren(db, func(query *gorm.DB) *gorm.DB {
		return query.Where("id = ?", media.AlbumID)
	})
	if err != nil {
		return nil, err
	}
	if len(matchingAlbums) == 0 {
		return nil, errors.New("cover photo must belong to the album or one of its descendants")
	}

	if err := db.Model(&album).Update("cover_id", mediaID).Error; err != nil {
		return nil, err
	}

	return &album, nil
}

func ResetAlbumCover(db *gorm.DB, user *models.User, albumID int) (*models.Album, error) {
	var album models.Album
	if err := db.Find(&album, albumID).Error; err != nil {
		return nil, err
	}

	ownsAlbum, err := user.OwnsAlbum(db, &album)
	if err != nil {
		return nil, err
	}

	if !ownsAlbum {
		return nil, errors.New("forbidden")
	}

	if err := db.Model(&album).Update("cover_id", nil).Error; err != nil {
		return nil, err
	}

	return &album, nil
}
