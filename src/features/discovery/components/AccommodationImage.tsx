import { useState } from 'react'
import { House } from 'lucide-react'
import { safeExternalUrl } from '../services/model'

export function AccommodationImage({url,name,hideWhenUnavailable=false}: {url:string|null;name:string;hideWhenUnavailable?:boolean}) {
  const src=safeExternalUrl(url)
  const [failed,setFailed]=useState<string|null>(null)
  if(!src||failed===src)return hideWhenUnavailable?null:<div className="via-accommodation-image-placeholder"><House size={38} strokeWidth={1.3} aria-hidden="true"/><span>Image not available</span></div>
  return <img className="via-accommodation-image" src={src} alt={name} loading="lazy" onError={()=>setFailed(src)}/>
}
