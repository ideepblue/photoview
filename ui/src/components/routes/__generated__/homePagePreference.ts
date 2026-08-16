/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: homePagePreference
// ====================================================

export interface homePagePreference_myUserPreferences {
  __typename: 'UserPreferences'
  id: string
  homePage: string
}

export interface homePagePreference {
  /**
   * User preferences for the logged in user
   */
  myUserPreferences: homePagePreference_myUserPreferences
}
