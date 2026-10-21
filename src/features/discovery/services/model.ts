export const kinds = ['institutions','programmes','bursaries','accommodation'] as const
export type OpportunityKind = typeof kinds[number]
export type Provenance = { source_url: string | null; source_name: string; last_verified_at: string | null; academic_year: number | null; is_demo?: boolean }
export type ApplicationCycle = Provenance & { id: string; label: string; opens_on: string | null; closes_on: string | null; fee: number | null; fee_note: string | null }
export type Requirement = Provenance & { id: string; subject: string | null; minimum_percentage: number | null; detail: string; recommended: boolean }
export type Opportunity = Provenance & {
 career_keywords?: string[] | null;
 programme_group?: { name: string; qualification: string; duration: string; fields: string[]; careers: string[]; institution_count: number; offerings: Opportunity[] };
 id: string; kind: OpportunityKind; slug: string; title: string; overview: string; location: string | null; province: string | null;
 website_url: string | null; application_url: string | null; image_url: string | null; logo_url: string | null;
 abbreviation: string | null; institution_type: string | null; programme_count: number | null;
 aps_range?: { aps_min: number | null; aps_max: number | null };
 institution_id: string | null; institution_name: string | null; campus: string | null;
 faculty: string | null; field: string | null; qualification: string | null; duration: string | null;
 study_mode?: string | null;
 minimum_aps: number | null; mathematics_required: boolean | null; requirements: Requirement[];
 provider: string | null; funding_type: string | null; fields: string[] | null; study_levels: string[] | null;
 coverage: string[] | null; required_documents: string[] | null; eligibility: (Provenance & { id: string; criterion: string })[];
 accommodation_type: string | null; starting_price: number | null; price_period: string | null; room_types: string[] | null; amenities: string[] | null;
 nsfas_compatible: boolean | null; nsfas_source_url: string | null; nsfas_verified_at: string | null; contact: string | null;
 address?: string | null; phone?: string | null; email?: string | null;
 institutions: { id: string; name: string; campus?: string | null; distance_km?: number | null }[]; cycles: ApplicationCycle[];
}
export type FilterDefinition = { key: string; label: string; type?: 'number' | 'date'; options?: { value: string; label: string }[] }
export type SearchResult = { items: Opportunity[]; total: number; facets: Record<string,string[]>; institutions: { value: string; label: string }[]; programmeOptions?: {value:string;label:string}[] }
const choices = (values: [string,string][]) => values.map(([value,label])=>({value,label}))
const applications: FilterDefinition = { key:'applications',label:'Applications',options:choices([['true','Open applications only']]) }
export const discoveryConfig: Record<OpportunityKind,{label:string;title:string;copy:string;search:string;action:string;filters:FilterDefinition[]}> = {
 institutions:{label:'Institutions',title:'Find your institution',copy:'Explore higher education institutions, programmes, application dates, fees and more.',search:'Search universities, colleges or institutions...',action:'View institution',filters:[{key:'province',label:'Province'},{key:'institution_type',label:'Institution type'},applications,{key:'fee',label:'Application fee',options:choices([['free','No application fee'],['paid','Application fee charged']])}]},
 programmes:{label:'Programmes',title:'Explore programmes',copy:'Discover programmes across South African institutions and understand what you need to get in.',search:'Search programmes, careers or fields...',action:'View programme',filters:[{key:'field',label:'Field of study'},{key:'institution',label:'Institution'},{key:'province',label:'Province'},{key:'qualification',label:'Qualification type'},{key:'aps_min',label:'Minimum APS from',type:'number'},{key:'aps_max',label:'Minimum APS up to',type:'number'},{key:'mathematics',label:'Mathematics required',options:choices([['true','Required'],['false','Not required (verified)']])},applications]},
 bursaries:{label:'Funding',title:'Find funding',copy:'Discover bursaries and funding opportunities that could help fund your studies.',search:'Search bursaries or funding opportunities...',action:'View funding',filters:[{key:'field',label:'Field of study'},{key:'funding_type',label:'Funding type'},{key:'study_level',label:'Study level'},{key:'institution',label:'Institution'},{key:'programme',label:'Programme offering'},{key:'closing_before',label:'Closes on or before',type:'date'},{key:'coverage',label:'What it covers'}]},
 accommodation:{label:'Accommodation',title:'Find student accommodation',copy:'Explore student accommodation options around your institution.',search:'Search accommodation, institution, campus or location...',action:'View accommodation',filters:[{key:'institution',label:'Institution'},{key:'campus',label:'Campus'},{key:'location',label:'Location'},{key:'accommodation_type',label:'Accommodation type'},{key:'price_min',label:'Monthly price from (R)',type:'number'},{key:'price_max',label:'Monthly price up to (R)',type:'number'},{key:'nsfas',label:'NSFAS compatibility',options:choices([['true','Verified compatible']])},{key:'amenity',label:'Amenities'}]},
}
export function safeExternalUrl(value: string | null | undefined) {
 try { const url=new URL(value ?? ''); return url.protocol==='https:'&&!url.username&&!url.password?url.href:null } catch { return null }
}
export const validOpportunityId = (id: string | null): id is string => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
export function parseDiscoveryQuery(kind: OpportunityKind, params: URLSearchParams) {
 const filters: Record<string,string>={}
 for(const filter of discoveryConfig[kind].filters) {
  const value=params.get(filter.key)?.slice(0,200).trim()
  if(!value) continue
  if(filter.type==='number'&&!/^\d{1,8}(\.\d{1,2})?$/.test(value)) continue
  if(filter.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)) continue
  if(filter.options&&!filter.options.some(option=>option.value===value)) continue
  filters[filter.key]=value
 }
 const requested=Number(params.get('page')??1)
 return {query:(params.get('q')??'').slice(0,160),filters,page:Number.isInteger(requested)&&requested>=1&&requested<=10000?requested:1}
}
export function discoveryContext(item: Pick<Opportunity,'id'|'kind'>,intent: 'save'|'match'|'money'|'profile') {
 return `/${item.kind}?${new URLSearchParams({opportunity:item.id,intent})}`
}
export const money = (value: number) => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(value)
export const dateLabel = (value: string | null) => value ? new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Johannesburg'}) : 'Check official source'
export function applicationStatus(cycles: ApplicationCycle[], now = new Date()) {
 const cycle=cycles[0]
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
 if(!cycle) return 'Check application dates'
 if(cycle.closes_on && cycle.closes_on<today) return 'Applications closed'
 if(cycle.opens_on && cycle.opens_on>today) return 'Opens '+dateLabel(cycle.opens_on)
 if(cycle.opens_on && cycle.closes_on && cycle.opens_on<=today && cycle.closes_on>=today) return 'Applications open'
 return 'Check application dates'
}
