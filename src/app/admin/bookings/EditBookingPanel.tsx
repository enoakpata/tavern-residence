'use client'

import { useEffect, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * The "Edit booking" panel — a bottom sheet on phones, a centred dialog
 * from `sm` up, styled like ConfirmModal (Fraunces title, rounded-sm,
 * charcoal/10 border) but on ivory. Purely a shell: BookingActions owns
 * every flow and renders its existing ConfirmModals on top of this one.
 *
 * Escape and backdrop clicks close it unless `busy` (a save in flight).
 * While `suspendEscape` is set (one of those ConfirmModals is open on
 * top), Escape is left to that modal instead.
 */
export default function EditBookingPanel({
  open,
  busy,
  suspendEscape,
  subtitle,
  onClose,
  children,
}: {
  open: boolean
  busy: boolean
  suspendEscape: boolean
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || suspendEscape) return
      // Capture phase + stopPropagation so the booking detail modal
      // underneath (which listens on document) stays open.
      e.stopPropagation()
      if (!busy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, busy, suspendEscape, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 sm:items-center sm:px-6 sm:py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-booking-title"
        className="flex max-h-[92vh] w-full flex-col rounded-t-md border border-charcoal/10 bg-ivory shadow-xl sm:max-h-full sm:max-w-md sm:rounded-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <p id="edit-booking-title" className="font-display text-xl text-charcoal">
              Edit booking
            </p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-charcoal/50">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-charcoal/40 transition-colors hover:bg-charcoal/10 hover:text-charcoal disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-base text-charcoal">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/** A bordered list of PanelRows. */
export function PanelRows({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-charcoal/10 rounded-sm border border-charcoal/10 bg-white/70">
      {children}
    </div>
  )
}

export type PanelRowAction = { label: string; onClick: () => void; chevron?: boolean }

/**
 * Label (and optional hint) on the left, current value on the right, then
 * one or more subtle text actions ("Change ›", "Add", "Remove").
 */
export function PanelRow({
  label,
  hint,
  value,
  actions,
  disabled,
}: {
  label: string
  hint?: string
  value: ReactNode
  actions: PanelRowAction[]
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-charcoal">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-charcoal/40">{hint}</p>}
      </div>
      <p className="max-w-[45%] truncate text-right text-sm text-charcoal/60">{value}</p>
      <div className="flex shrink-0 items-center gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={action.onClick}
            className="inline-flex items-center gap-0.5 text-xs text-brass underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action.label}
            {action.chevron && <ChevronRight size={12} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}
