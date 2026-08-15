/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL mutation operation: setAlbumFeatured
// ====================================================

export interface setAlbumFeatured_setAlbumFeatured {
  __typename: "AlbumViewerState";
  featured: boolean;
  viewCount: number;
  lastViewedAt: Time | null;
}

export interface setAlbumFeatured {
  /**
   * Set or clear personal curation for an album
   */
  setAlbumFeatured: setAlbumFeatured_setAlbumFeatured;
}

export interface setAlbumFeaturedVariables {
  albumId: string;
  featured: boolean;
}
