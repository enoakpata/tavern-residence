import type { Metadata } from 'next'
import { HOTEL_NAME } from '@/lib/siteConfig'
import ManageBookingSearch from './ManageBookingSearch'

export const metadata: Metadata = {
  title: `Manage Your Booking | ${HOTEL_NAME}`,
  description: `Find your ${HOTEL_NAME} booking using the phone number and email you booked with.`,
}

export default function ManageBookingPage() {
  return <ManageBookingSearch />
}
