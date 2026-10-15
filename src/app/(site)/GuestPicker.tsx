'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Users } from 'lucide-react'

export type GuestCounts = { adults: number; children: number }

const MIN_ADULTS = 1
const MAX_ADULTS = 6
const MIN_CHILDREN = 0
const MAX_CHILDREN = 4

const STEPPER_BUTTON_CLASSES =
  'flex h-7 w-7 items-center justify-center rounded-full border border-charcoal/20 text-charcoal transition-colors duration-base hover:border-brass hover:text-brass disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-charcoal/20 disabled:hover:text-charcoal'

// Custom guest selector — a plain text+icon trigger (no box/border, matching
// the rest of the booking bar) that opens a small ivory popover with
// separate Adults/Children steppers, mirroring the outside-click-closes
// pattern already used by DateRangePicker.tsx and Header.tsx.
export default function GuestPicker({
  value,
  onChange,
}: {
  value: GuestCounts
  onChange: (next: GuestCounts) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Only set when the popover is portaled to document.body (see
  // isHeroTabletSheet below) — click-outside detection also has to check
  // this, since portaled content is no longer a DOM descendant of
  // containerRef even though it's still the same logical component.
  const portalRef = useRef<HTMLDivElement>(null)

  // Tablet-only (600px–1099px) fix for the guest availability bar
  // specifically (.hero-availability) — see DateRangePicker.tsx's own
  // copy of this same effect for the full explanation: .availability-bar
  // has backdrop-filter, which Chromium treats as establishing the
  // containing block for position:fixed descendants, so the tablet sheet
  // CSS (guest.css) ended up positioned relative to the bar's own box
  // instead of the true viewport. A portal to document.body sidesteps
  // it, scoped strictly to this context and width range.
  const [isHeroTabletSheet, setIsHeroTabletSheet] = useState(false)
  useEffect(() => {
    if (!containerRef.current?.closest('.hero-availability')) return
    const mq = window.matchMedia('(min-width: 600px) and (max-width: 1099px)')
    function update() {
      setIsHeroTabletSheet(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (portalRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function adjustAdults(delta: number) {
    const next = Math.min(MAX_ADULTS, Math.max(MIN_ADULTS, value.adults + delta))
    onChange({ ...value, adults: next })
  }

  function adjustChildren(delta: number) {
    const next = Math.min(MAX_CHILDREN, Math.max(MIN_CHILDREN, value.children + delta))
    onChange({ ...value, children: next })
  }

  const summary = `${value.adults} guest${value.adults === 1 ? '' : 's'}, ${value.children} child${
    value.children === 1 ? '' : 'ren'
  }`

  const popoverBody = open ? (
    <>
      <div
        className={`popover-mobile-backdrop ${isHeroTabletSheet ? 'tablet-sheet' : ''}`}
        onClick={() => setOpen(false)}
      />
      <div
        ref={portalRef}
        className={`guest-picker-popover absolute z-20 mt-3 w-64 rounded-sm border border-charcoal/10 bg-ivory p-5 shadow-xl ${isHeroTabletSheet ? 'tablet-sheet' : ''}`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className={`popover-mobile-close ${isHeroTabletSheet ? 'tablet-sheet' : ''}`}
        >
          ×
        </button>
        <div className="flex items-center justify-between">
          <span className="text-sm text-charcoal">Adults</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustAdults(-1)}
              disabled={value.adults <= MIN_ADULTS}
              aria-label="Fewer adults"
              className={STEPPER_BUTTON_CLASSES}
            >
              –
            </button>
            <span className="w-4 text-center text-sm text-charcoal">{value.adults}</span>
            <button
              type="button"
              onClick={() => adjustAdults(1)}
              disabled={value.adults >= MAX_ADULTS}
              aria-label="More adults"
              className={STEPPER_BUTTON_CLASSES}
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-charcoal">Children</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustChildren(-1)}
              disabled={value.children <= MIN_CHILDREN}
              aria-label="Fewer children"
              className={STEPPER_BUTTON_CLASSES}
            >
              –
            </button>
            <span className="w-4 text-center text-sm text-charcoal">{value.children}</span>
            <button
              type="button"
              onClick={() => adjustChildren(1)}
              disabled={value.children >= MAX_CHILDREN}
              aria-label="More children"
              className={STEPPER_BUTTON_CLASSES}
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-full border border-charcoal/20 py-2 text-xs tracking-widest text-charcoal uppercase transition-colors duration-base hover:border-brass hover:text-brass"
        >
          Done
        </button>
      </div>
    </>
  ) : null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-base text-charcoal"
      >
        <Users size={14} className="shrink-0 text-espresso" />
        {summary}
        <ChevronDown
          size={14}
          className={`shrink-0 text-charcoal/50 transition-transform duration-base ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isHeroTabletSheet && open ? createPortal(popoverBody, document.body) : popoverBody}
    </div>
  )
}
