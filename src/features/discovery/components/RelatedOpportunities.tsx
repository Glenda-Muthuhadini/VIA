import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import type { Opportunity, OpportunityKind } from '../services/model'
import { getRelatedOpportunities, type RelatedOpportunities as RelatedData } from '../services/related'
import './related.css'

export function RelatedOpportunities({item,onOpen,onProgrammes}:{item:Opportunity;onOpen:(kind:OpportunityKind,id:string)=>void;onProgrammes:()=>void}) {
 const [data,setData]=useState<RelatedData|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 const [expanded,setExpanded]=useState<string[]>([])
 useEffect(()=>{const controller=new AbortController();void getRelatedOpportunities(item,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value)}).catch(()=>{if(!controller.signal.aborted)setError(true)});return()=>controller.abort()},[item,retry])
 if(error)return <section className="via-public-related" role="alert"><p>Related options could not be loaded.</p><button className="via-public-text-button" type="button" onClick={()=>{setError(false);setRetry(value=>value+1)}}>Try again</button></section>
 if(!data)return <p className="via-public-related-loading" role="status">Finding connected options…</p>
 const groups=[{key:'institutions',title:'Institution',kind:'institutions'},{key:'programmes',title:'Connected programmes',kind:'programmes'},{key:'funding',title:'Funding to explore',kind:'bursaries'},{key:'accommodation',title:'Accommodation options',kind:'accommodation'}] as const
 return <section className="via-public-related" aria-label="Connected opportunities">
  {item.kind==='institutions'&&<button className="via-public-button" type="button" onClick={onProgrammes}>Explore this institution’s programmes<ArrowRight size={17}/></button>}
  <div className="via-public-related-grid">{groups.filter(group=>!(item.kind==='institutions'&&group.key==='programmes')).map(group=>{
   const items=data[group.key]
   if(!items.length)return null
   const visible=expanded.includes(group.key)?items:items.slice(0,3)
   return <section key={group.key} className={'via-public-related-group is-'+group.key}><h3>{group.title}</h3>
    {group.key==='funding'&&<p>Provider, qualification and applicant requirements apply.</p>}
    {group.key==='accommodation'&&<p>Confirm campus suitability, price and availability.</p>}
    <ul>{visible.map(option=><li key={option.id}><button className="via-public-text-button" type="button" onClick={()=>onOpen(group.kind,option.id)}>{option.title}<ArrowRight size={16}/></button>{option.relationship_note&&<small>{option.relationship_note}</small>}</li>)}</ul>
    {items.length>3&&<button className="via-public-text-button" type="button" onClick={()=>setExpanded(previous=>previous.includes(group.key)?previous.filter(key=>key!==group.key):[...previous,group.key])}>{expanded.includes(group.key)?'Show fewer':'Show all '+items.length}</button>}
   </section>
  })}</div>
  {(item.kind==='institutions'||item.kind==='programmes')&&!data.accommodation.length&&<p>No accommodation association is verified for this listing. <Link to="/accommodation">Explore accommodation</Link></p>}
 </section>
}
