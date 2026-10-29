// Server-only loading of promotions (the `promotions` table, managed from
// the admin Promotions page). The pricing rules themselves live in the
// dependency-free src/lib/pricing.ts; this just fetches the rows.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { rowToPromotion, type Promotion } from './pricing'

// "Table doesn't exist" as Postgres (42P01) and PostgREST (PGRST205)
// report it — i.e. supabase/migrations/20261030_promotions_and_discounts.sql
// hasn't been run yet. Treated as "no promos" so the site keeps working
// at normal prices instead of failing.
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])

/**
 * Every ACTIVE promotion (past, current and future — the table is small,
 * and a stay can be priced for any dates). Pass `client` from admin code
 * to read with the staff session; guest pages use the public client.
 */
export async function getPromotions(client: SupabaseClient = supabase): Promise<Promotion[]> {
  const { data, error } = await client.from('promotions').select('*').eq('active', true)
  if (error) {
    if (!MISSING_TABLE_CODES.has(error.code ?? '')) {
      console.error('getPromotions failed:', error)
    }
    return []
  }
  return (data ?? []).map((row) => rowToPromotion(row as Record<string, unknown>))
}
