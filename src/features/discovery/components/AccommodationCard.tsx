import { SaveButton } from './SaveButton'
import { ArrowRight } from 'lucide-react'
import type { Opportunity } from '../services/model'
import { accommodationLocation, accommodationPrice, accommodationType } from '../services/accommodation-model'
import { AccommodationImage } from './AccommodationImage'
import './accommodation.css'

export function AccommodationCard({item,onOpen,onSave,saved,busy}: {item:Opportunity;onOpen:()=>void;onSave:()=>void;saved:boolean;busy:boolean}) {
  const location=accommodationLocation(item),type=accommodationType(item),price=accommodationPrice(item)
  return <article className="via-opportunity-card via-accommodation-card is-accommodation">
    <div className="via-accommodation-card-media"><AccommodationImage url={item.image_url} name={item.title}/><SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/></div>
    <div className="via-accommodation-card-copy">
      {item.is_demo&&<span className="via-accommodation-demo">Demo accommodation</span>}
      <h2><button type="button" className="via-accommodation-card-open" aria-haspopup="dialog" onClick={onOpen}>{item.title}</button></h2>
      {location&&<p className="via-accommodation-location">{location}</p>}
      {type&&<p className="via-accommodation-type">{type}</p>}
      {price&&<p className="via-accommodation-price">{price}</p>}
      <span className="via-accommodation-card-cta">View Accommodation<ArrowRight size={19} aria-hidden="true"/></span>
    </div>
  </article>
}
