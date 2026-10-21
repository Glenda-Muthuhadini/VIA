import { supabase } from '../../../services/supabase'
import type { Opportunity } from './model'
import { presentCatalogue } from './presentation'
import { groupProgrammes } from './programme-model'

export async function fundingProgrammes(id: string, signal: AbortSignal): Promise<Opportunity[]> {
  const ids = new Set<string>()
  for (let offset=0; ; offset+=500) {
    const {data,error}=await supabase.from('via_bursary_programmes').select('programme_id').eq('bursary_id',id).order('programme_id').range(offset,offset+499).abortSignal(signal)
    if(error)throw error
    if(!data)throw new Error('Funding programme links could not be loaded')
    data.forEach(row=>ids.add(row.programme_id))
    if(data.length<500)break
  }
  const programmes: Opportunity[]=[]
  const linked=[...ids]
  for(let offset=0;offset<linked.length;offset+=200){
    const {data,error}=await supabase.from('via_public_opportunities').select('document').eq('kind','programmes').in('id',linked.slice(offset,offset+200)).order('id').range(0,199).abortSignal(signal)
    if(error)throw error
    if(!data || data.some(row=>!row.document))throw new Error('Funding programmes could not be loaded')
    programmes.push(...data.map(row=>row.document as Opportunity))
  }
  return groupProgrammes(presentCatalogue(programmes))
}
