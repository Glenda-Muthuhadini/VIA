import { money, safeExternalUrl, type Opportunity } from './model.ts'

export function accommodationLocation(item: Pick<Opportunity,'location'|'province'>) {
  const location=item.location?.trim() || ''
  const province=item.province?.trim() || ''
  return [location,province&&!location.toLowerCase().includes(province.toLowerCase())?province:''].filter(Boolean).join(', ')
}

export function accommodationType(item: Pick<Opportunity,'accommodation_type'>) {
  const value=item.accommodation_type?.trim()
  if(!value)return null
  if(/\bon[ -]campus\b/i.test(value))return 'On-campus residence'
  if(/\binstitution[ -]accredited\b/i.test(value))return 'Institution-accredited accommodation'
  if(/\bprivate\b/i.test(value))return 'Private student accommodation'
  // Institution ownership and NSFAS compatibility do not prove accreditation
  // or that a residence is physically on campus. Keep ambiguous stored labels.
  return value
}

export function accommodationPrice(item: Pick<Opportunity,'starting_price'|'price_period'>) {
  if(item.starting_price==null||!Number.isFinite(item.starting_price)||item.starting_price<0)return null
  return `From ${money(item.starting_price)}${item.price_period?.trim()?` / ${item.price_period.trim()}`:''}`
}

export function accommodationDistance(value: number | null | undefined) {
  return value!=null&&Number.isFinite(value)&&value>=0?`${value} km away`:null
}

export function accommodationContacts(item: Pick<Opportunity,'contact'|'phone'|'email'|'application_url'|'website_url'>) {
  const phones=new Set<string>(),emails=new Set<string>()
  const raw=item.contact?.trim() || ''
  const emailPattern=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  for(const value of [item.email,raw])for(const email of value?.match(emailPattern)||[])emails.add(email)
  if(item.phone?.trim()&&/^\+?[\d ()-]{7,25}$/.test(item.phone.trim())&&item.phone.replace(/\D/g,'').length>=7&&item.phone.replace(/\D/g,'').length<=15)phones.add(item.phone.trim())
  for(const phone of raw.match(/(?:\+27[ ()-]*|(?<!\d)0)[\d ()-]{8,}\d/g)||[]){
    const digits=phone.replace(/\D/g,'')
    if((phone.startsWith('+27')&&digits.length===11)||(!phone.startsWith('+')&&digits.length===10))phones.add(phone.trim())
  }
  const application=safeExternalUrl(item.application_url)
  const website=application || safeExternalUrl(item.website_url)
  return {phones:[...phones],emails:[...emails],other:!phones.size&&!emails.size?raw:'',website,application:!!application}
}
