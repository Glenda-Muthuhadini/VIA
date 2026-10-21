import { SaveButton } from './SaveButton'
import { Landmark } from 'lucide-react'
import { money, safeExternalUrl, type Opportunity } from '../services/model'
import { institutionCardData, institutionName } from '../services/institutions'
import './institutions.css'

export function InstitutionCard({ item, onOpen, onSave, saved, busy }: { item: Opportunity; onOpen: () => void; onSave: () => void; saved: boolean; busy: boolean }) {
 const logo = safeExternalUrl(item.logo_url)
 const facts = institutionCardData(item)
 if (!facts) return null
 const deadline = new Date(facts.deadline + 'T12:00:00Z').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })
 return <article className="via-opportunity-card is-institutions via-institution-card">
  <div className="via-opportunity-card-top"><span className="via-public-card-icon">{logo ? <img src={logo} alt="" loading="lazy" /> : <Landmark size={26} strokeWidth={1.5} />}</span><SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/></div>
  <h2><button className="via-institution-card-open" type="button" onClick={onOpen} aria-label={`View details for ${item.title}`}>{institutionName(item)}</button></h2>
  <p className="via-institution-meta">{[item.institution_type, item.province ?? item.location].filter(Boolean).join(' · ')}</p>
  <dl className="via-institution-card-facts"><div><dt>Application Fee</dt><dd>{money(facts.fee)}</dd></div><div><dt>Application Deadline</dt><dd>{deadline}</dd></div><div><dt>APS Range</dt><dd>{facts.aps}</dd></div></dl>
  <span className="via-institution-card-actions via-public-card-action">View Details →</span>
 </article>
}
