import { SaveButton } from './SaveButton'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, Landmark } from 'lucide-react'
import { safeExternalUrl, type Opportunity, type OpportunityKind } from '../services/model'
import { apsLabel, institutionFaculties, institutionName, type InstitutionFaculty } from '../services/institutions'
import './institutions.css'

export function InstitutionDetails({ item, onOpen, onSave, saved, busy }: { item: Opportunity; onOpen: (kind: OpportunityKind, id: string) => void; onSave: (item: Opportunity) => void; saved: string[]; busy: boolean }) {
 const [faculties, setFaculties] = useState<InstitutionFaculty[]>([])
 const [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0)
 useEffect(() => {
  const controller = new AbortController()
  const timer = setTimeout(() => {
   void institutionFaculties(item.id, '', controller.signal).then(value => { if (!controller.signal.aborted) setFaculties(value) }).catch(() => { if (!controller.signal.aborted) setError(true) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
  }, 200)
  return () => { clearTimeout(timer); controller.abort() }
 }, [item.id, retry])
 const logo = safeExternalUrl(item.logo_url), apply = safeExternalUrl(item.application_url), isSaved = saved.includes(item.id)
 return <div className="via-public-detail-content via-institution-details">
  <div className="via-public-detail-heading via-save-heading"><span className="via-public-card-icon">{logo ? <img src={logo} alt="" /> : <Landmark size={28} />}</span><div><h2>{institutionName(item)}</h2><p className="via-institution-meta">{[item.institution_type, item.province ?? item.location].filter(Boolean).join(' · ')}</p></div><SaveButton title={item.title} saved={isSaved} busy={busy} onSave={()=>onSave(item)}/></div>
  <h3 className="via-institution-section-title">Faculties &amp; Programmes</h3>
  <div className="via-institution-faculties" aria-busy={loading}>
   {loading ? <p role="status">Loading programmes…</p> : error ? <div role="alert"><p>Programmes could not be loaded.</p><button className="via-public-button" type="button" onClick={() => { setError(false); setLoading(true); setRetry(value => value + 1) }}>Try again</button></div> : !faculties.length ? <p>Programme information is not available yet.</p> : faculties.map(faculty => <details className="via-institution-faculty" key={faculty.id}>
    <summary><span><strong>{faculty.name}</strong><small>{faculty.programme_count} {faculty.programme_count === 1 ? 'programme' : 'programmes'} · {faculty.aps_min == null ? 'APS varies by programme' : `APS ${apsLabel(faculty)}`}</small></span><ChevronDown size={20} aria-hidden="true" /></summary>
    <ul>{faculty.programmes.map(programme => <li key={programme.id}><div><h4>{programme.title}</h4><span>{programme.aps_min == null ? 'APS varies' : `APS ${apsLabel(programme)}`}</span></div><button className="via-public-text-button" type="button" onClick={() => onOpen('programmes', programme.id)}>View Programme<ArrowRight size={16} aria-hidden="true" /></button></li>)}</ul>
   </details>)}
  </div>
  {apply && <footer className="via-institution-apply"><a className="via-public-button is-primary" href={apply} target="_blank" rel="noopener noreferrer">Apply<ArrowRight size={18} aria-hidden="true" /><span className="via-public-sr-only"> (external website, opens a new tab)</span></a></footer>}
 </div>
}
