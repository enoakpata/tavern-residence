'use client'

import { createContext, useContext, useState } from 'react'
import ConfirmModal from '@/components/ConfirmModal'

type CheckInResult = { success: boolean; message: string }

const CheckInResultContext = createContext<{ showResult: (result: CheckInResult) => void } | null>(
  null
)

// A successful check-in flips the booking's status away from 'confirmed',
// which makes it drop out of Today's Check-ins on the next render — that
// unmounts the specific CheckInButton that triggered it, and with it any
// state (like a result modal) that button was holding. Rendering the
// result modal here instead, at the page level, keeps it alive across
// that re-render so it stays open until the admin dismisses it, rather
// than disappearing out from under them.
export function CheckInResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<CheckInResult | null>(null)

  return (
    <CheckInResultContext.Provider value={{ showResult: setResult }}>
      {children}
      <ConfirmModal
        open={result !== null}
        title={result?.success ? 'Checked in' : 'Check-in failed'}
        message={result?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setResult(null)}
        onCancel={() => setResult(null)}
      />
    </CheckInResultContext.Provider>
  )
}

export function useCheckInResult() {
  const ctx = useContext(CheckInResultContext)
  if (!ctx) {
    throw new Error('useCheckInResult must be used within CheckInResultProvider')
  }
  return ctx
}
