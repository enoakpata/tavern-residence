'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { signOutFrom } from './actions'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
const WARNING_LEAD_TIME_MS = 5 * 60 * 1000 // warn 5 minutes before sign-out, i.e. at the 25-minute mark
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart'] as const
const ACTIVITY_THROTTLE_MS = 1000

/**
 * Signs staff out after 30 minutes with no mouse/keyboard/touch activity
 * anywhere on the page, with a warning ~5 minutes before that so nobody
 * loses unsaved work without notice. Rendered once from AdminLayout,
 * which stays mounted across every /admin/* navigation, so the activity
 * listeners keep running continuously rather than needing to reattach
 * per page.
 */
export default function InactivityTimeout() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showWarning, setShowWarning] = useState(false)
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityAt = useRef(0)

  // Kept fresh on every navigation (rather than as a scheduleTimers
  // dependency) so the eventual timeout always signs out from whatever
  // page is CURRENT at that moment, without needing to reschedule —
  // and therefore re-attach the activity listeners — on every navigation.
  const currentPathRef = useRef('')
  const search = searchParams.toString()
  useEffect(() => {
    currentPathRef.current = search ? `${pathname}?${search}` : pathname
  }, [pathname, search])

  // Schedules the warning/sign-out timeouts only — no state updates, so
  // it's safe to call directly from an effect body as well as from event
  // callbacks.
  const scheduleTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)

    warningTimer.current = setTimeout(() => {
      setShowWarning(true)
    }, INACTIVITY_TIMEOUT_MS - WARNING_LEAD_TIME_MS)

    logoutTimer.current = setTimeout(() => {
      signOutFrom(currentPathRef.current)
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  // Full reset used from actual event callbacks (activity, "Stay signed
  // in") — also dismisses the warning if it's showing.
  const resetTimers = useCallback(() => {
    setShowWarning(false)
    scheduleTimers()
  }, [scheduleTimers])

  // Activity listeners are attached once for the whole admin session.
  useEffect(() => {
    function handleActivity() {
      const now = Date.now()
      // Lightly throttled — mousemove alone can fire dozens of times a
      // second, and resetting timers that often is wasted work.
      if (now - lastActivityAt.current < ACTIVITY_THROTTLE_MS) return
      lastActivityAt.current = now
      resetTimers()
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    )
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity))
    }
  }, [resetTimers])

  // Also restarts the timers fresh on every admin page navigation —
  // covers back/forward and programmatic navigation that might not
  // otherwise fire a click/keydown. Only schedules timers (no state), so
  // it doesn't trip the "no setState directly in an effect" rule; a
  // stale warning banner still gets dismissed by the very next activity.
  useEffect(() => {
    scheduleTimers()
    return () => {
      if (warningTimer.current) clearTimeout(warningTimer.current)
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
    }
  }, [pathname, scheduleTimers])

  return (
    <ConfirmModal
      open={showWarning}
      title="Still there?"
      message={`You've been inactive for a while. For security, you'll be signed out automatically in ${WARNING_LEAD_TIME_MS / 60000} minutes unless you stay active.`}
      confirmLabel="Stay signed in"
      cancelLabel="Dismiss"
      onConfirm={resetTimers}
      onCancel={() => setShowWarning(false)}
    />
  )
}
