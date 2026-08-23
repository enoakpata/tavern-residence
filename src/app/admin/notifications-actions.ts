'use server'

import { createClient } from '@/lib/supabase/server'

export type Notification = {
  id: string
  type: string
  message: string
  booking_id: string | null
  read: boolean
  created_at: string
}

const RECENT_NOTIFICATIONS_LIMIT = 20

export async function getNotifications(): Promise<{
  notifications: Notification[]
  unreadCount: number
}> {
  const supabase = await createClient()

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from('Notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(RECENT_NOTIFICATIONS_LIMIT),
    supabase.from('Notifications').select('*', { count: 'exact', head: true }).eq('read', false),
  ])

  if (error) console.error('Failed to fetch notifications:', error)
  if (countError) console.error('Failed to count unread notifications:', countError)

  return {
    notifications: (data ?? []) as Notification[],
    unreadCount: count ?? 0,
  }
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { error } = await supabase.from('Notifications').update({ read: true }).eq('id', id)

  if (error) {
    console.error('Failed to mark notification read:', error)
    return { success: false }
  }
  return { success: true }
}

/**
 * Marks exactly the notifications currently shown in the dropdown (the
 * ids the client already has) as read — used when the dropdown is opened,
 * so the whole visible list clears at once instead of requiring a click
 * on each one.
 */
export async function markAllNotificationsRead(ids: string[]): Promise<{ success: boolean }> {
  if (ids.length === 0) return { success: true }

  const supabase = await createClient()
  const { error } = await supabase.from('Notifications').update({ read: true }).in('id', ids)

  if (error) {
    console.error('Failed to mark all notifications read:', error)
    return { success: false }
  }
  return { success: true }
}

/**
 * Actually deletes the notification row — distinct from marking it read.
 * Once cleared, it's gone from the list entirely rather than just
 * greyed out.
 */
export async function clearNotification(id: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { error } = await supabase.from('Notifications').delete().eq('id', id)

  if (error) {
    console.error('Failed to clear notification:', error)
    return { success: false }
  }
  return { success: true }
}

/**
 * Deletes exactly the notifications currently shown in the dropdown (the
 * ids the client already has) — not every row that might exist beyond
 * that, so it matches what "Clear all" visibly promised.
 */
export async function clearAllNotifications(ids: string[]): Promise<{ success: boolean }> {
  if (ids.length === 0) return { success: true }

  const supabase = await createClient()
  const { error } = await supabase.from('Notifications').delete().in('id', ids)

  if (error) {
    console.error('Failed to clear all notifications:', error)
    return { success: false }
  }
  return { success: true }
}
