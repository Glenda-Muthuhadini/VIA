import { SaveButton } from './SaveButton'
import { Check, ExternalLink } from 'lucide-react'
import type { Opportunity } from '../services/model'
import { accommodationContacts, accommodationDistance, accommodationLocation, accommodationPrice, accommodationType } from '../services/accommodation-model'
import { AccommodationImage } from './AccommodationImage'
import './accommodation.css'

export function AccommodationDetails({item,onSave,saved,busy}: {item:Opportunity;onSave:()=>void;saved:boolean;busy:boolean}) {
  const location=accommodationLocation(item),type=accommodationType(item),price=accommodationPrice(item),contacts=accommodationContacts(item)
  const amenities=[...new Set((item.amenities||[]).map(value=>value.trim()).filter(Boolean))]
  const institutions=item.institutions.filter(institution=>institution.name?.trim())
  const hasContact=contacts.website||contacts.phones.length||contacts.emails.length||contacts.other
  return <div className="via-accommodation-details">
    <AccommodationImage url={item.image_url} name={item.title} hideWhenUnavailable/>
    <div className="via-public-detail-content via-accommodation-detail-copy">
      <header className="via-accommodation-header via-save-heading"><div><h2>{item.title}</h2>{location&&<p className="via-accommodation-location">{location}</p>}{type&&<p className="via-accommodation-type">{type}</p>}</div><SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/></header>
      {item.is_demo&&<p className="via-accommodation-demo-notice">Demo accommodation example. This is not a real residence or booking offer.</p>}
      {(location||item.address?.trim())&&<section className="via-accommodation-section"><h3>Location</h3>{location&&<p>{location}</p>}{item.address?.trim()&&<p>{item.address}</p>}</section>}
      {type&&<section className="via-accommodation-section"><h3>Accommodation type</h3><p>{type}</p></section>}
      {!!amenities.length&&<section className="via-accommodation-section"><h3>What’s included?</h3><ul className="via-accommodation-features">{amenities.map(value=><li key={value}><Check size={18} aria-hidden="true"/><span>{value}</span></li>)}</ul></section>}
      {!!institutions.length&&<section className="via-accommodation-section"><h3>Nearby institutions</h3><ul className="via-accommodation-institutions">{institutions.map((institution,index)=><li key={`${institution.id}-${index}`}><strong>{institution.name}</strong>{institution.campus&&<span>{institution.campus}</span>}{accommodationDistance(institution.distance_km)&&<span>{accommodationDistance(institution.distance_km)}</span>}</li>)}</ul></section>}
      {price&&<section className="via-accommodation-section"><h3>Price</h3><p className="via-accommodation-price">{price}</p></section>}
      {!!hasContact&&<section className="via-accommodation-section via-accommodation-contact"><h3>Contact / Apply</h3>
        {contacts.website&&<a className="via-public-button is-primary" href={contacts.website} target="_blank" rel="noopener noreferrer">{contacts.application?'Apply / View Official Website':'View Official Website'}<ExternalLink size={18} aria-hidden="true"/><span className="via-public-sr-only"> (opens in a new tab)</span></a>}
        {contacts.phones.map(phone=><p key={phone}>Phone: <a href={`tel:${phone.replace(/[^\d+]/g,'')}`}>{phone}</a></p>)}
        {contacts.emails.map(email=><p key={email}>Email: <a href={`mailto:${email}`}>{email}</a></p>)}
        {contacts.other&&<p>{contacts.other}</p>}
      </section>}
    </div>
  </div>
}
