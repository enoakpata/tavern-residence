import type { Metadata } from 'next'
import ManageBookingSearch from './ManageBookingSearch'

export const metadata: Metadata = {
  title: 'Manage Your Booking | Tavern Residence',
  description:
    'Find your Tavern Residence booking using the phone number and email you booked with.',
}

export default function ManageBookingPage() {
  return <ManageBookingSearch />
}
