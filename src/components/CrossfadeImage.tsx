'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

// 500-700ms ease-in-out, as requested — the middle of that range.
const TRANSITION_MS = 600

/**
 * Drop-in replacement for next/image's <Image> wherever `src` changes
 * over time (a gallery's active photo, a carousel's current slide) —
 * crossfades between the old and new photo instead of just popping to
 * the new src. Used by RoomGallery.tsx, GalleryLightbox.tsx, and
 * AroundTheResidence.tsx, which all previously hand-rolled the same
 * fade-out-then-swap-then-fade-in approach (see each file's own history)
 * — sequential, not a true crossfade, so there was a brief fully-
 * transparent gap between photos.
 *
 * Two permanent <Image> layers are stacked (absolutely positioned, same
 * box) and cross-faded via opacity only (no layout-affecting property
 * ever animates, so there's no layout shift) — both layers keep a
 * stable `key` across every src change, so neither is ever unmounted/
 * remounted the way a `key={src}` swap would. The incoming photo is
 * preloaded and `decode()`d off-screen before either layer's opacity
 * moves, so the fade never has to wait on the network or a half-
 * decoded bitmap mid-transition.
 *
 * Reduced motion: deliberately not handled here in JS — every current
 * caller renders inside `.guest-site`, and guest.css already forces
 * every transition there down to .01ms under `prefers-reduced-motion:
 * reduce` (see its own comment), which already satisfies "a very short
 * or no animation" without duplicating that check per-component.
 */
export default function CrossfadeImage({
  src,
  alt,
  className = '',
  ...imageProps
}: Omit<React.ComponentProps<typeof Image>, 'src' | 'alt'> & { src: string; alt: string }) {
  const [layers, setLayers] = useState<[string, string]>([src, src])
  const [front, setFront] = useState<0 | 1>(0)
  const lastSrc = useRef(src)

  useEffect(() => {
    if (src === lastSrc.current) return
    lastSrc.current = src
    let cancelled = false

    async function run() {
      // Decode off-screen first — decode() isn't supported everywhere,
      // so a plain load/error event is the fallback.
      try {
        const img = new window.Image()
        img.src = src
        // `typeof` rather than the `in` operator — every HTMLImageElement
        // in TS's own DOM lib declares decode() unconditionally, so `'decode'
        // in img` type-narrows the fallback branch below to unreachable
        // (`never`) even though real support for it is newer than this
        // project's actual browser support matrix.
        if (typeof img.decode === 'function') await img.decode()
        else
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
          })
      } catch {
        // Couldn't preload (offline, a bad URL, decode unsupported) —
        // proceed anyway rather than getting stuck on this photo
        // forever; the layer below will just load in as it goes.
      }
      if (cancelled) return

      const incomingLayer = front === 0 ? 1 : 0
      setLayers((prev) => {
        const next = [...prev] as [string, string]
        next[incomingLayer] = src
        return next
      })
      // Next frame, so the browser commits the incoming layer's
      // opacity-0 state first — flipping `front` in the same tick it's
      // assigned a new src would give the transition nothing to
      // animate *from*, and it'd just snap instead of fading.
      requestAnimationFrame(() => {
        if (!cancelled) setFront(incomingLayer)
      })
    }
    run()
    return () => {
      cancelled = true
    }
  }, [src, front])

  return (
    <>
      {layers.map((layerSrc, i) => (
        <Image
          key={i}
          src={layerSrc}
          alt={alt}
          className={`${className} absolute inset-0 transition-opacity ease-in-out ${i === front ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDuration: `${TRANSITION_MS}ms` }}
          {...imageProps}
        />
      ))}
    </>
  )
}
