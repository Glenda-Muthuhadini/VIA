import { useRef, useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { SaveButton } from './SaveButton'
import { Link } from 'react-router'
import { applicationStatus,dateLabel,money,safeExternalUrl,type Opportunity,type OpportunityKind } from '../services/model'
import { InstitutionDetails } from './InstitutionDetails'
import { opportunityIcons } from './icons'
import type { ConversionIntent } from './AuthConversionPrompt'
import { RelatedOpportunities } from './RelatedOpportunities'
import { ProgrammeDetails } from './ProgrammeDetails'
import { FundingDetails } from './FundingDetails'
import { AccommodationDetails } from './AccommodationDetails'

export function ExternalLinkButton({url,children}: {url:string|null|undefined;children:React.ReactNode}) {
 const href=safeExternalUrl(url)
 return href?<a className="via-public-button" href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={16} aria-hidden="true"/><span className="via-public-sr-only">(opens an external website in a new tab)</span></a>:null
}
function Fact({label,value}: {label:string;value:string|number|null|undefined}) { return value!==null&&value!==undefined&&value!==''?<div><dt>{label}</dt><dd>{value}</dd></div>:null }
function Source({item}: {item:{source_url:string|null;source_name:string;last_verified_at:string|null;is_demo?:boolean}}) {
 if(item.is_demo)return null
 return <p className="via-public-source">Source: {safeExternalUrl(item.source_url)?<a href={safeExternalUrl(item.source_url)!} target="_blank" rel="noopener noreferrer">{item.source_name}<ExternalLink size={12}/><span className="via-public-sr-only"> (external website, opens a new tab)</span></a>:item.source_name} · Checked {dateLabel(item.last_verified_at)}</p>
}
export function OpportunityDetails({item,onOpen,onSave,onConvert,saved,busy}: {item:Opportunity;onOpen:(kind:OpportunityKind,id:string)=>void;onSave:(item:Opportunity)=>void;onConvert:(intent:ConversionIntent)=>void;saved:string[];busy:boolean}) {
 if(item.kind==='institutions')return <InstitutionDetails item={item} onOpen={onOpen} onSave={onSave} saved={saved} busy={busy}/>
 if(item.kind==='programmes')return <ProgrammeDetails item={item} onSave={()=>onSave(item)} saved={saved.includes(item.id)} busy={busy}/>
 if(item.kind==='bursaries')return <FundingDetails item={item} onSave={()=>onSave(item)} saved={saved.includes(item.id)} busy={busy}/>
 if(item.kind==='accommodation')return <AccommodationDetails item={item} onSave={()=>onSave(item)} saved={saved.includes(item.id)} busy={busy}/>
 return <StandardOpportunityDetails item={item} onOpen={onOpen} onSave={onSave} onConvert={onConvert} saved={saved} busy={busy}/>
}
function StandardOpportunityDetails({item,onOpen,onSave,onConvert,saved,busy}: {item:Opportunity;onOpen:(kind:OpportunityKind,id:string)=>void;onSave:(item:Opportunity)=>void;onConvert:(intent:ConversionIntent)=>void;saved:string[];busy:boolean}) {
 const [tab,setTab]=useState('Overview')
 const tabs=['Overview','Requirements','Application Info']
 const tabRef=useRef<HTMLDivElement>(null)
 const Icon=opportunityIcons[item.kind]
 const image=safeExternalUrl(item.image_url)
 const facts=<dl className="via-public-detail-facts"><Fact label="Location" value={[item.location,item.province].filter(Boolean).join(' · ')}/><Fact label="Institution type" value={item.institution_type}/><Fact label="Institution" value={item.institution_name}/><Fact label="Faculty / field" value={[item.faculty,item.field].filter(Boolean).join(' · ')}/><Fact label="Qualification" value={item.qualification}/><Fact label="Duration" value={item.duration}/><Fact label="Study mode" value={item.study_mode}/><Fact label="Campus" value={item.campus}/><Fact label="Minimum APS" value={item.minimum_aps}/><Fact label="Provider" value={item.provider}/><Fact label="Funding type" value={item.funding_type}/><Fact label="Study level" value={item.study_levels?.join(', ')}/><Fact label="Accommodation type" value={item.accommodation_type}/><Fact label="Published starting price" value={item.starting_price===null?null:`${money(item.starting_price)}${item.price_period?` / ${item.price_period}`:''}`}/><Fact label={item.kind==='accommodation'?'Published price year':item.kind==='bursaries'?'Funding year':'Entry information year'} value={item.academic_year}/><Fact label="Contact" value={item.contact}/></dl>
 return <div className="via-public-detail-content"><div className="via-public-detail-heading via-save-heading"><span className="via-public-card-icon"><Icon size={28}/></span><div><p className="via-public-overline">Explore your options</p><h2>{item.title}</h2></div><SaveButton title={item.title} saved={saved.includes(item.id)} busy={busy} onSave={()=>onSave(item)}/></div>
  <div className="via-public-tabs" role="tablist" aria-label="Opportunity information" ref={tabRef}>{tabs.map((name,index)=><button key={name} type="button" role="tab" id={`via-detail-tab-${index}`} aria-controls="via-detail-panel" tabIndex={tab===name?0:-1} aria-selected={tab===name} onClick={()=>setTab(name)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();setTab(tabs[next]);tabRef.current?.querySelectorAll('button')[next]?.focus()}}>{name}</button>)}</div>
  <section id="via-detail-panel" role="tabpanel" aria-labelledby={`via-detail-tab-${tabs.indexOf(tab)}`} tabIndex={0}>
   {tab==='Overview'&&<>{image&&<img className="via-public-property-photo" src={image} alt={item.title}/>}<p className="via-public-detail-overview">{item.overview}</p>{facts}{item.institutions.length>0&&item.kind==='accommodation'&&<section><h3>Nearby institutions</h3><ul>{item.institutions.map(institution=><li key={institution.id}><button className="via-public-text-button" type="button" onClick={()=>onOpen('institutions',institution.id)}>{institution.name}{institution.campus?` · ${institution.campus}`:''}</button>{institution.distance_km!==null&&institution.distance_km!==undefined?` · ${institution.distance_km} km`:''}</li>)}</ul></section>}
    {item.coverage?.length? <section><h3>What it covers</h3><div className="via-public-tags">{item.coverage.map(value=><span key={value}>{value}</span>)}</div></section>:item.kind==='bursaries'?<p>Confirm funding coverage with the provider.</p>:null}
    {item.fields?.length? <section><h3>Supported fields</h3><p>{item.fields.join(', ')}</p></section>:null}
    {item.amenities?.length?<section><h3>Amenities</h3><div className="via-public-tags">{item.amenities.map(value=><span key={value}>{value}</span>)}</div></section>:null}
    {item.room_types?.length?<section><h3>Room types</h3><p>{item.room_types.join(' · ')}</p></section>:null}
    {item.kind==='accommodation'&&<p>{item.nsfas_compatible===null?'NSFAS compatibility has not been independently verified. Check approval for your specific institution, room and contract.':item.nsfas_compatible?'NSFAS compatibility verified; confirm your individual approval.':'Not verified as NSFAS compatible.'} Current room availability is not confirmed.</p>}
   </>}
   {tab==='Requirements'&&<><h3>{item.kind==='bursaries'?'Eligibility & documents':'Entry requirements'}</h3>{item.requirements.length?<ul className="via-public-requirements">{item.requirements.map(requirement=><li key={requirement.id}><strong>{requirement.recommended?'Recommended: ':''}{requirement.subject??'Requirement'}{requirement.minimum_percentage!==null?` · ${requirement.minimum_percentage}%+`:''}</strong><p>{requirement.detail}</p><Source item={requirement}/></li>)}</ul>:item.kind!=='bursaries'?<p>Complete requirements are not verified in VIA yet. Check the official source for the intended intake year.</p>:null}
    {item.eligibility.length>0&&<ul className="via-public-requirements">{item.eligibility.map(row=><li key={row.id}><p>{row.criterion}</p><Source item={row}/></li>)}</ul>}{item.required_documents?.length?<><h3>Required documents</h3><ul>{item.required_documents.map(value=><li key={value}>{value}</li>)}</ul></>:item.kind==='bursaries'?<p>Check the provider’s current document checklist.</p>:null}
    {item.kind==='programmes'&&<p>Meeting the listed requirements does not guarantee admission.</p>}
   </>}
   {tab==='Application Info'&&<>{item.cycles.length?item.cycles.map(cycle=><section className="via-public-cycle" key={cycle.id}><h3>{cycle.academic_year} · {cycle.label}</h3><p>{applicationStatus([cycle])}</p><dl className="via-public-detail-facts"><Fact label="Opens" value={cycle.opens_on?dateLabel(cycle.opens_on):null}/><Fact label="Closes" value={cycle.closes_on?dateLabel(cycle.closes_on):null}/><Fact label="Application fee" value={cycle.fee===null?'Check official source':money(cycle.fee)}/></dl>{cycle.fee_note&&<p>{cycle.fee_note}</p>}<Source item={cycle}/></section>):<p>Application dates and fees are not verified here. Please check the official source before applying.</p>}</>}
  </section>
  <RelatedOpportunities item={item} onOpen={onOpen} onProgrammes={()=>setTab('Programmes')}/>
  <Source item={item}/><div className="via-public-external-actions">{item.kind==='programmes'?(safeExternalUrl(item.application_url)?<ExternalLinkButton url={item.application_url}>Apply</ExternalLinkButton>:<button className="via-public-button" type="button" disabled title="No verified application link is available">Apply</button>):<><ExternalLinkButton url={item.application_url}>{item.kind==='accommodation'?'Enquire on official website':'Apply on official website'}</ExternalLinkButton><ExternalLinkButton url={item.website_url}>Visit official website</ExternalLinkButton></>}</div>
  {item.kind!=='accommodation'&&<section className="via-public-match-conversion"><p className="via-public-overline">Your options. Your own VIA.</p><h3>{item.kind==='bursaries'?'Keep this funding opportunity in your VIA':item.kind==='programmes'?'Check your results against this programme':'See how your results compare with programmes at this institution.'}</h3><p>{item.kind==='programmes'?'Compare your confirmed subjects and marks with the listed minimum requirements.':item.kind==='bursaries'?'Save this opportunity for later and check the provider’s current eligibility and application information.':'Keep exploring freely. Your VIA profile is where personal planning begins.'}</p><button className="via-public-button is-primary" type="button" onClick={()=>item.kind==='bursaries'?onSave(item):onConvert(item.kind==='programmes'?'match':'profile')}>{item.kind==='bursaries'?(saved.includes(item.id)?'Remove from saved funding':'Save this funding opportunity'):item.kind==='programmes'?'Check what I qualify for':'Create my VIA'}<ArrowRight size={17}/></button></section>}
  {item.kind==='accommodation'&&<Link className="via-public-text-button" to="/institutions">Explore nearby institutions<ArrowRight size={16}/></Link>}
 </div>
}
