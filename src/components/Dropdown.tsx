'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type DropdownOption<T extends string> = { value: T; label: string }

/**
 * A small custom single-select dropdown matching the site's own popover
 * style (GuestPicker.tsx: bordered trigger with a chevron, an absolute
 * bg-white/shadow-xl panel, outside-click closes) — for anywhere a plain
 * <select> would otherwise be the only option, e.g. the admin payment
 * method field. Supports Arrow Up/Down to move the highlight, Enter to
 * choose it, Escape to close, and click-outside.
 */
export default function Dropdown<T extends string>({
  value,
  options,
  onChange,
  triggerClassName,
  ariaLabel,
  anchor = 'relative',
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  triggerClassName?: string
  ariaLabel?: string
  // 'relative' (default): the panel is positioned absolute to its own
  // trigger. 'viewport': computed as position:fixed from the trigger's
  // live bounding box instead — for a trigger inside a scrollable
  // container (e.g. the admin booking detail modal), where a plain
  // absolute panel can be silently clipped by that container's own
  // overflow. Closes on scroll, same rationale as DateRangePicker's own
  // anchor prop.
  anchor?: 'relative' | 'viewport'
}) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [viewportPos, setViewportPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  )
  const isViewportAnchored = anchor === 'viewport'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open || !isViewportAnchored) return
    function handleScroll() {
      setOpen(false)
    }
    document.addEventListener('scroll', handleScroll, true)
    return () => document.removeEventListener('scroll', handleScroll, true)
  }, [open, isViewportAnchored])

  const selected = options.find((o) => o.value === value)

  function openDropdown() {
    setHighlightedIndex(Math.max(0, options.findIndex((o) => o.value === value)))
    if (isViewportAnchored && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setViewportPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(true)
  }

  function selectOption(index: number) {
    const opt = options[index]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectOption(highlightedIndex)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        onKeyDown={handleKeyDown}
        className={
          triggerClassName ??
          'flex w-full items-center justify-between rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm text-charcoal focus:border-espresso focus:outline-none'
        }
      >
        <span>{selected?.label ?? 'Select'}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-charcoal/50 transition-transform duration-base ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`z-20 min-w-[8rem] overflow-hidden rounded-sm border border-charcoal/10 bg-white py-1 text-sm shadow-xl ${
            isViewportAnchored ? 'fixed' : 'absolute mt-1 w-full'
          }`}
          style={isViewportAnchored && viewportPos ? { top: viewportPos.top, left: viewportPos.left, width: viewportPos.width } : undefined}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlightedIndex(i)}
              onClick={() => selectOption(i)}
              className={`cursor-pointer px-3 py-2 ${
                opt.value === value
                  ? 'bg-espresso text-white'
                  : i === highlightedIndex
                    ? 'bg-espresso/10 text-charcoal'
                    : 'text-charcoal'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
