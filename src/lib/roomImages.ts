import fs from 'fs'
import path from 'path'

const ROOMS_IMAGES_DIR = path.join(process.cwd(), 'public', 'images')
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i

function listRoomFiles(roomNumber: string): string[] {
  try {
    return fs
      .readdirSync(path.join(ROOMS_IMAGES_DIR, roomNumber))
      .filter((file) => IMAGE_EXTENSIONS.test(file))
  } catch {
    return []
  }
}

/**
 * Cover photo (room_{roomNumber}.jpg) first, followed by the rest of the
 * folder's photos. Returns [] if the folder is missing/empty or has no
 * cover photo.
 */
export function getRoomGallery(roomNumber: string): string[] {
  const files = listRoomFiles(roomNumber)
  const coverName = `room_${roomNumber}.jpg`
  if (!files.includes(coverName)) return []

  const rest = files.filter((file) => file !== coverName).sort()
  return [coverName, ...rest].map((file) => `/images/${roomNumber}/${file}`)
}

export function getRoomCoverImage(roomNumber: string): string | null {
  const gallery = getRoomGallery(roomNumber)
  return gallery.length > 0 ? gallery[0] : null
}

/** One cover photo per photo-ready room folder, for homepage-style previews. */
export function getFeaturedRoomPhotos(maxPhotos = 9): string[] {
  let roomDirs: string[]
  try {
    roomDirs = fs
      .readdirSync(ROOMS_IMAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }

  const photos: string[] = []
  for (const roomNumber of roomDirs) {
    const cover = getRoomCoverImage(roomNumber)
    if (!cover) continue
    photos.push(cover)
    if (photos.length >= maxPhotos) break
  }
  return photos
}
