import { displayText } from '../services/presentation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { authPageLink } from '../../auth/services/redirects'
import { discoveryContext } from '../services/model'
import { discoveryConfig,parseDiscoveryQuery,validOpportunityId,type Opportunity,type OpportunityKind,type SearchResult } from '../services/model'
import { getOpportunity,savedOpportunities,saveOpportunity,searchOpportunities } from '../services/discovery'
import { PublicDialog } from '../components/PublicDialog'
import { FilterControls } from '../components/FilterControls'
import { OpportunityCard } from '../components/OpportunityCard'
import { OpportunityDetails } from '../components/OpportunityDetails'
import { AuthConversionPrompt,type ConversionIntent } from '../components/AuthConversionPrompt'
import { QualificationChecker } from '../components/QualificationChecker'

const intents:ConversionIntent[]=['save','money','profile']
export function DiscoveryPage({kind}: {kind:OpportunityKind}) {
 const navigate=useNavigate(),[params,setParams]=useSearchParams()
 const {user,isLoading:authLoading}=useAuth()
 const mounted=useRef(true),currentUser=useRef(user?.id),saveInFlight=useRef(false),resumedSave=useRef<string|null>(null)
 currentUser.current=user?.id
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false}},[])
 const config=discoveryConfig[kind]
 const parsed=parseDiscoveryQuery(kind,params)
 const queryKey=JSON.stringify(parsed)
 const [result,setResult]=useState<SearchResult|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 const [filtersOpen,setFiltersOpen]=useState(false)
 const selectedId=params.get('opportunity')
 const checkerOpen=params.get('check')==='1'||params.get('intent')==='match'
 function setCheckerOpen(open:boolean){setParams(previous=>{const next=new URLSearchParams(previous);if(open)next.set('check','1');else{next.delete('check');if(next.get('intent')==='match')next.delete('intent')}return next},{replace:true})}
 const [detail,setDetail]=useState<Opportunity|null>(null),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState(false),[detailRetry,setDetailRetry]=useState(0)
 const [prompt,setPrompt]=useState<{item:Opportunity;intent:ConversionIntent}|null>(null)
 const [saved,setSaved]=useState<string[]>([]),[savedScope,setSavedScope]=useState(''),[savedLoading,setSavedLoading]=useState(false),[savedError,setSavedError]=useState(false),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[notice,setNotice]=useState('')
 const ids=useMemo(()=>[...new Set([...(result?.items.map(item=>item.id)??[]),...(detail?[detail.id]:[])])].sort(),[result,detail])
 const idsKey=ids.join(',')
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError(false);const timer=setTimeout(()=>{void searchOpportunities(kind,parsed.query,parsed.filters,parsed.page,controller.signal).then(data=>{if(!controller.signal.aborted)setResult(data)}).catch(()=>{if(!controller.signal.aborted)setError(true)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})},250);return ()=>{clearTimeout(timer);controller.abort()}
 // The serialized key includes every query/filter/page dependency.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[kind,queryKey,retry])
 useEffect(()=>{const controller=new AbortController();setDetail(null);setDetailError(false);if(!selectedId){setDetailLoading(false);return ()=>controller.abort()};setDetailLoading(true);if(!validOpportunityId(selectedId)){setDetailError(true);setDetailLoading(false);return ()=>controller.abort()};void getOpportunity(kind,selectedId,controller.signal).then(item=>{if(!controller.signal.aborted){setDetail(item);if(!item)setDetailError(true)}}).catch(()=>{if(!controller.signal.aborted)setDetailError(true)}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false)});return ()=>controller.abort()},[kind,selectedId,detailRetry])
 useEffect(()=>{let active=true;setSaved([]);setSavedScope('');setSavedError(false);if(!user){setSavedLoading(false);return};setSavedLoading(true);void savedOpportunities(user.id,ids).then(value=>{if(active){setSaved(value);setSavedScope(`${user.id}:${idsKey}`)}}).catch(()=>{if(active)setSavedError(true)}).finally(()=>{if(active)setSavedLoading(false)});return ()=>{active=false}
 // idsKey is a stable representation of the currently visible opportunities.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[user?.id,idsKey,retry])
 useEffect(()=>{const intent=params.get('intent');if(detail&&intent&&intent!=='save'&&intents.includes(intent as ConversionIntent)){setPrompt({item:detail,intent:intent as ConversionIntent});setSaveError('')}},[detail,params])
 useEffect(()=>{
  if(params.get('intent')!=='save'){resumedSave.current=null;return}
  if(!detail||authLoading)return
  if(!user){navigate(authPageLink('/login',discoveryContext(detail,'save')),{replace:true});return}
  const key=`${user.id}:${detail.id}`
  if(savedScope!==`${user.id}:${idsKey}`||saving||savedError||resumedSave.current===key)return
  resumedSave.current=key
  void toggleSave(detail,true)
 // Resume the explicitly requested save once authentication and saved-state loading finish.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[detail,user?.id,authLoading,params,savedScope,idsKey,saving,savedError])
 useEffect(()=>{setNotice('')},[user?.id])
 function update(key:string,value:string) {setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set(key,value);else next.delete(key);next.delete('page');return next},{replace:true})}
 function clearFilters() {setParams(previous=>{const next=new URLSearchParams();for(const key of ['opportunity','intent'])if(previous.has(key))next.set(key,previous.get(key)!);return next})}
 function openItem(nextKind:OpportunityKind,id:string) {if(nextKind===kind)setParams(previous=>{const next=new URLSearchParams(previous);next.set('opportunity',id);next.delete('intent');return next});else navigate(`/${nextKind}?${new URLSearchParams({opportunity:id})}`)}
 function closeDetail() {setPrompt(null);setParams(previous=>{const next=new URLSearchParams(previous);next.delete('opportunity');next.delete('intent');return next},{replace:true})}
 function closePrompt() {setPrompt(null);setSaveError('');if(params.has('intent'))setParams(previous=>{const next=new URLSearchParams(previous);next.delete('intent');return next},{replace:true})}
 async function toggleSave(item:Opportunity,forceSave=false) {
  setSaveError('');setNotice('')
  if(authLoading)return
  if(!user){navigate(authPageLink('/login',discoveryContext(item,'save')));return}
  if(saveInFlight.current||saving||savedLoading||savedError)return
  const userId=user.id
  const shouldSave=forceSave||!saved.includes(item.id)
  saveInFlight.current=true;setSaving(true)
  try {await saveOpportunity(userId,item.id,shouldSave);if(!mounted.current||currentUser.current!==userId)return;setSaved(previous=>shouldSave?[...new Set([...previous,item.id])]:previous.filter(id=>id!==item.id));setNotice(shouldSave?'Saved to your VIA.':'Removed from saved opportunities.');closePrompt()}
  catch {if(mounted.current&&currentUser.current===userId)setSaveError('We could not update your saved opportunities. Check your connection and try again.')}
  finally {saveInFlight.current=false;if(mounted.current)setSaving(false)}
 }
 const filterProps={kind,result,filters:parsed.filters,onChange:update,onClear:clearFilters}
 const titleWords=config.title.split(' ')
 const titleAccent=titleWords.pop()
 return <main id="discovery-main" className={`via-discovery-page is-${kind}`}>
  <section className="via-discovery-hero" aria-labelledby="discovery-title">
  <div className="via-discovery-intro"><p className="via-public-overline">Explore your possibilities</p><h1 id="discovery-title">{titleWords.join(' ')} <span>{titleAccent}</span></h1><p>{config.copy}</p><span className="via-discovery-public-note">Start exploring. No account needed.</span></div>
  <div className="via-discovery-search-row"><label className="via-discovery-search"><Search size={22} aria-hidden="true"/><span className="via-public-sr-only">{config.search}</span><input type="search" maxLength={160} placeholder={config.search} value={params.get('q')??''} onChange={event=>update('q',event.target.value)}/></label><button className="via-public-button via-discovery-filter-toggle" type="button" aria-haspopup="dialog" onClick={()=>setFiltersOpen(true)}><SlidersHorizontal size={19}/>Filters{Object.keys(parsed.filters).length?` (${Object.keys(parsed.filters).length})`:''}</button></div>
  {Object.keys(parsed.filters).length>0&&<div className="via-discovery-active-filters" role="group" aria-label="Active filters">{Object.entries(parsed.filters).map(([key,value])=>{
   const filter=config.filters.find(filter=>filter.key===key)
   const valueLabel=displayText(filter?.options?.find(option=>option.value===value)?.label??(key==='institution'?result?.institutions.find(option=>option.value===value)?.label:key==='programme'?result?.programmeOptions?.find(option=>option.value===value)?.label:undefined)??value)
   return <button type="button" key={key} onClick={()=>update(key,'')} aria-label={`Remove ${filter?.label??key}: ${valueLabel}`}><span>{filter?.label??key}: {valueLabel}</span><X size={14} aria-hidden="true"/></button>
  })}</div>}
  {(kind==='programmes'||kind==='institutions')&&<button className="via-public-text-button" type="button" onClick={()=>setCheckerOpen(true)}>Check what I qualify for<ArrowRight size={17}/></button>}
  </section>
  <div className="via-discovery-layout"><section className="via-discovery-results" aria-label={`${config.label} results`} aria-busy={loading}>
   <div className="via-discovery-results-heading"><p role="status">{loading?'Finding your options…':error?'Your options could not be loaded':`${result?.total??0} ${config.label.toLowerCase()} in this curated catalogue`}</p>{(parsed.query||Object.keys(parsed.filters).length>0)&&<button className="via-public-text-button" type="button" onClick={clearFilters}>Clear search & filters</button>}</div>
   {savedError&&<p role="alert" className="via-public-inline-notice">Saved status could not be loaded.<button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>}
   {saveError&&!prompt&&<p className="via-public-inline-notice" role="alert">{saveError}</p>}{notice&&<p className="via-public-inline-notice" role="status">{notice}</p>}
   {loading?<div className="via-discovery-grid" aria-label="Loading opportunities">{[1,2,3,4,5,6].map(value=><div className="via-public-skeleton" key={value}><span/><span/><span/></div>)}</div>:error?<div className="via-public-empty" role="alert"><Search size={30}/><h2>Let’s try that again</h2><p>We couldn’t load the catalogue. Check your connection and try again.</p><button type="button" className="via-public-button is-primary" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:!result?.items.length?<div className="via-public-empty"><Search size={30}/><h2>{parsed.query||Object.keys(parsed.filters).length?`No ${config.label.toLowerCase()} matched these filters.`:'More possibilities are on their way.'}</h2><p>{parsed.query||Object.keys(parsed.filters).length?'Try a broader search or clear your filters.':'This catalogue is being curated from official sources. Check back for new listings.'}</p><button className="via-public-button" type="button" onClick={clearFilters}>Clear filters</button></div>:<><div className="via-discovery-grid">{result.items.map(item=><OpportunityCard key={item.id} item={item} onOpen={()=>openItem(kind,item.id)} onSave={()=>void toggleSave(item)} saved={saved.includes(item.id)} busy={authLoading||saving||savedLoading}/>)}</div><div className="via-public-pagination"><button type="button" disabled={parsed.page===1} onClick={()=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('page',String(parsed.page-1));return next})}><ArrowLeft size={16}/>Previous</button><span>Page {parsed.page} of {Math.max(1,Math.ceil(result.total/12))}</span><button type="button" disabled={parsed.page*12>=result.total} onClick={()=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('page',String(parsed.page+1));return next})}>Next<ArrowRight size={16}/></button></div></>}
  </section></div>
  <p className="via-discovery-quality-note">A carefully curated starting point. Dates, prices and requirements can change—check the linked official source for your intended year.</p>
  {filtersOpen&&<PublicDialog title="Filter your options" onClose={()=>setFiltersOpen(false)} compact><FilterControls {...filterProps}/><div className="via-public-filter-done"><button className="via-public-button is-primary" type="button" onClick={()=>setFiltersOpen(false)}>Show results<ArrowRight size={17}/></button></div></PublicDialog>}
  {selectedId&&<PublicDialog title={detail?.title??'Opportunity details'} onClose={closeDetail}>{detailLoading?<div className="via-public-empty" role="status">Loading opportunity details…</div>:detailError?<div className="via-public-empty" role="alert"><h2>This opportunity couldn’t be opened.</h2><p>It may no longer be listed, or your connection may need another try.</p><button className="via-public-button" type="button" onClick={()=>setDetailRetry(value=>value+1)}>Try again</button></div>:detail&&<OpportunityDetails key={detail.id} item={detail} onOpen={openItem} onSave={item=>void toggleSave(item)} onConvert={intent=>intent==='match'?setCheckerOpen(true):setPrompt({item:detail,intent})} saved={saved} busy={authLoading||saving||savedLoading}/>}</PublicDialog>}
  {prompt&&<AuthConversionPrompt item={prompt.item} intent={prompt.intent} onClose={closePrompt} onSave={()=>void toggleSave(prompt.item,true)} saving={saving||savedLoading} error={saveError}/>}
  {checkerOpen&&<QualificationChecker onClose={()=>setCheckerOpen(false)} onView={id=>{const next=new URLSearchParams(kind==='programmes'?params:undefined);next.delete('check');next.delete('intent');next.set('opportunity',id);navigate(`/programmes?${next}`)}}/>}
 </main>
}
