import NewBookingForm from './NewBookingForm'
import { createClient } from '@/lib/supabase/server'
import { getPromotions } from '@/lib/promotions'

export default async function NewBookingPage() {
  // Priced into the form's live total — the same promos createManualBooking uses.
  const promos = await getPromotions(await createClient())

  return (
    <main className="mx-auto max-w-3xl px-6 pt-6 pb-12 md:px-12">
      <p className="text-xs tracking-widest text-brass uppercase">
        Front desk
      </p>
      <h1 className="mt-2 font-display text-3xl text-charcoal">
        New booking
      </h1>
      <p className="mt-2 text-sm text-charcoal/60">
        For walk-in guests or phone reservations.
      </p>

      <div className="mt-8">
        <NewBookingForm promos={promos} />
      </div>
    </main>
  )
}
