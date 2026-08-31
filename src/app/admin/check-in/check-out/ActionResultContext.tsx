'use client'

import { createContext, useContext, useState } from 'react'
import ConfirmModal from '@/components/ConfirmModal'

type ActionResult = { success: boolean; title: string; message: string }

const ActionResultContext = createContext<{ showResult: (result: ActionResult) => void } | null>(
  null
)

// A successful check-in or check-out flips the booking's status away from
// the one Today's Check-ins/Check-outs filters on, which makes it drop out
// of that list on the next render — that unmounts the specific button that
// triggered it, and with it any state (like a result modal) that button
// was holding. Rendering the result modal here instead, at the page level,
// keeps it alive across that re-render so it stays open until the admin
// dismisses it, rather than disappearing out from under them. Shared by
// both CheckInButton and CheckOutButton since both hit the same problem.
export function ActionResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ActionResult | null>(null)

  return (
    <ActionResultContext.Provider value={{ showResult: setResult }}>
      {children}
      <ConfirmModal
        open={result !== null}
        title={result?.title ?? ''}
        message={result?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setResult(null)}
        onCancel={() => setResult(null)}
      />
    </ActionResultContext.Provider>
  )
}

export function useActionResult() {
  const ctx = useContext(ActionResultContext)
  if (!ctx) {
    throw new Error('useActionResult must be used within ActionResultProvider')
  }
  return ctx
}
