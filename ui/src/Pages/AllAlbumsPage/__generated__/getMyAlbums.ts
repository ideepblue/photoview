/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import {
  OrderDirection,
  AlbumViewFilter,
} from "./../../../__generated__/globalTypes";

// ====================================================
// GraphQL query operation: getMyAlbums
// ====================================================

export interface getMyAlbums_myAlbums_viewerState {
  __typename: "AlbumViewerState";
  featured: boolean;
  viewCount: number;
  lastViewedAt: Time | null;
}

export interface getMyAlbums_myAlbums_thumbnail_thumbnail {
  __typename: "MediaURL";
  /**
   * URL for previewing the image
   */
  url: string;
  /**
   * Width of the image in pixels
   */
  width: number;
  /**
   * Height of the image in pixels
   */
  height: number;
}

export interface getMyAlbums_myAlbums_thumbnail {
  __typename: "Media";
  id: string;
  /**
   * URL to display the media in a smaller resolution
   */
  thumbnail: getMyAlbums_myAlbums_thumbnail_thumbnail | null;
}

export interface getMyAlbums_myAlbums {
  __typename: "Album";
  id: string;
  title: string;
  /**
   * Viewing and personal curation state for the logged-in user
   */
  viewerState: getMyAlbums_myAlbums_viewerState;
  /**
   * An image in this album used for previewing this album
   */
  thumbnail: getMyAlbums_myAlbums_thumbnail | null;
}

export interface getMyAlbums {
  /**
   * List of albums owned by the logged in user.
   */
  myAlbums: getMyAlbums_myAlbums[];
}

export interface getMyAlbumsVariables {
  orderBy?: string | null;
  orderDirection?: OrderDirection | null;
  viewFilter?: AlbumViewFilter | null;
  onlyFeatured?: boolean | null;
}
