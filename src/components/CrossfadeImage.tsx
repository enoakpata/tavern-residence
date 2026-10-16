'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

// 500-700ms ease-in-out, as requested — the middle of that range.
const TRANSITION_MS = 600

/**
 * Drop-in replacement for next/image's <Image> wherever `src` changes
 * over time (a gallery's active photo, a carousel's current slide) —
 * crossfades between the old and new photo instead of just popping to
 * the new src. Used by RoomGallery.tsx and AroundTheResidence.tsx, which
 * both previously hand-rolled the same fade-out-then-swap-then-fade-in
 * approach (see each file's own history) — sequential, not a true
 * crossfade, so there was a brief fully-transparent gap between photos.
 *
 * Two permanent <Image> layers are stacked (absolutely positioned, same
 * box) and cross-faded via opacity only (no layout-affecting property
 * ever animates, so there's no layout shift) — both layers keep a
 * stable `key` across every src change, so neither is ever unmounted/
 * remounted the way a `key={src}` swap would.
 *
 * The fade is gated on that layer's own <Image onLoad>, not a separate
 * manual preload: an earlier version pre-fetched/decoded `src` itself
 * via `new window.Image()`, which — because `src` here is the plain,
 * un-optimized file path (e.g. /images/gallery/7.jpg, multiple MB) —
 * downloaded and decoded a completely different (much larger) resource
 * than the one next/image actually renders from its srcset, AND did so
 * a second time (next/image fetches its own optimized copy regardless).
 * Real photos' raw files vary a lot in size, so that extra fetch's
 * timing varied a lot too — in a multi-tile caller (AroundTheResidence's
 * 3-tile layout) that showed up as the tiles visibly fading in at
 * noticeably different times instead of together. Waiting on the real
 * layer's own onLoad fixes the mismatch and removes the duplicate
 * fetch; decode()ing that same already-loaded <img> element (not a new
 * one) right before revealing it keeps the original's guarantee of
 * never revealing a half-rasterized frame, without re-fetching anything.
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
  // Which layer is currently loading `src` and should flip `front` once
  // it's actually ready — checked by handleLoad so a layer that was
  // reassigned again before its own load event arrived (a quick second
  // swipe before the first photo finished loading) can't flip `front` to
  // content that's no longer current.
  const pendingLayer = useRef<0 | 1 | null>(null)

  useEffect(() => {
    if (src === lastSrc.current) return
    lastSrc.current = src
    const incoming = front === 0 ? 1 : 0

    if (layers[incoming] === src) {
      // The hidden layer already holds this exact src (a quick swipe
      // back to a photo that was showing a moment ago) — nothing to
      // load, just reveal it.
      pendingLayer.current = null
      setFront(incoming)
      return
    }

    pendingLayer.current = incoming
    setLayers((prev) => {
      const next = [...prev] as [string, string]
      next[incoming] = src
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, front])

  function handleLoad(layerIndex: 0 | 1, img: HTMLImageElement) {
    if (pendingLayer.current !== layerIndex) return // superseded by a newer src change
    function reveal() {
      if (pendingLayer.current !== layerIndex) return
      pendingLayer.current = null
      setFront(layerIndex)
    }
    // decode() isn't supported everywhere — a plain load is good enough
    // then (the event that got us here in the first place).
    if (typeof img.decode === 'function') img.decode().then(reveal).catch(reveal)
    else reveal()
  }

  return (
    <>
      {layers.map((layerSrc, i) => (
        <Image
          key={i}
          src={layerSrc}
          alt={alt}
          onLoad={(e) => handleLoad(i as 0 | 1, e.currentTarget)}
          className={`${className} absolute inset-0 transition-opacity ease-in-out ${i === front ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDuration: `${TRANSITION_MS}ms` }}
          {...imageProps}
        />
      ))}
    </>
  )
}
