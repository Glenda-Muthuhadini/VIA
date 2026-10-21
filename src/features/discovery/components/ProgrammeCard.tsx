import { SaveButton } from './SaveButton'
import { ArrowRight, GraduationCap } from 'lucide-react'
import type { Opportunity } from '../services/model'
import './programmes.css'

export function ProgrammeCard({ item, onOpen, onSave, saved, busy }: { item: Opportunity; onOpen: () => void; onSave:()=>void; saved:boolean; busy:boolean }) {
  const group = item.programme_group
  return <article className="via-opportunity-card via-programme-card is-programmes">
    <SaveButton title={item.title} saved={saved} busy={busy} onSave={onSave}/><span className="via-public-card-icon"><GraduationCap size={28} strokeWidth={1.5} aria-hidden="true"/></span>
    {item.is_demo && <span className="via-programme-demo">Demo programme</span>}
    <h2><button className="via-programme-card-open" type="button" aria-haspopup="dialog" onClick={onOpen}>{group?.name || item.title}</button></h2>
    <p className="via-programme-qualification">{group?.qualification || item.qualification || 'Qualification not listed'} · {group?.duration || item.duration || 'Duration not listed'}</p>
    <p className="via-programme-fields">{group?.fields.length ? group.fields.join(' · ') : item.field || 'Study fields not listed'}</p>
    <p className="via-programme-institution-count">{group?.institution_count ? `Available at ${group.institution_count} ${group.institution_count === 1 ? 'institution' : 'institutions'}` : 'Institution information not listed'}</p>
    <span className="via-programme-card-cta">View Programme<ArrowRight size={19} aria-hidden="true"/></span>
  </article>
}
