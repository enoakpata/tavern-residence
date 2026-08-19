import type { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/siteConfig'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: rooms } = await supabase.from('Rooms').select('id')

  const roomEntries: MetadataRoute.Sitemap = (rooms ?? []).map((room) => ({
    url: `${SITE_URL}/rooms/${room.id}`,
  }))

  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/rooms` },
    { url: `${SITE_URL}/contact` },
    { url: `${SITE_URL}/policies` },
    ...roomEntries,
  ]
}
