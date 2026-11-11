'use client'

import { useEffect, useState, useTransition } from 'react'
import Dropdown, { type DropdownOption } from '@/components/Dropdown'
import { updateGuestDetails, type GuestDetailsInput } from './actions'
import type { Booking } from '@/lib/types'

type Source = Booking['source']

const SOURCE_OPTIONS: DropdownOption<Source>[] = [
  { value: 'online', label: 'Online' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
]

// Same rule as updateGuestDetails on the server — checked here too so the
// error shows before a round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LABEL = 'block text-xs tracking-widest text-charcoal/60 uppercase'
const INPUT =
  'mt-1 w-full rounded-sm border border-charcoal/20 bg-white px-2 py-1.5 text-sm text-charcoal focus:border-espresso focus:outline-none'

function normalize(v: GuestDetailsInput): GuestDetailsInput {
  return {
    guest_name: v.guest_name.trim(),
    guest_phone: v.guest_phone.trim(),
    guest_email: (v.guest_email ?? '').trim() || null,
    special_requests: (v.special_requests ?? '').trim() || null,
    source: v.source,
  }
}

/**
 * Inline guest-details editor for the Edit booking panel. "Save changes"
 * stays disabled until something differs from what's on the booking.
 * After a save, the parent refetches and `initial` catches up with what
 * was typed, so the form reads as clean again.
 */
export default function GuestDetailsForm({
  bookingId,
  initial,
  onSaved,
  onSavingChange,
}: {
  bookingId: string
  initial: GuestDetailsInput
  onSaved?: () => void
  // Lets the panel block Escape/backdrop-close while a save is in flight.
  onSavingChange?: (saving: boolean) => void
}) {
  const [name, setName] = useState(initial.guest_name)
  const [phone, setPhone] = useState(initial.guest_phone)
  const [email, setEmail] = useState(initial.guest_email ?? '')
  const [requests, setRequests] = useState(initial.special_requests ?? '')
  const [source, setSource] = useState<Source>(initial.source)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'phone' | 'email', string>>>({})
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [isSaving, startTransition] = useTransition()

  useEffect(() => {
    onSavingChange?.(isSaving)
  }, [isSaving, onSavingChange])

  const draft = normalize({
    guest_name: name,
    guest_phone: phone,
    guest_email: email,
    special_requests: requests,
    source,
  })
  const base = normalize(initial)
  const dirty = (Object.keys(draft) as (keyof GuestDetailsInput)[]).some((k) => draft[k] !== base[k])

  function clearMessages() {
    setError('')
    setSavedNote('')
  }

  function handleSave() {
    const errors: typeof fieldErrors = {}
    if (!draft.guest_name) errors.name = 'Guest name is required.'
    if (!draft.guest_phone) errors.phone = 'Phone number is required.'
    if (draft.guest_email && !EMAIL_PATTERN.test(draft.guest_email)) errors.email = 'Enter a valid email address.'
    setFieldErrors(errors)
    clearMessages()
    if (Object.keys(errors).length > 0) return

    startTransition(async () => {
      const res = await updateGuestDetails(bookingId, draft)
      if (!res.success) {
        setError(res.error)
        return
      }
      // Drop any stray whitespace so the form matches what was stored.
      setName(draft.guest_name)
      setPhone(draft.guest_phone)
      setEmail(draft.guest_email ?? '')
      setRequests(draft.special_requests ?? '')
      setSavedNote(res.changed.length > 0 ? 'Guest details saved.' : 'Nothing to change.')
      if (res.changed.length > 0) onSaved?.()
    })
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && !isSaving) handleSave()
      }}
    >
      <div>
        <label htmlFor="guest-name" className={LABEL}>
          Guest name
        </label>
        <input
          id="guest-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setFieldErrors((f) => ({ ...f, name: undefined }))
            clearMessages()
          }}
          autoComplete="off"
          className={INPUT}
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-clay">{fieldErrors.name}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="guest-phone" className={LABEL}>
            Phone
          </label>
          <input
            id="guest-phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setFieldErrors((f) => ({ ...f, phone: undefined }))
              clearMessages()
            }}
            autoComplete="off"
            className={INPUT}
          />
          {fieldErrors.phone && <p className="mt-1 text-xs text-clay">{fieldErrors.phone}</p>}
        </div>
        <div>
          <label htmlFor="guest-email" className={LABEL}>
            Email <span className="tracking-normal normal-case text-charcoal/40">(optional)</span>
          </label>
          <input
            id="guest-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldErrors((f) => ({ ...f, email: undefined }))
              clearMessages()
            }}
            autoComplete="off"
            className={INPUT}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-clay">{fieldErrors.email}</p>}
        </div>
      </div>

      <div>
        <span className={LABEL}>Source</span>
        <div className="mt-1">
          <Dropdown
            value={source}
            options={SOURCE_OPTIONS}
            onChange={(v) => {
              setSource(v)
              clearMessages()
            }}
            ariaLabel="Booking source"
            anchor="viewport"
            triggerClassName="flex w-full items-center justify-between rounded-sm border border-charcoal/20 bg-white px-2 py-1.5 text-sm text-charcoal focus:border-espresso focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="guest-requests" className={LABEL}>
          Special requests <span className="tracking-normal normal-case text-charcoal/40">(optional)</span>
        </label>
        <textarea
          id="guest-requests"
          rows={3}
          value={requests}
          onChange={(e) => {
            setRequests(e.target.value)
            clearMessages()
          }}
          className={`${INPUT} resize-y`}
        />
      </div>

      <div className="flex min-h-[2.25rem] items-center justify-between gap-3">
        <p className={`text-xs ${error ? 'text-clay' : 'text-charcoal/50'}`} role={error ? 'alert' : undefined}>
          {error || savedNote}
        </p>
        <button
          type="submit"
          disabled={!dirty || isSaving}
          className="shrink-0 rounded-full bg-espresso px-4 py-2 text-sm text-ivory transition-colors hover:bg-espresso/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
