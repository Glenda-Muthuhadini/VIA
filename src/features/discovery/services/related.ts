import { supabase } from '../../../services/supabase'
import type { Opportunity } from './model'
import { presentCatalogue } from './presentation'
export type RelatedItem = Opportunity & {relationship_note?:string}
export type RelatedOpportunities = {institutions:RelatedItem[];programmes:RelatedItem[];funding:RelatedItem[];accommodation:RelatedItem[]}
export async function getRelatedOpportunities(item:Opportunity,signal:AbortSignal):Promise<RelatedOpportunities> {
 const {data,error}=await supabase.rpc('related_public_opportunities',{p_id:item.id}).abortSignal(signal)
 if(error)throw error
 if(!data||!['institutions','programmes','funding','accommodation'].every(key=>Array.isArray(data[key])))throw new Error('Related options unavailable')
 const related=data as RelatedOpportunities
 if(item.is_demo)for(const key of ['institutions','programmes','funding','accommodation'] as const)related[key].sort((a,b)=>Number(!!b.is_demo)-Number(!!a.is_demo))
 if(item.kind==='programmes'||item.kind==='institutions'){
  const table=item.kind==='programmes'?'via_bursary_programmes':'via_bursary_institutions'
  const column=item.kind==='programmes'?'programme_id':'institution_id'
  const {data:notes,error:notesError}=await supabase.from(table).select('bursary_id,relationship_note').eq(column,item.id).limit(24).abortSignal(signal)
  if(notesError)throw notesError
  const noteMap=new Map((notes??[]).map(row=>[row.bursary_id,row.relationship_note]))
  related.funding=related.funding.map(funding=>({...funding,relationship_note:noteMap.get(funding.id)}))
 }
 return presentCatalogue(related)
}
