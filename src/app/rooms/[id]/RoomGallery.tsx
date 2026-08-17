'use client'

import { useState } from 'react'

export default function RoomGallery({
  images,
  alt,
}: {
  images: string[]
  alt: string
}) {
  const [active, setActive] = useState(0)

  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-verdant/10">
        <div className="flex h-full w-full items-center justify-center text-xs tracking-widest text-verdant/40 uppercase">
          Photo coming soon
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-sm bg-verdant/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={alt}
          className="h-full w-full object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              aria-current={i === active}
              className={`aspect-square w-20 shrink-0 overflow-hidden rounded-sm border-2 transition-colors ${
                i === active
                  ? 'border-brass'
                  : 'border-transparent opacity-80 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={`${alt} ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
