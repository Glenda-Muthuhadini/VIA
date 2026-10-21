import { supabase } from '../../../services/supabase'
import type { Opportunity } from './model'
import { presentCatalogue } from './presentation'

// Read through the existing RLS-protected public view. Complete the catalogue
// before grouping so pagination cannot split institutions across duplicate cards.
export async function programmeOfferings(signal?: AbortSignal): Promise<Opportunity[]> {
  const items: Opportunity[] = []
  for (let offset = 0; ; offset += 500) {
    let request = supabase.from('via_public_opportunities').select('document').eq('kind','programmes').order('id').range(offset,offset+499)
    if (signal) request = request.abortSignal(signal)
    const { data,error } = await request
    if (error) throw error
    if (!data || data.some(row=>!row.document || row.document.kind !== 'programmes')) throw new Error('Invalid programme catalogue')
    items.push(...data.map(row=>row.document as Opportunity))
    if (data.length < 500) break
  }
  return presentCatalogue(items)
}
