'use client'

import { useEffect, useRef, useState } from 'react'
import type { Room } from '@/lib/types'

type RoomOption = Room & { available: boolean }

function roomLabel(room: RoomOption): string {
  return `${room.room_number} — ${room.name} (₦${room.price_per_night.toLocaleString()}/night)`
}

export default function RoomSelect({
  rooms,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select a room',
}: {
  rooms: RoomOption[]
  value: string
  onChange: (roomId: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const selectedRoom = rooms.find((room) => room.id === value)

  function handleSelect(room: RoomOption) {
    if (!room.available) return
    onChange(room.id)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-sm border border-charcoal/20 px-4 py-3 text-left text-sm focus:border-verdant focus:outline-none disabled:opacity-50"
      >
        <span className={selectedRoom ? 'text-charcoal' : 'text-charcoal/40'}>
          {selectedRoom ? roomLabel(selectedRoom) : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-verdant transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-sm border border-charcoal/10 bg-white p-1 shadow-xl">
          {rooms.length === 0 ? (
            <p className="px-3 py-3 text-sm text-charcoal/50">No rooms found.</p>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                disabled={!room.available}
                onClick={() => handleSelect(room)}
                className={`flex w-full flex-col items-start rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                  !room.available
                    ? 'cursor-not-allowed text-charcoal/30'
                    : room.id === value
                      ? 'bg-verdant/10 text-verdant'
                      : 'text-charcoal hover:bg-verdant/5'
                }`}
              >
                <span>{roomLabel(room)}</span>
                {!room.available && (
                  <span className="text-xs text-clay/70">Unavailable for these dates</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
