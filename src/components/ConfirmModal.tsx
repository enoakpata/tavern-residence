'use client'

import { useEffect, type ReactNode } from 'react'

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  hideCancel = false,
  confirmDisabled = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  // For informational (single-button, acknowledgement-only) use — e.g. a
  // result notice after an action already completed, where there's
  // nothing left to actually confirm or cancel.
  hideCancel?: boolean
  // For a confirmation that's gated on something inside `message` itself
  // (e.g. a required checkbox) — disables the confirm button without the
  // caller needing to hide it or duplicate the dialog.
  confirmDisabled?: boolean
  // 'danger' turns the confirm button clay — for irreversible actions
  // (e.g. permanently deleting a booking).
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    // Capture phase on window + stopPropagation: Escape closes only this
    // dialog, not whatever it's stacked on (e.g. BookingDetailModal and the
    // Edit booking panel each listen for Escape themselves).
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 px-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-sm border border-charcoal/10 bg-white shadow-xl"
      >
        {/* Only this part scrolls when content is taller than the
            viewport allows (e.g. BookingForm.tsx's "View full policy"
            expansion) — the buttons below stay pinned and reachable
            instead of being pushed off-screen with no way to scroll to
            them, which plain unbounded content would otherwise risk. */}
        <div className="overflow-y-auto p-6">
          <p id="confirm-modal-title" className="font-display text-xl text-charcoal">
            {title}
          </p>
          <div className="mt-2 text-sm text-charcoal/70">{message}</div>
        </div>

        <div className="flex justify-end gap-3 p-6 pt-0">
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-charcoal/20 px-4 py-2 text-sm text-charcoal/70 transition-colors hover:bg-charcoal/5"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`rounded-full px-4 py-2 text-sm text-ivory transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              tone === 'danger' ? 'bg-clay hover:bg-clay/90' : 'bg-espresso hover:bg-espresso/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
