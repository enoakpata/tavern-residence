'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isRoomAvailable } from '@/lib/bookings'
import { chargeAuthorization } from '@/lib/paystack'
import type { Room } from '@/lib/types'

type ActionResult = { success: true } | { success: false; error: string }

/**
 * Manual booking entry — used for walk-ins and phone bookings. Unlike the
 * guest-facing form, there's no Paystack card verification here: a walk-in
 * pays at the front desk (POS or cash), and a phone booking either pays by
 * transfer or the receptionist takes card details over a payment link
 * outside this system entirely. So this just records the booking.
 */
export async function createManualBooking(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const roomId = formData.get('room_id') as string
  const guestName = formData.get('guest_name') as string
  const guestPhone = formData.get('guest_phone') as string
  const guestEmail = (formData.get('guest_email') as string) || null
  const checkIn = formData.get('check_in') as string
  const checkOut = formData.get('check_out') as string
  const source = formData.get('source') as 'walk_in' | 'phone'
  const paymentMethod = formData.get('payment_method') as 'card' | 'transfer'
  const paymentStatus = formData.get('payment_status') as
    | 'unpaid'
    | 'awaiting_verification'
    | 'paid'

  if (!roomId || !guestName || !guestPhone || !checkIn || !checkOut || !source) {
    return { success: false, error: 'Please fill in all required fields.' }
  }
  if (checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  const available = await isRoomAvailable(roomId, checkIn, checkOut)
  if (!available) {
    return { success: false, error: 'This room is not available for those dates.' }
  }

  const { error } = await supabase.from('Bookings').insert({
    room_id: roomId,
    guest_name: guestName,
    guest_phone: guestPhone,
    guest_email: guestEmail,
    check_in: checkIn,
    check_out: checkOut,
    status: 'confirmed', // staff-entered bookings are confirmed on the spot
    source,
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    created_by: user?.email ?? null,
  })

  if (error) {
    console.error('Manual booking insert failed:', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  revalidatePath('/admin/bookings')
  return { success: true }
}

/**
 * Lists every room annotated with whether it's free for the given date
 * range — used by the manual booking form so staff can see the full room
 * list (with unavailable ones greyed out) instead of a silently filtered
 * one. Reuses the same overlap check `createManualBooking` relies on as
 * its final safety net.
 */
export async function getAvailableRooms(
  checkIn: string,
  checkOut: string
): Promise<(Room & { available: boolean })[]> {
  const supabase = await createClient()
  const { data: rooms, error } = await supabase
    .from('Rooms')
    .select('*')
    .order('room_number', { ascending: true })

  if (error || !rooms) {
    console.error('Failed to fetch rooms:', error)
    return []
  }

  return Promise.all(
    (rooms as Room[]).map(async (room) => ({
      ...room,
      available: await isRoomAvailable(room.id, checkIn, checkOut),
    }))
  )
}

/**
 * Confirms a bank transfer manually — the receptionist has checked the
 * hotel's bank account and seen the money land, so this just flips the
 * status. There's no automated verification for transfers.
 */
export async function markAsPaid(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({ payment_status: 'paid' })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  return { success: true }
}

/**
 * Charges the guest's saved card for the full stay — uses the
 * authorization_code captured during the ₦100 verification charge at
 * booking time. This is the "charge at check-in" action.
 */
export async function chargeFullStay(
  bookingId: string,
  authorizationCode: string,
  amountNaira: number,
  guestEmail: string
): Promise<ActionResult> {
  const result = await chargeAuthorization(authorizationCode, amountNaira, guestEmail)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Charge failed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({
      payment_status: 'paid',
      charge_type: 'full_stay',
      amount_charged: amountNaira,
    })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  return { success: true }
}

/**
 * Charges the 50% fee for a no-show or late cancellation — same mechanism
 * as the full-stay charge, just a different amount and charge_type so your
 * records show why the guest was charged.
 */
export async function chargeNoShowFee(
  bookingId: string,
  authorizationCode: string,
  fullAmountNaira: number,
  guestEmail: string
): Promise<ActionResult> {
  const feeAmount = Math.round(fullAmountNaira * 0.5)
  const result = await chargeAuthorization(authorizationCode, feeAmount, guestEmail)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Charge failed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({
      status: 'no_show',
      payment_status: 'paid',
      charge_type: 'no_show_fee',
      amount_charged: feeAmount,
    })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  return { success: true }
}

/**
 * Plain status update — confirming, checking a guest in/out, or cancelling.
 * No payment logic involved, just moves the booking through its lifecycle.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('Bookings')
    .update({ status })
    .eq('id', bookingId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  return { success: true }
}
