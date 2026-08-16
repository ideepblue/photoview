import english from '../extractedTranslations/en/translation.json'
import simplifiedChinese from '../extractedTranslations/zh-CN/translation.json'
import hongKongChinese from '../extractedTranslations/zh-HK/translation.json'
import traditionalChinese from '../extractedTranslations/zh-TW/translation.json'

const customUiKeys = [
  'album_engagement.view_count',
  'album_featured.add',
  'album_featured.error',
  'album_featured.remove',
  'album_filter.albums.all',
  'album_filter.albums.all_short',
  'album_filter.albums.only_featured',
  'album_filter.albums.sort',
  'album_filter.albums.sort_direction',
  'album_filter.albums.unviewed',
  'album_filter.albums.unviewed_short',
  'album_filter.albums.view_status',
  'album_filter.albums.viewed',
  'album_filter.albums.viewed_short',
  'album_filter.sorting_options.last_viewed_at',
  'album_filter.sorting_options.view_count',
  'album_layout.album_badge',
  'album_layout.columns_2',
  'album_layout.columns_3',
  'album_layout.columns_4',
  'album_layout.label',
  'album_layout.list',
  'album_layout.photos',
  'album_layout.subalbums',
  'album_navigation.back_to_albums',
  'album_navigation.back_to_parent',
  'album_navigation.breadcrumb',
  'album_navigation.options',
  'album_navigation.handedness.description',
  'album_navigation.handedness.left',
  'album_navigation.handedness.preferred_hand',
  'album_navigation.handedness.right',
  'album_navigation.handedness.title',
  'album_scan.action',
  'album_scan.complete',
  'album_scan.confirm_description',
  'album_scan.confirm_title',
  'album_scan.continue',
  'album_scan.current_only',
  'album_scan.force_hint',
  'album_scan.force_refresh',
  'album_scan.queued',
  'album_scan.recursive',
  'album_scan.refresh_failed',
  'album_scan.scanning',
  'album_scan.scope',
  'album_scan.start',
  'album_scan.start_failed',
  'album_scan.starting',
  'album_scan.unknown_error',
  'photos_page.open_details',
  'present_view.quality.high_res',
  'present_view.quality.thumbnail',
  'present_view.display_options.filename',
  'present_view.display_options.open',
  'present_view.display_options.position',
  'present_view.display_options.title',
  'present_view.navigation.exit',
  'present_view.navigation.next',
  'present_view.navigation.previous',
  'pwa.pull_to_refresh.pull',
  'pwa.pull_to_refresh.refreshing',
  'pwa.pull_to_refresh.release',
  'sidebar.album.album_cover',
  'sidebar.album.cover_set_for',
  'sidebar.album.reset_cover',
  'sidebar.album.set_cover',
  'sidebar.album.set_cover_failed',
  'sidebar.album.set_cover_for_current',
  'sidebar.album.set_cover_for_parent',
  'sidebar.album.set_cover_help',
  'settings.user_preferences.home_page.albums',
  'settings.user_preferences.home_page.description',
  'settings.user_preferences.home_page.timeline',
  'settings.user_preferences.home_page.title',
] as const

const resources = {
  en: english,
  'zh-CN': simplifiedChinese,
  'zh-HK': hongKongChinese,
  'zh-TW': traditionalChinese,
}

const valueAtPath = (resource: object, path: string) =>
  path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[segment]
  }, resource)

test.each(Object.entries(resources))(
  '%s contains every customized UI translation',
  (locale, resource) => {
    const missing = customUiKeys.filter(key => {
      const value = valueAtPath(resource, key)
      return typeof value !== 'string' || value.trim() === ''
    })

    expect(missing).toEqual([])

    if (locale !== 'en') {
      const stillEnglish = customUiKeys.filter(
        key => valueAtPath(resource, key) === valueAtPath(english, key)
      )
      expect(stillEnglish).toEqual([])
    }
  }
)
