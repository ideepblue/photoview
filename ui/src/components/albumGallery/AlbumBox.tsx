import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ProtectedImage } from '../photoGallery/ProtectedMedia'
import { albumQuery_album_subAlbums } from '../../Pages/AlbumPage/__generated__/albumQuery'

interface AlbumBoxImageProps {
  src?: string
}

const AlbumBoxImage = ({ src, ...props }: AlbumBoxImageProps) => {
  const [loaded, setLoaded] = useState(false)

  let image = null
  if (src) {
    image = (
      <ProtectedImage
        className="absolute inset-0 object-cover object-center w-full h-full rounded-lg"
        {...props}
        onLoad={() => setLoaded(true)}
        src={src}
      />
    )
  }

  let placeholder = null
  if (!loaded) {
    placeholder = (
      <div className="bg-gray-100 dark:bg-[#191c1f] animate-pulse w-full h-full rounded-lg absolute inset-0"></div>
    )
  }

  return (
    <div className="w-full h-0 pb-[133.333333%] xs:pb-0 xs:w-[220px] xs:h-[220px] relative rounded-lg">
      {image}
      {placeholder}
    </div>
  )
}

type AlbumBoxProps = {
  album?: albumQuery_album_subAlbums
  customLink?: string
}

export const AlbumBox = ({ album, customLink, ...props }: AlbumBoxProps) => {
  const wrapperClasses =
    'block w-full text-center text-gray-900 dark:text-gray-200 xs:inline-block xs:mx-3 xs:my-2 xs:h-60 xs:w-[220px]'

  if (album) {
    return (
      <Link
        to={customLink || `/album/${album.id}`}
        className={wrapperClasses}
        {...props}
      >
        <AlbumBoxImage src={album.thumbnail?.thumbnail?.url} />
        <p className="whitespace-nowrap overflow-hidden overflow-ellipsis">
          {album.title}
        </p>
      </Link>
    )
  }

  return (
    <div className={wrapperClasses} {...props}>
      <AlbumBoxImage />
    </div>
  )
}
