import { SaveButton } from './SaveButton'
import { useEffect, useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { safeExternalUrl, type Opportunity } from '../services/model'
import { fundingClosingDate, fundingList } from '../services/funding-model'
import { fundingProgrammes } from '../services/funding'
import './funding.css'

export function FundingDetails({item,onSave,saved,busy}: {item:Opportunity;onSave:()=>void;saved:boolean;busy:boolean}) {
  const [programmes,setProgrammes]=useState<Opportunity[]>([])
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading')
  const [retry,setRetry]=useState(0)
  const closing=fundingClosingDate(item)
  const coverage=fundingList(item.coverage)
  const eligibility=fundingList(item.eligibility.map(row=>row.criterion))
  const fields=fundingList(item.fields)
  const documents=fundingList(item.required_documents)
  const institutions=[...new Map(item.institutions.filter(institution=>institution.name?.trim()).map(institution=>[institution.id,institution])).values()]
  const application=safeExternalUrl(item.application_url)
  useEffect(()=>{
    const controller=new AbortController()
    void fundingProgrammes(item.id,controller.signal).then(value=>{if(!controller.signal.aborted){setProgrammes(value);setStatus('ready')}}).catch(()=>{if(!controller.signal.aborted)setStatus('error')})
    return ()=>controller.abort()
  },[item.id,retry])
  return <div className="via-public-detail-content via-funding-details">
    <header className="via-funding-header via-save-heading">
      <div><h2>{item.title}</h2><p className="via-funding-provider">{item.provider || 'Provider not listed'}</p><p className="via-funding-type">{item.funding_type || 'Funding type not listed'}</p><p className="via-funding-closing">{closing?`Closes: ${closing}`:'Closing date not listed'}</p></div>
      <SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/>
    </header>
    {item.is_demo&&<p className="via-funding-demo-notice">Demo funding example. This is not a real funding award or application opportunity.</p>}
    <section className="via-funding-section"><h3>About</h3><p>{item.overview || 'A description has not been listed. Check the provider’s official information.'}</p></section>
    <section className="via-funding-section"><h3>What it covers</h3>{coverage.length?<ul className="via-funding-coverage-list">{coverage.map(value=><li key={value}><Check size={18} aria-hidden="true"/><span>{value}</span></li>)}</ul>:<p>Coverage has not been listed. Confirm what is covered with the provider.</p>}</section>
    <section className="via-funding-section"><h3>Who can apply?</h3>{eligibility.length?<ul className="via-funding-list">{eligibility.map(value=><li key={value}>{value}</li>)}</ul>:<p>Eligibility requirements have not been listed. Check the provider’s current requirements.</p>}</section>
    <section className="via-funding-section" aria-busy={status==='loading'}><h3>What can I study?</h3>
      {!!fields.length&&<ul className="via-funding-study-list">{fields.map(field=><li key={field}>{field}</li>)}</ul>}
      {!!programmes.length&&<ul className="via-funding-programme-list">{programmes.map(programme=><li key={programme.id}>{programme.title}<span>{programme.programme_group?.qualification || programme.qualification}</span></li>)}</ul>}
      {status==='loading'?<p className="via-funding-status" role="status">Loading applicable programmes…</p>:status==='error'?<div className="via-funding-status" role="alert"><p>Programme details could not be loaded.</p><button type="button" className="via-public-text-button" onClick={()=>{setStatus('loading');setRetry(value=>value+1)}}>Try again</button></div>:!fields.length&&!programmes.length?<p>Applicable fields and programmes have not been listed. Check with the provider.</p>:null}
    </section>
    {!!institutions.length&&<section className="via-funding-section via-funding-institutions"><h3>Where can I study?</h3><ul className="via-funding-list">{institutions.map(institution=><li key={institution.id}>{institution.name}</li>)}</ul></section>}
    <section className="via-funding-section"><h3>What do I need?</h3>{documents.length?<ul className="via-funding-list">{documents.map(value=><li key={value}>{value}</li>)}</ul>:<p>Required documents have not been listed. Check the provider’s current document checklist.</p>}</section>
    <div className="via-funding-apply">{application?<a className="via-public-button is-primary" href={application} target="_blank" rel="noopener noreferrer">Apply on Official Website<ExternalLink size={18} aria-hidden="true"/><span className="via-public-sr-only"> (opens in a new tab)</span></a>:<p>An official application link is not available for this funding opportunity.</p>}</div>
  </div>
}
