'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { promoRateFor, stayNights, type Promotion, type PromotionKind } from '@/lib/pricing'
import { savePromotion, setPromotionActive, deletePromotion } from './actions'

export type RoomTypePrice = {
  dbName: string
  label: string
  normalRate: number | null
}

type Status = 'running' | 'upcoming' | 'paused' | 'ended'

const STATUS_LABEL: Record<Status, string> = {
  running: 'Running now',
  upcoming: 'Upcoming',
  paused: 'Paused',
  ended: 'Ended',
}

const STATUS_STYLE: Record<Status, string> = {
  running: 'bg-verdant/15 text-verdant',
  upcoming: 'bg-brass/15 text-espresso',
  paused: 'bg-charcoal/10 text-charcoal/60',
  ended: 'bg-charcoal/5 text-charcoal/40',
}

const STATUS_ORDER: Status[] = ['running', 'upcoming', 'paused', 'ended']

function statusOf(promo: Promotion, today: string): Status {
  if (promo.lastNight < today) return 'ended'
  if (!promo.active) return 'paused'
  return promo.firstNight <= today ? 'running' : 'upcoming'
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function nightCount(firstNight: string, lastNight: string): number {
  // stayNights takes [checkIn, checkOut), so the day after the last night.
  const d = new Date(`${lastNight}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return stayNights(firstNight, d.toISOString().slice(0, 10)).length
}

type FormState = {
  id?: string
  name: string
  firstNight: string
  lastNight: string
  kind: PromotionKind
  rates: Record<string, string>
  percentOff: string
  repriceExisting: boolean
}

function emptyForm(today: string): FormState {
  return {
    name: '',
    firstNight: today,
    lastNight: today,
    kind: 'fixed',
    rates: {},
    percentOff: '',
    repriceExisting: true,
  }
}

function formFromPromotion(promo: Promotion): FormState {
  return {
    id: promo.id,
    name: promo.name,
    firstNight: promo.firstNight,
    lastNight: promo.lastNight,
    kind: promo.kind,
    rates: Object.fromEntries(Object.entries(promo.rates ?? {}).map(([k, v]) => [k, String(v)])),
    percentOff: promo.percentOff != null ? String(promo.percentOff) : '',
    // Off by default when editing — repricing is usually wanted once, when
    // the promo is first created.
    repriceExisting: false,
  }
}

const inputClass =
  'w-full rounded-sm border border-charcoal/20 px-3 py-2 text-sm text-charcoal focus:border-espresso focus:outline-none'
const pillButton =
  'rounded-full border border-charcoal/20 px-3 py-1 text-xs text-charcoal/70 hover:bg-charcoal/5 disabled:opacity-50'

export default function PromotionsManager({
  promotions,
  roomTypes,
  today,
}: {
  promotions: Promotion[]
  roomTypes: RoomTypePrice[]
  today: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState<null | { success: boolean; message: string }>(null)
  const [pendingDelete, setPendingDelete] = useState<Promotion | null>(null)

  function update(patch: Partial<FormState>) {
    setForm((f) => (f ? { ...f, ...patch } : f))
    setFormError('')
  }

  function handleSave() {
    if (!form) return
    if (!form.name.trim()) return setFormError('Give the promotion a name.')
    if (!form.firstNight || !form.lastNight) return setFormError('Choose the first and last night.')
    if (form.lastNight < form.firstNight) {
      return setFormError('The last night must be on or after the first night.')
    }
    const rates = Object.fromEntries(
      Object.entries(form.rates)
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([, v]) => v > 0)
    )
    if (form.kind === 'fixed' && Object.keys(rates).length === 0) {
      return setFormError('Enter a promo price for at least one room type.')
    }
    const percentOff = Number(form.percentOff)
    if (form.kind === 'percent' && !(percentOff > 0 && percentOff < 100)) {
      return setFormError('Enter a percentage between 1 and 99.')
    }

    const submitted = form
    startTransition(async () => {
      const res = await savePromotion({
        id: submitted.id,
        name: submitted.name,
        firstNight: submitted.firstNight,
        lastNight: submitted.lastNight,
        kind: submitted.kind,
        rates,
        percentOff,
        repriceExisting: submitted.repriceExisting,
      })
      if (!res.success) {
        setFormError(res.error)
        return
      }
      setForm(null)
      setNotice({
        success: true,
        message:
          `"${submitted.name.trim()}" saved.` +
          (submitted.repriceExisting
            ? res.repricedCount > 0
              ? ` ${res.repricedCount} booking${res.repricedCount === 1 ? '' : 's'} already made for these dates got the promo price.`
              : ' No existing bookings needed repricing.'
            : ''),
      })
      router.refresh()
    })
  }

  function handleToggleActive(promo: Promotion) {
    startTransition(async () => {
      const res = await setPromotionActive(promo.id, !promo.active)
      if (!res.success) setNotice({ success: false, message: res.error })
      router.refresh()
    })
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return
    const promo = pendingDelete
    setPendingDelete(null)
    startTransition(async () => {
      const res = await deletePromotion(promo.id)
      setNotice(
        res.success
          ? { success: true, message: `"${promo.name}" deleted.` }
          : { success: false, message: res.error }
      )
      router.refresh()
    })
  }

  // Other active promos overlapping the dates being edited — shown as a
  // note, since guests then get whichever price is lower.
  const overlapping = form
    ? promotions.filter(
        (p) =>
          p.id !== form.id &&
          p.active &&
          p.firstNight <= form.lastNight &&
          p.lastNight >= form.firstNight
      )
    : []

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: promotions.filter((p) => statusOf(p, today) === status),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-8">
      {form ? (
        <section className="rounded-sm border border-charcoal/10 bg-white p-5">
          <p className="font-display text-xl text-charcoal">
            {form.id ? 'Edit promotion' : 'New promotion'}
          </p>

          <label className="mt-4 block text-xs tracking-widest text-charcoal/60 uppercase">
            Name
          </label>
          <input
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. December festive promo"
            className={`mt-1 ${inputClass}`}
          />
          <p className="mt-1 text-[11px] text-charcoal/40">
            Guests see this next to the price, e.g. &ldquo;{form.name.trim() || 'December festive promo'}{' '}
            — ends {formatDate(form.lastNight || today).replace(/ \d{4}$/, '')}&rdquo;.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs tracking-widest text-charcoal/60 uppercase">
                First night
              </label>
              <input
                type="date"
                value={form.firstNight}
                onChange={(e) => update({ firstNight: e.target.value })}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className="block text-xs tracking-widest text-charcoal/60 uppercase">
                Last night
              </label>
              <input
                type="date"
                value={form.lastNight}
                min={form.firstNight}
                onChange={(e) => update({ lastNight: e.target.value })}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>
          {form.firstNight && form.lastNight && form.lastNight >= form.firstNight && (
            <p className="mt-1 text-[11px] text-charcoal/40">
              {nightCount(form.firstNight, form.lastNight)} night
              {nightCount(form.firstNight, form.lastNight) === 1 ? '' : 's'}. A stay that runs past
              the last night pays the normal price for the nights after it.
            </p>
          )}

          <p className="mt-5 text-xs tracking-widest text-charcoal/60 uppercase">Promo price</p>
          <div className="mt-2 inline-flex overflow-hidden rounded-sm border border-charcoal/20 text-xs">
            {(
              [
                ['fixed', 'Set price per room type'],
                ['percent', '% off all rooms'],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => update({ kind })}
                className={`px-3 py-1.5 ${form.kind === kind ? 'bg-espresso text-ivory' : 'text-charcoal/70'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.kind === 'fixed' ? (
            <div className="mt-3 space-y-2">
              {roomTypes.map((rt) => {
                const value = Number(form.rates[rt.dbName] ?? '')
                const higher = rt.normalRate != null && value > rt.normalRate
                return (
                  <div key={rt.dbName} className="grid grid-cols-[1fr_9rem] items-center gap-3 text-sm">
                    <div>
                      <p className="text-charcoal">{rt.label}</p>
                      <p className="text-[11px] text-charcoal/40">
                        Normal: {rt.normalRate != null ? `₦${rt.normalRate.toLocaleString()}` : '—'}
                        {higher ? ' · this is higher than normal' : ''}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      inputMode="numeric"
                      value={form.rates[rt.dbName] ?? ''}
                      onChange={(e) => update({ rates: { ...form.rates, [rt.dbName]: e.target.value } })}
                      placeholder="No change"
                      aria-label={`${rt.label} promo price per night`}
                      className={inputClass}
                    />
                  </div>
                )
              })}
              <p className="text-[11px] text-charcoal/40">Leave a room type blank to keep its normal price.</p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="99"
                  inputMode="decimal"
                  value={form.percentOff}
                  onChange={(e) => update({ percentOff: e.target.value })}
                  placeholder="e.g. 15"
                  aria-label="Percent off"
                  className={`${inputClass} max-w-[8rem]`}
                />
                <span className="text-sm text-charcoal/70">% off every room</span>
              </div>
              {Number(form.percentOff) > 0 && Number(form.percentOff) < 100 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-charcoal/50">
                  {roomTypes.map((rt) =>
                    rt.normalRate != null ? (
                      <li key={rt.dbName}>
                        {rt.label}: ₦
                        {(
                          promoRateFor(
                            { name: rt.dbName, price_per_night: rt.normalRate },
                            {
                              id: '',
                              name: '',
                              firstNight: '',
                              lastNight: '',
                              kind: 'percent',
                              rates: null,
                              percentOff: Number(form.percentOff),
                              active: true,
                            }
                          ) ?? rt.normalRate
                        ).toLocaleString()}{' '}
                        (normally ₦{rt.normalRate.toLocaleString()})
                      </li>
                    ) : null
                  )}
                </ul>
              )}
            </div>
          )}

          <label className="mt-5 flex items-start gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.repriceExisting}
              onChange={(e) => update({ repriceExisting: e.target.checked })}
            />
            <span>
              Also give the promo price to bookings already made for these dates
              <span className="block text-[11px] text-charcoal/50">
                Upcoming and checked-in guests only. Only ever lowers a total — never raises one.
                Each change shows in that booking&apos;s change history.
              </span>
            </span>
          </label>

          {overlapping.length > 0 && (
            <p className="mt-3 rounded-sm bg-brass/10 p-2 text-[11px] text-charcoal/70">
              Overlaps {overlapping.map((p) => `"${p.name}"`).join(', ')}. Where both apply, guests get
              the lower price.
            </p>
          )}

          {formError && <p className="mt-3 text-xs text-clay">{formError}</p>}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="rounded-sm bg-espresso px-5 py-2 text-xs tracking-widest text-ivory uppercase hover:bg-espresso/90 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save promotion'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setForm(null)}
              className="rounded-sm border border-charcoal/20 px-5 py-2 text-xs tracking-widest text-charcoal/70 uppercase hover:bg-charcoal/5"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm(today))
            setFormError('')
          }}
          className="rounded-sm bg-espresso px-5 py-3 text-xs tracking-widest text-ivory uppercase hover:bg-espresso/90"
        >
          New promotion
        </button>
      )}

      {promotions.length === 0 && !form && (
        <p className="text-sm text-charcoal/60">No promotions yet.</p>
      )}

      {grouped.map(({ status, items }) => (
        <section key={status}>
          <p className="text-xs tracking-widest text-charcoal/50 uppercase">{STATUS_LABEL[status]}</p>
          <ul className="mt-3 space-y-3">
            {items.map((promo) => (
              <li key={promo.id} className="rounded-sm border border-charcoal/10 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-charcoal">{promo.name}</p>
                    <p className="text-xs text-charcoal/50">
                      {formatDate(promo.firstNight)} – {formatDate(promo.lastNight)} ·{' '}
                      {nightCount(promo.firstNight, promo.lastNight)} nights
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>

                <p className="mt-2 text-sm text-charcoal/80">
                  {promo.kind === 'percent'
                    ? `${promo.percentOff}% off every room`
                    : roomTypes
                        .filter((rt) => promo.rates?.[rt.dbName] != null)
                        .map((rt) => `${rt.label} ₦${promo.rates![rt.dbName].toLocaleString()}`)
                        .join(' · ')}
                </p>

                {status !== 'ended' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setForm(formFromPromotion(promo))
                        setFormError('')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={pillButton}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleActive(promo)}
                      className={pillButton}
                    >
                      {promo.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPendingDelete(promo)}
                      className={pillButton}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete promotion"
        message={`Delete "${pendingDelete?.name ?? ''}"? Bookings already made keep the price they were given — only future prices change. To stop it for now without deleting it, use Pause instead.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={notice !== null}
        title={notice?.success ? 'Done' : 'Something went wrong'}
        message={notice?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
    </div>
  )
}
