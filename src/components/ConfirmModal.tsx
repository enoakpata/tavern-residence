'use client'

import { useEffect, type ReactNode } from 'react'

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  hideCancel = false,
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
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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
        className="w-full max-w-sm rounded-sm border border-charcoal/10 bg-white p-6 shadow-xl"
      >
        <p id="confirm-modal-title" className="font-display text-xl text-charcoal">
          {title}
        </p>
        <div className="mt-2 text-sm text-charcoal/70">{message}</div>

        <div className="mt-6 flex justify-end gap-3">
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
            className="rounded-full bg-verdant px-4 py-2 text-sm text-ivory transition-colors hover:bg-verdant/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
