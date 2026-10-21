import { supabase } from '../../../services/supabase'
import type { Opportunity, OpportunityKind } from '../../discovery/services/model'
import { programmeName } from '../../discovery/services/programme-model'
import type { SavedOpportunity } from './dashboard-model'

const kinds:Record<OpportunityKind,SavedOpportunity['kind']>={institutions:'institution',programmes:'programme',bursaries:'funding',accommodation:'accommodation'}
export async function loadSavedOpportunities(userId:string):Promise<SavedOpportunity[]> {
  const ids:string[]=[]
  for(let offset=0;;offset+=500){
    const {data,error}=await supabase.from('via_saved_opportunities').select('opportunity_id').eq('user_id',userId).order('opportunity_id').range(offset,offset+499)
    if(error)throw error
    ids.push(...data.map(row=>row.opportunity_id as string))
    if(data.length<500)break
  }
  const items:SavedOpportunity[]=[]
  for(let offset=0;offset<ids.length;offset+=100){
    const {data,error}=await supabase.from('via_public_opportunities').select('document').in('id',ids.slice(offset,offset+100))
    if(error)throw error
    for(const row of data){
      const item=row.document as Opportunity
      if(!kinds[item.kind])continue
      items.push({id:item.id,title:item.kind==='programmes'?programmeName(item):item.title,kind:kinds[item.kind]})
    }
  }
  return items.sort((a,b)=>a.title.localeCompare(b.title))
}
