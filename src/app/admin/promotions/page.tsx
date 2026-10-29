import { createClient } from '@/lib/supabase/server'
import { rowToPromotion, type Promotion } from '@/lib/pricing'
import { todayInLagos } from '@/lib/dateUtils'
import { ROOM_TYPE_CONTENT, ROOM_TYPE_ORDER } from '@/lib/roomTypeContent'
import PromotionsManager, { type RoomTypePrice } from './PromotionsManager'

export default async function PromotionsPage() {
  const supabase = await createClient()

  // Every promotion, paused and ended ones included (getPromotions() only
  // returns active ones — that's for pricing; this page manages them all).
  const { data: promoRows, error } = await supabase
    .from('promotions')
    .select('*')
    .order('first_night', { ascending: false })

  const notSetUp = Boolean(error && ['42P01', 'PGRST205'].includes(error.code ?? ''))
  const promotions: Promotion[] = (promoRows ?? []).map((row) => rowToPromotion(row))

  // Normal price per room type, shown next to each promo price input.
  // Every physical room of a type shares one name and price (see
  // roomTypeContent.ts), so the first room found per name speaks for it.
  const { data: rooms } = await supabase.from('Rooms').select('name, price_per_night')
  const roomTypes: RoomTypePrice[] = ROOM_TYPE_ORDER.map((key) => {
    const content = ROOM_TYPE_CONTENT[key]
    const room = (rooms ?? []).find((r) => r.name === content.dbName)
    return {
      dbName: content.dbName,
      label: content.label,
      normalRate: room ? Number(room.price_per_night) : null,
    }
  })

  return (
    <main className="mx-auto max-w-3xl px-6 pt-6 pb-12 md:px-12">
      <p className="text-xs tracking-widest text-brass uppercase">Pricing</p>
      <h1 className="mt-2 font-display text-3xl text-charcoal">Promotions</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Promo prices switch on and off by themselves on their dates — on the website, the booking
        form and New booking. Nothing else needs changing.
      </p>

      {notSetUp ? (
        <p className="mt-8 rounded-sm border border-clay/30 bg-clay/5 p-4 text-sm text-charcoal/80">
          Promotions aren&apos;t set up in the database yet. Run{' '}
          <code className="text-xs">supabase/migrations/20261030_promotions_and_discounts.sql</code> in
          Supabase, then reload this page.
        </p>
      ) : error ? (
        <p className="mt-8 text-sm text-clay">Couldn&apos;t load promotions: {error.message}</p>
      ) : (
        <div className="mt-8">
          <PromotionsManager promotions={promotions} roomTypes={roomTypes} today={todayInLagos()} />
        </div>
      )}
    </main>
  )
}
