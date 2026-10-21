import { Heart } from 'lucide-react'
import './save-button.css'

export function SaveButton({title,saved,busy,onSave,className=''}: {title:string;saved:boolean;busy:boolean;onSave:()=>void;className?:string}) {
  return <button type="button" className={`via-public-icon-button via-save-button via-shared-save ${className}`} aria-label={`${saved?'Unsave':'Save'} ${title}`} aria-pressed={saved} disabled={busy} onClick={event=>{event.stopPropagation();onSave()}}><Heart size={22} fill={saved?'currentColor':'none'} aria-hidden="true"/></button>
}
