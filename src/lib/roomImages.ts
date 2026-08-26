import fs from 'fs'
import path from 'path'

const ROOMS_IMAGES_DIR = path.join(process.cwd(), 'public', 'images')
const GALLERY_IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'gallery')
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

/**
 * Every photo in public/images/gallery/ — the general (not room-specific)
 * gallery shown on the homepage's "Around the residence" section. No
 * cover-file convention here, unlike per-room galleries. Sorted with
 * `numeric: true` rather than a plain string sort, since these files are
 * named "1.jpg", "2.jpg", ... "10.jpg" — a plain sort would order "10"
 * right after "1" and before "2". Works for any number of files, in any
 * naming scheme, not just this one.
 */
export function getGalleryImages(): string[] {
  let files: string[]
  try {
    files = fs.readdirSync(GALLERY_IMAGES_DIR).filter((file) => IMAGE_EXTENSIONS.test(file))
  } catch {
    return []
  }
  return files
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => `/images/gallery/${file}`)
}
