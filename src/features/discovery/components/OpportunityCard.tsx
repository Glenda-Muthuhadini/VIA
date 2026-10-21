import { ArrowRight, MapPin } from 'lucide-react'
import { SaveButton } from './SaveButton'
import { applicationStatus,dateLabel,discoveryConfig,money,safeExternalUrl,type Opportunity } from '../services/model'
import { opportunityIcons } from './icons'
import { InstitutionCard } from './InstitutionCard'
import { ProgrammeCard } from './ProgrammeCard'
import { FundingCard } from './FundingCard'
import { AccommodationCard } from './AccommodationCard'
export function OpportunityCard({item,onOpen,onSave,saved,busy=false}: {item:Opportunity;onOpen:()=>void;onSave:()=>void;saved:boolean;busy?:boolean}) {
 if(item.kind==='institutions')return <InstitutionCard item={item} onOpen={onOpen} onSave={onSave} saved={saved} busy={busy}/>
 if(item.kind==='programmes')return <ProgrammeCard item={item} onOpen={onOpen} onSave={onSave} saved={saved} busy={busy}/>
 if(item.kind==='bursaries')return <FundingCard item={item} onOpen={onOpen} onSave={onSave} saved={saved} busy={busy}/>
 if(item.kind==='accommodation')return <AccommodationCard item={item} onOpen={onOpen} onSave={onSave} saved={saved} busy={busy}/>
 return <DiscoveryOpportunityCard item={item} onOpen={onOpen} onSave={onSave} saved={saved} busy={busy}/>
}
function DiscoveryOpportunityCard({item,onOpen,onSave,saved,busy}: {item:Opportunity;onOpen:()=>void;onSave:()=>void;saved:boolean;busy:boolean}) {
 const Icon=opportunityIcons[item.kind]
 const image=safeExternalUrl(item.kind==='institutions'?item.logo_url:item.image_url)
 const cycle=item.cycles[0]
 const tags=item.kind==='programmes'?[item.qualification,item.duration]:item.kind==='bursaries'?[item.funding_type,...(item.fields??[])]:item.kind==='accommodation'?(item.amenities??[]).slice(0,3):[item.institution_type]
 return <article className={`via-opportunity-card is-${item.kind}`}>
  <div className="via-opportunity-card-top"><span className="via-public-card-icon">{image?<img src={image} alt={`${item.title}${item.kind==='institutions'?' logo':''}`} loading="lazy"/>:<Icon size={26} strokeWidth={1.5}/>}</span><SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/></div>
  <p className="via-public-overline">{item.kind==='programmes'?item.institution_name:item.kind==='bursaries'?item.provider:item.kind==='institutions'?item.abbreviation:'Student living'}</p>
  <h2><button type="button" onClick={onOpen}>{item.title}</button></h2>
  {item.location&&<p className="via-public-location"><MapPin size={15}/>{item.location}{item.province&&item.province!==item.location?` · ${item.province}`:''}</p>}
  <div className="via-public-tags">{tags.filter(Boolean).map(tag=><span key={tag}>{tag}</span>)}</div>
  <dl className="via-public-card-facts">
   {item.kind==='institutions'&&item.programme_count!==null&&<div><dt>Programmes listed in VIA</dt><dd>{item.programme_count}</dd></div>}
   {item.kind==='programmes'&&<div><dt>Minimum APS</dt><dd>{item.minimum_aps??'Check institution'}</dd></div>}
   {item.kind==='programmes'&&item.requirements.length>0&&<div><dt>Subject requirements</dt><dd>{item.requirements.slice(0,2).map(row=>`${row.subject??'Requirement'}${row.minimum_percentage!==null?` ${row.minimum_percentage}%+`:''}`).join(' · ')}</dd></div>}
   {item.kind==='accommodation'&&<><div><dt>Published starting price{item.academic_year?` · ${item.academic_year}`:''}</dt><dd>{item.starting_price===null?'Enquire with provider':`${money(item.starting_price)}${item.price_period?` / ${item.price_period}`:''}`}</dd></div>{item.institutions.length>0&&<div><dt>Nearby institution</dt><dd>{item.institutions.map(value=>value.name).join(', ')}</dd></div>}</>}
   {item.kind!=='accommodation'&&<><div><dt>Applications</dt><dd>{applicationStatus(item.cycles)}</dd></div>{cycle?.closes_on&&<div><dt>Closing date{cycle.academic_year?` · ${cycle.academic_year} entry`:''}</dt><dd>{dateLabel(cycle.closes_on)}</dd></div>}{cycle?.fee!==undefined&&cycle.fee!==null&&<div><dt>Application fee</dt><dd>{money(cycle.fee)}</dd></div>}</>}
  </dl>
  <div className="via-opportunity-card-bottom">{!item.is_demo&&<small>{item.academic_year?`${item.academic_year} source · `:''}Official source linked</small>}<button type="button" className="via-public-card-action" onClick={onOpen}>{discoveryConfig[item.kind].action}<ArrowRight size={18}/></button></div>
 </article>
}
