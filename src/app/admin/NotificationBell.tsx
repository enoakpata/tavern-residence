'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotification,
  clearAllNotifications,
  type Notification,
} from './notifications-actions'
import { useBookingDetail } from './BookingDetailContext'

const POLL_INTERVAL_MS = 30000

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const { open: openBookingDetail } = useBookingDetail()

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const result = await getNotifications()
      if (cancelled) return
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    }

    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Re-registered whenever `open` or `notifications` changes so the
  // closures below always mark the list that's actually on screen as read
  // (rather than a stale snapshot from whenever the dropdown was opened),
  // including anything the 30s poll added while it was open.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notifications])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notifications])

  async function handleNotificationClick(notification: Notification) {
    if (notification.read) return

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))

    const res = await markNotificationRead(notification.id)
    if (!res.success) {
      // Roll back the optimistic update if the write actually failed.
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n))
      )
      setUnreadCount((prev) => prev + 1)
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)

    const res = await markAllNotificationsRead(unreadIds)
    if (!res.success) {
      // Roll back by re-fetching, rather than trying to reconstruct which
      // of these were actually unread before.
      const result = await getNotifications()
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    }
  }

  // Marking as read happens when the panel closes, not when it opens —
  // staff should be able to see something just arrived (still highlighted
  // as unread) while glancing at the open dropdown, and only have it clear
  // once they're actually done looking.
  function closeDropdown() {
    setOpen(false)
    markAllAsRead()
  }

  function handleBellClick() {
    if (open) {
      closeDropdown()
    } else {
      setOpen(true)
    }
  }

  async function handleDismiss(notification: Notification) {
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    if (!notification.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    const res = await clearNotification(notification.id)
    if (!res.success) {
      // Roll back by re-fetching, rather than trying to reconstruct the
      // removed row's exact position in the list.
      const result = await getNotifications()
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    }
  }

  function handleViewBooking(notification: Notification) {
    if (notification.booking_id) {
      openBookingDetail(notification.booking_id)
    }
    if (!notification.read) {
      handleNotificationClick(notification)
    }
  }

  async function handleClearAll() {
    const ids = notifications.map((n) => n.id)
    setNotifications([])
    setUnreadCount(0)

    const res = await clearAllNotifications(ids)
    if (!res.success) {
      const result = await getNotifications()
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleBellClick}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ivory/80 transition-colors hover:text-brass"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brass px-1 text-[10px] font-semibold text-charcoal">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // On mobile the bell sits well inboard of the true right edge (header
        // padding + the hamburger button + their gap), so anchoring the panel
        // to the bell itself via `right-0` let it grow leftward past x=0 and
        // clip its own text off-screen — its right edge was never near the
        // viewport's right edge to begin with. Below `sm`, position it against
        // the *viewport* instead (fixed + inset-x-4) so its width and edges
        // are always viewport-safe regardless of where the bell sits; from
        // `sm` up there's enough room for the original bell-anchored
        // placement. `top-28` clears the header at both its one-line height
        // (~72px) and the two-line height it wraps to on the narrowest
        // common phone widths (~92px, "Tavern Residence" wrapping) — a fixed
        // pixel guess either way, since the header can't be measured from
        // here, but generous enough to cover both states with room to spare.
        <div className="fixed inset-x-4 top-28 z-50 overflow-hidden rounded-sm border border-charcoal/10 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[min(20rem,calc(100vw-2rem))]">
          {notifications.length > 0 && (
            <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-2">
              <p className="text-xs tracking-widest text-charcoal/50 uppercase">
                Notifications
              </p>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-verdant hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-charcoal/50">No notifications yet.</p>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`relative border-b border-charcoal/5 px-4 py-3 pr-9 last:border-0 ${
                      notification.read ? 'text-charcoal/50' : 'bg-brass/10 text-charcoal'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`block w-full text-left text-sm transition-colors ${
                        notification.read ? '' : 'font-medium'
                      }`}
                    >
                      <p>{notification.message}</p>
                      <p className="mt-1 text-xs text-charcoal/40">
                        {timeAgo(notification.created_at)}
                      </p>
                    </button>
                    {notification.booking_id && (
                      <button
                        type="button"
                        onClick={() => handleViewBooking(notification)}
                        className="mt-1 text-xs text-verdant hover:underline"
                      >
                        View
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDismiss(notification)}
                      aria-label="Dismiss notification"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-lg leading-none text-charcoal/40 transition-colors hover:bg-charcoal/10 hover:text-charcoal"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
