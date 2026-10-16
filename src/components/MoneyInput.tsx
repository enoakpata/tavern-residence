'use client'

import { useLayoutEffect, useRef } from 'react'

/**
 * Digits and at most one decimal point, capped at 2 decimal places —
 * everything else (commas, letters, a second '.') is stripped. Applied
 * to the RAW value with commas already removed, so it only ever has to
 * reason about digits/decimal, never about where a comma landed.
 */
function sanitizeDigits(raw: string): string {
  let cleaned = raw.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  }
  const dotIndex = cleaned.indexOf('.')
  if (dotIndex !== -1) {
    cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1, dotIndex + 3)
  }
  return cleaned
}

function formatThousands(clean: string): string {
  if (!clean) return ''
  const [intPart, decPart] = clean.split('.')
  const withCommas = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas
}

/**
 * A plain-number input that displays thousand separators as you type
 * (500000 -> 500,000) without the cursor jumping — used for every naira
 * amount field in the admin (Record payment, the manual booking form's
 * Amount paid). The value the parent gets via onChange is always a plain
 * digits-and-decimal string (no commas), ready for Number(...).
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder = 'Amount (₦)',
  className,
  id,
  name,
  autoFocus,
  disabled,
}: {
  // Plain numeric string (no commas) — same contract as a normal
  // controlled input's value, just always comma-free.
  value: string
  onChange: (plainValue: string) => void
  placeholder?: string
  className?: string
  id?: string
  name?: string
  autoFocus?: boolean
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Set during an onChange, consumed by the layout effect right after
  // the re-render it caused — this is what keeps the cursor from
  // jumping to the end every time a comma is inserted or removed.
  const nextSelection = useRef<number | null>(null)

  const formatted = formatThousands(value)

  useLayoutEffect(() => {
    if (nextSelection.current != null && inputRef.current) {
      inputRef.current.setSelectionRange(nextSelection.current, nextSelection.current)
      nextSelection.current = null
    }
  }, [formatted])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const rawValue = input.value
    const cursorPos = input.selectionStart ?? rawValue.length

    // How many non-comma characters sit before the cursor in what the
    // browser just produced — this count (not the raw character index)
    // is what stays stable across reformatting, since commas are only
    // ever inserted or removed, never the digits themselves.
    const digitsBeforeCursor = rawValue.slice(0, cursorPos).replace(/,/g, '').length

    const clean = sanitizeDigits(rawValue.replace(/,/g, ''))
    const nextFormatted = formatThousands(clean)

    // Walk the new formatted string, placing the cursor right after the
    // same count of non-comma characters counted above.
    let seen = 0
    let newPos = nextFormatted.length
    if (digitsBeforeCursor === 0) {
      newPos = 0
    } else {
      for (let i = 0; i < nextFormatted.length; i++) {
        if (nextFormatted[i] !== ',') seen++
        if (seen === digitsBeforeCursor) {
          newPos = i + 1
          break
        }
      }
    }

    nextSelection.current = newPos
    onChange(clean)
  }

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      disabled={disabled}
      placeholder={placeholder}
      value={formatted}
      onChange={handleChange}
      className={
        className ??
        'rounded-sm border border-charcoal/20 px-2 py-1.5 text-sm focus:border-espresso focus:outline-none'
      }
    />
  )
}
