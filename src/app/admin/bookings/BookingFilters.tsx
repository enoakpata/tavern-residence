'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const SOURCES = [
  { value: '', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
]

export default function BookingFilters({ years }: { years: number[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    router.push(next.size > 0 ? `${pathname}?${next.toString()}` : pathname)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateParam('search', search.trim())
  }

  function clearFilters() {
    setSearch('')
    router.push(pathname)
  }

  const hasActiveFilters = Boolean(
    searchParams.get('search') ||
      searchParams.get('month') ||
      searchParams.get('year') ||
      searchParams.get('source')
  )

  return (
    <div className="mt-6 flex flex-wrap items-end gap-4">
      <form onSubmit={handleSearchSubmit} className="min-w-[220px] flex-1">
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Search guest
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or phone"
            className="w-full rounded-sm border border-charcoal/20 px-4 py-2 text-sm focus:border-verdant focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-sm border border-charcoal/20 px-4 py-2 text-sm text-charcoal hover:bg-charcoal/5"
          >
            Search
          </button>
        </div>
      </form>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Month
        </label>
        <select
          value={searchParams.get('month') ?? ''}
          onChange={(e) => updateParam('month', e.target.value)}
          className="mt-2 rounded-sm border border-charcoal/20 px-3 py-2 text-sm focus:border-verdant focus:outline-none"
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Year
        </label>
        <select
          value={searchParams.get('year') ?? ''}
          onChange={(e) => updateParam('year', e.target.value)}
          className="mt-2 rounded-sm border border-charcoal/20 px-3 py-2 text-sm focus:border-verdant focus:outline-none"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs tracking-widest text-charcoal/60 uppercase">
          Source
        </label>
        <select
          value={searchParams.get('source') ?? ''}
          onChange={(e) => updateParam('source', e.target.value)}
          className="mt-2 rounded-sm border border-charcoal/20 px-3 py-2 text-sm focus:border-verdant focus:outline-none"
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-sm px-3 py-2 text-sm text-clay hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
