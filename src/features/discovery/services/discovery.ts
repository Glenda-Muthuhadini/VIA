import { supabase } from '../../../services/supabase'
import { validOpportunityId, type OpportunityKind, type Opportunity, type SearchResult } from './model'
import { institutionCardData, institutionSummaries } from './institutions'
import { presentCatalogue } from './presentation'
import { programmeOfferings } from './programmes'
import { groupProgrammes, programmeSearch } from './programme-model'
export async function searchOpportunities(kind: OpportunityKind,query: string,filters: Record<string,string>,page=1,signal?: AbortSignal): Promise<SearchResult> {
 if (kind === 'programmes') return programmeSearch(await programmeOfferings(signal),query,filters,page)
 if ((kind === 'bursaries' && filters.programme) || (kind === 'accommodation' && filters.campus)) return searchOfferingRelated(kind,query,filters,page,signal)
 let request=supabase.rpc('search_public_opportunities',{p_kind:kind,p_query:query,p_filters:filters,p_page:page,p_page_size:12})
 if(signal) request=request.abortSignal(signal)
 const {data,error}=await request
 if(error) throw error
 if(!data||!Array.isArray(data.items)||!Number.isFinite(data.total)||!data.facets||!Array.isArray(data.institutions)) throw new Error('Invalid catalogue response')
 if(kind==='institutions'&&data.items.length){const summaries=await institutionSummaries(data.items.map((item:Opportunity)=>item.id),signal);data.items=data.items.map((item:Opportunity)=>({...item,aps_range:summaries[item.id]}))}
 if(kind==='institutions'&&data.items.some((item:Opportunity)=>!institutionCardData(item)))throw new Error('Institution application information is incomplete')
 const result = {...data,items:presentCatalogue(data.items)} as SearchResult
 if (kind === 'bursaries') result.programmeOptions = (await programmeOfferings(signal)).map(item=>({value:item.id,label:`${item.title} — ${item.institution_name || 'Institution not listed'}`}))
 return result
}
export async function getOpportunity(kind: OpportunityKind,id: string,signal?: AbortSignal) {
 if(!validOpportunityId(id)) throw new Error('Invalid opportunity')
 if (kind === 'programmes') return groupProgrammes(await programmeOfferings(signal)).find(group=>group.programme_group!.offerings.some(offering=>offering.id===id)) ?? null
 let request=supabase.from('via_public_opportunities').select('document').eq('kind',kind).eq('id',id).limit(1)
 if(signal) request=request.abortSignal(signal)
 const {data,error}=await request.maybeSingle()
 if(error) throw error
 return presentCatalogue(data?.document??null) as Opportunity | null
}

async function searchOfferingRelated(kind: 'bursaries'|'accommodation', query: string, filters: Record<string,string>, page: number, signal?: AbortSignal): Promise<SearchResult> {
 const { programme, campus, ...serverFilters } = filters
 let allowed: Set<string> | null = null
 let programmeOptions: {value:string;label:string}[] = []
 if (kind === 'bursaries' && programme) {
   if (!validOpportunityId(programme)) throw new Error('Invalid programme filter')
   const offerings = await programmeOfferings(signal)
   programmeOptions = offerings.map(item=>({value:item.id,label:`${item.title} — ${item.institution_name || 'Institution not listed'}`}))
   const offering = offerings.find(item=>item.id===programme)
   allowed = new Set()
   if (offering && (!serverFilters.institution || offering.institution_id === serverFilters.institution)) {
     let direct = supabase.from('via_bursary_programmes').select('bursary_id').eq('programme_id',programme)
     if (signal) direct = direct.abortSignal(signal)
     const {data,error} = await direct
     if (error) throw error
     data?.forEach(row=>allowed!.add(row.bursary_id))
     if (serverFilters.institution) {
       let institutional = supabase.from('via_bursary_institutions').select('bursary_id').eq('institution_id',serverFilters.institution)
       if (signal) institutional = institutional.abortSignal(signal)
       const {data:institutionData,error:institutionError} = await institutional
       if (institutionError) throw institutionError
       institutionData?.forEach(row=>allowed!.add(row.bursary_id))
     }
   }
   // The relationship tables above enforce the institution/programme scope.
   // Do not additionally exclude programme-linked bursaries with no broad institution link.
   delete serverFilters.institution
 }
 const items: Opportunity[] = []
 let result: SearchResult | null = null
 for (let serverPage=1; ; serverPage++) {
   let request = supabase.rpc('search_public_opportunities',{p_kind:kind,p_query:query,p_filters:serverFilters,p_page:serverPage,p_page_size:24})
   if (signal) request=request.abortSignal(signal)
   const {data,error}=await request
   if (error) throw error
   if (!data || !Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('Invalid related catalogue')
   result = data as SearchResult
   items.push(...result.items)
   if (serverPage*24 >= result.total) break
 }
 const filtered = items.filter(item=>allowed ? allowed.has(item.id) : item.institutions.some(institution=>(!filters.institution || institution.id === filters.institution) && institution.campus?.toLowerCase() === campus?.toLowerCase()))
 const facets = {...result!.facets}
 if (kind === 'accommodation') facets.campus = [...new Set(items.flatMap(item=>item.institutions.filter(institution=>!filters.institution || institution.id===filters.institution).map(institution=>institution.campus).filter((value): value is string=>!!value)))].sort()
 return {...result!,items:presentCatalogue(filtered.slice((page-1)*12,page*12)),total:filtered.length,facets,programmeOptions}
}
export async function savedOpportunities(userId: string,ids: string[]) {
 if(!ids.length) return []
 const {data,error}=await supabase.from('via_saved_opportunities').select('opportunity_id').eq('user_id',userId).in('opportunity_id',ids.slice(0,48))
 if(error) throw error
 return data.map(item=>item.opportunity_id as string)
}
export async function saveOpportunity(userId: string,id: string,saved: boolean) {
 const {data:{session}}=await supabase.auth.getSession()
 if(session?.user.id!==userId) throw new Error('Please log in again to save this opportunity.')
 const request=saved?supabase.from('via_saved_opportunities').upsert({user_id:userId,opportunity_id:id},{onConflict:'user_id,opportunity_id',ignoreDuplicates:true}):supabase.from('via_saved_opportunities').delete().eq('user_id',userId).eq('opportunity_id',id)
 const {error}=await request
 if(error) throw error
}
