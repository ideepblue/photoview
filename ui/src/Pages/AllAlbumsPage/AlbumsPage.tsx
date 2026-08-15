import React from 'react'
import AlbumBoxes from '../../components/albumGallery/AlbumBoxes'
import Layout from '../../components/layout/Layout'
import { useQuery, gql } from '@apollo/client'
import { getMyAlbums, getMyAlbumsVariables } from './__generated__/getMyAlbums'
import useURLParameters from '../../hooks/useURLParameters'
import AlbumFilter from '../../components/album/AlbumFilter'
import useAlbumEngagementParams from '../../hooks/useAlbumEngagementParams'
import { AlbumViewFilter } from '../../__generated__/globalTypes'

const getAlbumsQuery = gql`
  query getMyAlbums(
    $orderBy: String
    $orderDirection: OrderDirection
    $viewFilter: AlbumViewFilter
    $onlyFeatured: Boolean
  ) {
    myAlbums(
      order: { order_by: $orderBy, order_direction: $orderDirection }
      onlyRoot: true
      showEmpty: true
      viewFilter: $viewFilter
      onlyFeatured: $onlyFeatured
    ) {
      id
      title
      viewerState {
        featured
        viewCount
        lastViewedAt
      }
      thumbnail {
        id
        thumbnail {
          url
          width
          height
        }
      }
    }
  }
`

const AlbumsPage = () => {
  const urlParams = useURLParameters()
  const albumEngagement = useAlbumEngagementParams(urlParams)

  const { error, data } = useQuery<getMyAlbums, getMyAlbumsVariables>(
    getAlbumsQuery,
    {
      variables: {
        orderBy: albumEngagement.ordering.orderBy,
        orderDirection: albumEngagement.ordering.orderDirection,
        viewFilter:
          albumEngagement.viewStatus === 'viewed'
            ? AlbumViewFilter.VIEWED
            : albumEngagement.viewStatus === 'unviewed'
            ? AlbumViewFilter.UNVIEWED
            : null,
        onlyFeatured: albumEngagement.onlyFeatured,
      },
    }
  )

  return (
    <Layout title="Albums">
      <AlbumFilter
        onlyFavorites={false}
        albumEngagement={albumEngagement}
      />
      <AlbumBoxes error={error} albums={data?.myAlbums} />
    </Layout>
  )
}

export default AlbumsPage
