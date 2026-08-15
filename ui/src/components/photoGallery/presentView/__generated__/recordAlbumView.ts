/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL mutation operation: recordAlbumView
// ====================================================

export interface recordAlbumView_recordAlbumView {
  __typename: "AlbumViewerState";
  featured: boolean;
  viewCount: number;
  lastViewedAt: Time | null;
}

export interface recordAlbumView {
  /**
   * Record a qualifying fullscreen presentation for an album
   */
  recordAlbumView: recordAlbumView_recordAlbumView;
}

export interface recordAlbumViewVariables {
  albumId: string;
  mediaId: string;
}
