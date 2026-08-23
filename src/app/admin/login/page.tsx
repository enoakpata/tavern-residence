'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_REDIRECT = '/admin/bookings'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    // Only trust a redirect target that actually points back into the
    // admin area — anything else (missing, malformed, or pointed at the
    // login page itself) falls back to the default dashboard.
    const redirectParam = searchParams.get('redirect')
    const target =
      redirectParam && redirectParam.startsWith('/admin/') && redirectParam !== '/admin/login'
        ? redirectParam
        : DEFAULT_REDIRECT

    router.push(target)
    router.refresh()
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-sm border border-charcoal/10 bg-white p-8"
      >
        <p className="text-xs tracking-widest text-brass uppercase">
          Staff access
        </p>
        <h1 className="mt-2 font-display text-2xl text-charcoal">
          Tavern Residence Admin
        </h1>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs tracking-widest text-charcoal/60 uppercase">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs tracking-widest text-charcoal/60 uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-sm border border-charcoal/20 px-4 py-3 text-sm focus:border-verdant focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-clay">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-sm bg-verdant py-3 text-sm tracking-widest text-ivory uppercase transition-colors hover:bg-verdant/90 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
