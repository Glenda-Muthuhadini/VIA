import { SaveButton } from './SaveButton'
import { ArrowRight } from 'lucide-react'
import type { Opportunity } from '../services/model'
import { fundingClosingDate, fundingList } from '../services/funding-model'
import './funding.css'

export function FundingCard({item,onOpen,onSave,saved,busy}: {item:Opportunity;onOpen:()=>void;onSave:()=>void;saved:boolean;busy:boolean}) {
  const coverage=fundingList(item.coverage)
  const closing=fundingClosingDate(item)
  return <article className="via-opportunity-card via-funding-card is-bursaries">
    <div className="via-funding-card-top">
      {item.is_demo&&<span className="via-funding-demo">Demo funding</span>}
      <SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/>
    </div>
    <h2><button className="via-funding-card-open" type="button" onClick={onOpen} aria-haspopup="dialog">{item.title}</button></h2>
    <p className="via-funding-provider">{item.provider || 'Provider not listed'}</p>
    <p className="via-funding-type">{item.funding_type || 'Funding type not listed'}</p>
    <p className="via-funding-coverage">{coverage.length?coverage.join(' · '):'Coverage not listed'}</p>
    <p className="via-funding-closing">{closing?`Closes: ${closing}`:'Closing date not listed'}</p>
    <span className="via-funding-card-cta">View Funding<ArrowRight size={19} aria-hidden="true"/></span>
  </article>
}
