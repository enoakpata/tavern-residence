export type Room = {
  id: string
  room_number: string
  room_type: 'Studio' | '1-Bedroom' | 'Standard'
  name: string
  price_per_night: number
  description: string
  max_occupancy: number
  bed_type: string
  has_kitchenette: boolean
  has_living_area: boolean
  floor: string
  images: string[] | null
  room_size_sqm: number | null
}

export type Booking = {
  id: string
  room_id: string
  guest_name: string
  guest_phone: string
  guest_email: string | null
  check_in: string
  check_out: string
  status:
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'
    | 'no_show'
  source: 'online' | 'walk_in' | 'phone'
  payment_method: 'card' | 'transfer'
  payment_status: 'unpaid' | 'paid' | 'refunded'
  payment_token: string | null
  charge_type: 'full_stay' | 'no_show_fee' | 'late_cancellation_fee' | null
  amount_charged: number | null
  created_by: string | null
  created_at: string
  reminder_sent: boolean
}
