import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function PublicDialog({title,onClose,children,compact=false,className=''}: {title:string;onClose:()=>void;children:ReactNode;compact?:boolean;className?:string}) {
 const ref=useRef<HTMLDialogElement>(null)
 useEffect(()=>{
  const element=ref.current
  const previous=document.activeElement
  element?.showModal()
  return ()=>{element?.close();if(previous instanceof HTMLElement&&previous.isConnected) previous.focus()}
 },[])
 return <dialog className={`via-public-dialog ${compact?'is-compact':''} ${className}`} ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) onClose()}}}>
  <header className="via-public-dialog-header"><span>{title}</span><button className="via-public-icon-button" type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={22}/></button></header>
  {children}
 </dialog>
}
