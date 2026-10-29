'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPromotions } from '@/lib/promotions'
import { stayTotal, type PromotionKind } from '@/lib/pricing'
import { ROOM_TYPE_CONTENT, ROOM_TYPE_ORDER } from '@/lib/roomTypeContent'
import {
  fetchAdjustments,
  priceWithAdjustments,
  recalculateBookingTotals,
} from '@/lib/bookingTotals'

type ActionResult = { success: true } | { success: false; error: string }

export type PromotionInput = {
  // Omitted when creating; set when editing an existing promotion.
  id?: string
  name: string
  firstNight: string
  lastNight: string
  kind: PromotionKind
  // kind 'fixed': nightly price per room type, keyed by Rooms.name.
  // A type left blank/0 keeps its normal price during the promo.
  rates?: Record<string, number>
  // kind 'percent'
  percentOff?: number
  // Lower the total of bookings already made for these dates (never raises one).
  repriceExisting: boolean
}

export type SavePromotionResult =
  | { success: true; repricedCount: number }
  | { success: false; error: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_ROOM_NAMES = new Set<string>(ROOM_TYPE_ORDER.map((k) => ROOM_TYPE_CONTENT[k].dbName))
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])
const NOT_SET_UP_ERROR =
  "Promotions aren't set up in the database yet. Run the 20261030 migration in Supabase first."

function revalidatePricedPages() {
  revalidatePath('/admin/promotions')
  revalidatePath('/admin/bookings')
  revalidatePath('/admin/check-in/check-out')
  revalidatePath('/')
  revalidatePath('/rooms')
}

/**
 * Creates or updates a promotion. Validates everything the database
 * constraint does (so staff get a readable message instead of a
 * constraint error), then optionally reprices bookings already made for
 * those dates — see repriceBookingsForDates.
 */
export async function savePromotion(input: PromotionInput): Promise<SavePromotionResult> {
  const name = input.name.trim()
  if (!name) return { success: false, error: 'Give the promotion a name.' }
  if (!ISO_DATE.test(input.firstNight) || !ISO_DATE.test(input.lastNight)) {
    return { success: false, error: 'Choose the first and last night.' }
  }
  if (input.lastNight < input.firstNight) {
    return { success: false, error: 'The last night must be on or after the first night.' }
  }

  let rates: Record<string, number> | null = null
  let percentOff: number | null = null
  if (input.kind === 'fixed') {
    rates = {}
    for (const [roomName, raw] of Object.entries(input.rates ?? {})) {
      if (!KNOWN_ROOM_NAMES.has(roomName)) continue
      const value = Math.round(Number(raw))
      if (Number.isFinite(value) && value > 0) rates[roomName] = value
    }
    if (Object.keys(rates).length === 0) {
      return { success: false, error: 'Enter a promo price for at least one room type.' }
    }
  } else {
    percentOff = Number(input.percentOff)
    if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff >= 100) {
      return { success: false, error: 'Enter a percentage between 1 and 99.' }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please sign in again.' }

  const row = {
    name,
    first_night: input.firstNight,
    last_night: input.lastNight,
    kind: input.kind,
    rates,
    percent_off: percentOff,
    updated_at: new Date().toISOString(),
  }

  const { error } = input.id
    ? await supabase.from('promotions').update(row).eq('id', input.id)
    : await supabase.from('promotions').insert({ ...row, active: true, created_by: user.email ?? null })

  if (error) {
    if (MISSING_TABLE_CODES.has(error.code ?? '')) return { success: false, error: NOT_SET_UP_ERROR }
    console.error('savePromotion failed:', error)
    return { success: false, error: 'Something went wrong saving the promotion. Please try again.' }
  }

  let repricedCount = 0
  if (input.repriceExisting) {
    repricedCount = await repriceBookingsForDates(input.firstNight, input.lastNight, name, user.email ?? null)
  }

  revalidatePricedPages()
  return { success: true, repricedCount }
}

/**
 * Lowers the stored total of bookings already made for any night in
 * [firstNight, lastNight] so they get the promo price too — what had to
 * be done by hand (SQL) for the October promo. Only bookings that haven't
 * finished (pending, confirmed, checked in), and only ever DOWN: a
 * guest's quoted total is never raised by this, so editing or shortening
 * a promo can't surprise anyone with a higher bill. Each change is
 * logged in the booking's Change history and its paid/partial status is
 * re-derived from the payments ledger.
 *
 * Prices with ALL active promotions (not just this one), exactly as a
 * new booking for the same dates would be priced, plus the booking's
 * own early check-in / late check-out fees and discount.
 */
async function repriceBookingsForDates(
  firstNight: string,
  lastNight: string,
  promotionName: string,
  performedBy: string | null
): Promise<number> {
  const supabase = await createClient()
  const promos = await getPromotions(supabase)

  const { data: bookings, error } = await supabase
    .from('Bookings')
    .select('id, check_in, check_out, total_amount, Rooms(name, price_per_night)')
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lte('check_in', lastNight)
    .gt('check_out', firstNight)

  if (error || !bookings) {
    console.error('repriceBookingsForDates query failed:', error)
    return 0
  }

  let count = 0
  for (const booking of bookings) {
    const room = Array.isArray(booking.Rooms) ? booking.Rooms[0] : booking.Rooms
    if (!room || booking.total_amount == null) continue

    const adjustments = await fetchAdjustments(supabase, booking.id)
    const { total: newTotal, discountUpdate } = priceWithAdjustments(
      stayTotal(room, booking.check_in, booking.check_out, promos),
      adjustments
    )
    const oldTotal = Number(booking.total_amount)
    if (!(newTotal < oldTotal)) continue

    const { error: updateError } = await supabase
      .from('Bookings')
      .update({ total_amount: newTotal, ...discountUpdate })
      .eq('id', booking.id)
    if (updateError) {
      console.error('repriceBookingsForDates update failed:', booking.id, updateError)
      continue
    }
    await recalculateBookingTotals(supabase, booking.id)
    await supabase.from('booking_audit_log').insert({
      booking_id: booking.id,
      event_type: 'promo_reprice',
      reason: null,
      details: { promotion: promotionName, old_total: oldTotal, new_total: newTotal },
      performed_by: performedBy,
    })
    count += 1
  }
  return count
}

/** Pauses (active = false) or resumes a promotion without deleting it. */
export async function setPromotionActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('promotions')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code ?? '')) return { success: false, error: NOT_SET_UP_ERROR }
    return { success: false, error: error.message }
  }
  revalidatePricedPages()
  return { success: true }
}

/**
 * Deletes a promotion. Bookings already priced with it keep their stored
 * totals — only future pricing changes.
 */
export async function deletePromotion(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('promotions').delete().eq('id', id)
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code ?? '')) return { success: false, error: NOT_SET_UP_ERROR }
    return { success: false, error: error.message }
  }
  revalidatePricedPages()
  return { success: true }
}
