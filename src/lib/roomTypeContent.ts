// The site's 4 real, guest-facing room types — the single source of
// truth for their marketing copy (long editorial paragraph + full
// amenities list, used by the homepage's Our Rooms section and the
// /rooms room-type detail modal) and compact spec-line copy (used by the
// /rooms row list). Previously this content lived only in the homepage's
// page.tsx, duplicated by hand wherever else it was needed — centralized
// here so both pages can never drift out of sync.
//
// There's no RoomTypes table in the database — every physical room is
// its own row in Rooms, with `name` duplicated identically across every
// physical instance of a type (e.g. all 5 Studio rows share
// name: "Studio Room"). `dbName` below is that exact value, used to
// group physical Rooms rows into one of these 4 types; `representative
// RoomNumber` is one specific physical room of that type, used only for
// its cover photo / gallery folder (see roomImages.ts) — never shown to
// guests as a room number anywhere this content is used.
export type RoomTypeKey = 'standard' | 'studio' | 'deluxe' | 'suite'

export type RoomTypeContent = {
  key: RoomTypeKey
  // Exact Rooms.name value shared by every physical room of this type —
  // the grouping key /rooms/page.tsx matches against.
  dbName: string
  // Display heading — matches the homepage's existing Our Rooms labels
  // exactly (kept as-is rather than switched to the longer dbName, so
  // the homepage's own copy doesn't change as a side effect of this).
  label: string
  // Broad category shown in the /rooms card's eyebrow — matches
  // Rooms.room_type ('Standard' | 'Studio' | '1-Bedroom'). Deliberately
  // not room-instance info (no room number/floor) per the "guests only
  // ever see the type" requirement.
  category: string
  // Compact spec-line amenities for the /rooms row list — a shorter,
  // terser subset/labeling than `amenities` below (e.g. "Ensuite
  // bathroom" not "Ensuite bathroom with shower", no Iron), each with a
  // matching entry in amenityIcons.ts so the row can show icon+label
  // pairs rather than plain text.
  rowAmenities: string[]
  longDescription: string
  amenities: string[]
  representativeRoomNumber: string
}

// Plain-text join of rowAmenities, dot-separated — for anywhere a bare
// string is more useful than icon chips (image alt text, aria-labels,
// meta descriptions). Kept as a derived function rather than a hand-typed
// duplicate field, so it can never drift from rowAmenities.
export function shortDescriptionFor(content: RoomTypeContent): string {
  return content.rowAmenities.join(' · ')
}

export const ROOM_TYPE_ORDER: RoomTypeKey[] = ['standard', 'studio', 'deluxe', 'suite']

export const ROOM_TYPE_CONTENT: Record<RoomTypeKey, RoomTypeContent> = {
  standard: {
    key: 'standard',
    dbName: 'Standard Room',
    label: 'Standard Room',
    category: 'Standard',
    rowAmenities: ['King bed', 'Ensuite bathroom', 'Smart TV', 'Free Wi-Fi', 'Air conditioning'],
    longDescription:
      'Relax in this charming bedroom, perfect for solo travelers, couples, or remote workers. The space features a comfortable bedroom and a clean ensuite bathroom, with a dedicated workstation that makes it easy to stay productive during your stay. Enjoy a peaceful atmosphere and all the essentials you need for a comfortable visit.',
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
    ],
    representativeRoomNumber: '104',
  },
  studio: {
    key: 'studio',
    dbName: 'Studio Room',
    label: 'Studio',
    category: 'Studio',
    rowAmenities: [
      'King bed',
      'Dry kitchenette',
      'Ensuite bathroom',
      'Smart TV',
      'Free Wi-Fi',
      'Air conditioning',
    ],
    longDescription:
      "This charming, private studio suits solo travelers, couples, or remote workers just as well. Alongside a comfortable bedroom and a clean ensuite bathroom, you'll find a convenient dry kitchenette equipped for light cooking — handy for those who'd rather keep meals simple. A dedicated workstation keeps you productive, and every essential is on hand for a comfortable, peaceful stay.",
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
      'Dry Kitchenette',
    ],
    representativeRoomNumber: '107',
  },
  deluxe: {
    key: 'deluxe',
    dbName: '1-Bedroom Deluxe',
    label: '1-Bedroom Deluxe',
    category: '1-Bedroom',
    rowAmenities: [
      'King bed',
      'Living area',
      'Dry kitchenette',
      'Ensuite bathroom',
      'Smart TV',
      'Free Wi-Fi',
    ],
    longDescription:
      "A charming, private one-bedroom apartment built for solo travelers, couples, or remote workers who'd like a bit more room to spread out. It brings together a comfortable bedroom, a bright living room, a clean ensuite bathroom, and a dry kitchenette for light cooking, plus a dedicated workstation for getting things done. A peaceful atmosphere throughout, with everything you need for a comfortable stay.",
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
      'Dry Kitchenette',
      'Living area',
    ],
    representativeRoomNumber: '106',
  },
  suite: {
    key: 'suite',
    dbName: '1-Bedroom Suite',
    label: '1-Bedroom Suite',
    category: '1-Bedroom',
    rowAmenities: [
      'King bed',
      'Living area',
      'Guest toilet',
      'Dry kitchenette',
      'Ensuite bathroom',
      'Smart TV',
      'Free Wi-Fi',
    ],
    longDescription:
      "The Residence's most complete one-bedroom apartment — private, charming, and suited to solo travelers, couples, or remote workers alike. Beyond the comfortable bedroom, bright living room, and dry kitchenette for light cooking, a separate guest toilet makes it easy to host without compromise. A dedicated workstation and a peaceful atmosphere round out everything you need for a comfortable stay.",
    amenities: [
      'King bed',
      'Air conditioning',
      'Smart TV',
      'Iron',
      'Free Wi-Fi',
      'Ensuite bathroom with shower',
      'Dry Kitchenette',
      'Living area',
      'Guest Toilet',
    ],
    representativeRoomNumber: '102',
  },
}

export function getRoomTypeContentByDbName(dbName: string): RoomTypeContent | null {
  return Object.values(ROOM_TYPE_CONTENT).find((content) => content.dbName === dbName) ?? null
}
