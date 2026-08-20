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
