import { SaveButton } from './SaveButton'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, ExternalLink, GraduationCap } from 'lucide-react'
import { Link } from 'react-router'
import type { Opportunity } from '../services/model'
import { getOpportunity } from '../services/discovery'
import { programmeApplicationUrl, offeringDestination } from '../services/programme-model'
import './programmes.css'

export function ProgrammeDetails({ item, onSave, saved, busy }: { item: Opportunity; onSave:()=>void; saved:boolean; busy:boolean }) {
  const [loaded, setLoaded] = useState<Opportunity | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedOfferings, setSelectedOfferings] = useState<Record<string,string>>({})
  const group = item.programme_group || loaded?.programme_group
  useEffect(() => {
    if (item.programme_group) return
    const controller = new AbortController()
    void getOpportunity('programmes',item.id,controller.signal).then(value=>{
      if (!controller.signal.aborted) { if (value) setLoaded(value); else setError(true) }
    }).catch(()=>{if(!controller.signal.aborted)setError(true)})
    return ()=>controller.abort()
  },[item.id,item.programme_group,retry])
  if (!group) return <div className="via-public-empty" role={error?'alert':'status'}>{error ? <><p>Programme offerings could not be loaded.</p><button type="button" className="via-public-button" onClick={()=>{setError(false);setRetry(value=>value+1)}}>Try again</button></> : 'Loading institutions and programme offerings…'}</div>
  const institutions = new Map<string,Opportunity[]>()
  for (const offering of group.offerings) {
    const key = offering.institution_id || offering.id
    institutions.set(key,[...(institutions.get(key)||[]),offering])
  }
  return <div className="via-public-detail-content via-programme-details">
    <header className="via-programme-header via-save-heading"><SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/>
      <span className="via-public-card-icon"><GraduationCap size={30} aria-hidden="true"/></span>
      <div><p className="via-programme-eyebrow">Explore a programme</p><h2>{group.name}</h2><p>{group.qualification} · {group.duration}</p></div>
    </header>
    {(item.is_demo || loaded?.is_demo) && <p className="via-programme-demo-notice">Demo catalogue: these example offerings and requirements are for exploring VIA. They are not verified institutional admissions information.</p>}
    <p className="via-programme-overview">Explore {group.name} and compare the study options and entry requirements listed by each institution.</p>
    <section className="via-programme-careers"><h3>Possible careers and fields</h3><p>{group.careers.length ? group.careers.join(' · ') : 'Career information is not listed yet. Explore the official programme information for career pathways.'}</p></section>
    <p className="via-programme-availability">{group.institution_count} {group.institution_count === 1 ? 'institution offers' : 'institutions offer'} this programme in VIA’s catalogue.</p>
    <section className="via-programme-offerings" aria-label="Institutions offering this programme">
      <h3>Where can I study this?</h3>
      <div className="via-programme-offering-list">
        {[...institutions].map(([institutionKey,offerings])=>{
          const offering = offerings.find(row=>row.id===selectedOfferings[institutionKey]) || offerings[0]
          const open = expanded === institutionKey
          const applicationUrl = programmeApplicationUrl(offering)
          const panelId = `offering-${institutionKey}`
          return <article className={`via-programme-offering ${open ? 'is-expanded' : ''}`} key={institutionKey}>
            <h4><button type="button" className="via-programme-offering-toggle" aria-expanded={open} aria-controls={panelId} onClick={()=>setExpanded(open?null:institutionKey)}>
              <span><strong>{offering.institution_name || 'Institution name not listed'}</strong><span className="via-programme-offering-location">{[offering.location || 'City not listed',offering.province || 'Province not listed',offering.campus || 'Campus not listed'].join(' · ')}</span><span className="via-programme-official-name">{offering.title}</span>{offerings.length>1&&<span className="via-programme-offering-location">{offerings.length} offerings — expand to compare</span>}<span className="via-programme-expand-label">{open?'Collapse':'Expand'}</span></span>
              <ChevronDown size={22} aria-hidden="true"/>
            </button></h4>
            <div id={panelId} hidden={!open} className="via-programme-offering-body">
              {offerings.length>1&&<label className="via-programme-offering-select">Choose an offering<select value={offering.id} onChange={event=>setSelectedOfferings(previous=>({...previous,[institutionKey]:event.target.value}))}>{offerings.map((option,index)=><option value={option.id} key={option.id}>{option.title} · {option.campus || 'Campus not listed'} · Offering {index+1}</option>)}</select></label>}
              <dl className="via-programme-offering-facts">
                <div><dt>Institution</dt><dd>{offering.institution_name || 'Not listed'}</dd></div>
                <div><dt>Official programme name</dt><dd>{offering.title}</dd></div>
                <div><dt>City</dt><dd>{offering.location || 'Not listed'}</dd></div>
                <div><dt>Province</dt><dd>{offering.province || 'Not listed'}</dd></div>
                <div><dt>Campus</dt><dd>{offering.campus || 'Not listed'}</dd></div>
                <div><dt>Duration</dt><dd>{offering.duration || 'Not listed'}</dd></div>
                {offering.academic_year && <div><dt>Information year</dt><dd>{offering.academic_year}</dd></div>}
                <div><dt>APS requirement</dt><dd>{offering.minimum_aps ?? 'Not listed — check with the institution'}</dd></div>
              </dl>
              <h5>Subject requirements</h5>
              {offering.requirements.length ? <ul className="via-programme-subjects">{offering.requirements.map(requirement=><li key={requirement.id}>
                <div><strong>{requirement.subject || 'Additional requirement'}{requirement.recommended?' (recommended)':''}</strong>{requirement.detail && <p>{requirement.detail}</p>}</div><span>{requirement.minimum_percentage == null ? 'Minimum not listed' : `${requirement.minimum_percentage}%+`}</span>
              </li>)}</ul> : <p className="via-programme-missing">Subject requirements have not been listed. Check with the institution for current requirements.</p>}
              <p className="via-programme-admission-note">Meeting minimum requirements does not guarantee admission. Confirm requirements for your intended intake with the institution.</p>
              <div className="via-programme-offering-actions">
                <Link className="via-public-button" to={offeringDestination('bursaries',offering)}>Explore Funding<ArrowRight size={17} aria-hidden="true"/></Link>
                {offering.institution_id ? <Link className="via-public-button" to={offeringDestination('accommodation',offering)}>Explore Accommodation<ArrowRight size={17} aria-hidden="true"/></Link> : <span className="via-programme-missing">Accommodation needs a linked institution.</span>}
                {applicationUrl ? <a className="via-public-button is-primary" href={applicationUrl} target="_blank" rel="noopener noreferrer">Apply Online<ExternalLink size={17} aria-hidden="true"/><span className="via-public-sr-only"> (opens in a new tab)</span></a> : <p className="via-programme-missing">An online application link is not available for this offering.</p>}
              </div>
            </div>
          </article>
        })}
      </div>
    </section>
  </div>
}
