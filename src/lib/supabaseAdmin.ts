// Server-only Supabase client using the service-role key — this BYPASSES
// Row Level Security entirely. Never import this into a client component,
// or any module that could end up in the browser bundle; only Server
// Components and Server Actions should ever touch it.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
