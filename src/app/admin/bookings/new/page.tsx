import NewBookingForm from './NewBookingForm'

export default function NewBookingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:px-12">
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
        <NewBookingForm />
      </div>
    </main>
  )
}
