import { useEffect, useRef } from 'react'
import { ArrowRight, BookOpen, Check } from 'lucide-react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router'
import { PublicDialog } from '../../discovery/components/PublicDialog'
import { studentGuides } from '../guides'
import { GuideLink } from './GuideLink'
import '../pages/StudentPages.css'
import './GuideOverlay.css'

export function GuideOverlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMatch('/guides/:slug')
  const selection = new URLSearchParams(location.search).get('guide') || route?.params.slug || (location.pathname === '/guides' ? 'all' : null)
  const guide = studentGuides.find(item => item.slug === selection)
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = contentRef.current?.closest('dialog')
    if (dialog) {
      dialog.scrollTop = 0
      dialog.querySelector<HTMLButtonElement>('.via-public-dialog-header button')?.focus({ preventScroll: true })
      const keepFocus = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return
        const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length)
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
      dialog.addEventListener('keydown', keepFocus)
      return () => dialog.removeEventListener('keydown', keepFocus)
    }
  }, [selection])
  useEffect(() => {
    if (!selection) return
    const previous = document.documentElement.style.overflow
    const previousGutter = document.documentElement.style.scrollbarGutter
    document.documentElement.style.scrollbarGutter = 'stable'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previous
      document.documentElement.style.scrollbarGutter = previousGutter
    }
  }, [selection])
  if (!selection) return null
  function close() {
    const search = new URLSearchParams(location.search)
    search.delete('guide')
    navigate({ pathname: location.pathname.startsWith('/guides') ? '/' : location.pathname, search: search.toString(), hash: location.hash }, { replace: true, preventScrollReset: true })
  }
  return <PublicDialog title={selection === 'all' ? 'Student guides' : guide?.title || 'Guide not found'} onClose={close} className="via-guide-dialog">
    <div className="via-student-page via-guide-dialog-content" ref={contentRef}>
      {selection === 'all' ? <>
        <header className="via-guide-intro"><h2>Need help getting started?</h2><p>Choose a guide for a clearer next step.</p></header>
        <div className="via-student-card-grid">{studentGuides.map(item => <GuideLink className="via-student-card via-student-guide-card" slug={item.slug} key={item.slug}><BookOpen size={26} aria-hidden="true"/><h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}<span>Read guide<ArrowRight size={18} aria-hidden="true"/></span></GuideLink>)}</div>
      </> : guide ? <>
        <GuideLink className="via-student-back">All guides</GuideLink>
        <header className="via-guide-intro"><p className="via-guide-eyebrow">A VIA student guide</p><h2>{guide.title}</h2>{guide.description&&<p>{guide.description}</p>}</header>
        <article className="via-student-card via-student-article">
          <div className="via-guide-body">{guide.blocks.map((block,index)=>{
            if(block.type==='paragraph')return <p key={index}>{block.text}</p>
            if(block.type==='example')return <section className="via-guide-example" key={index} aria-label="Example programme requirements"><p className="via-guide-eyebrow">Example</p><h3>{block.title}</h3><dl>{block.requirements.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section>
            if(block.type==='steps')return <ol key={index}>{block.items.map(text=><li key={text}>{text}</li>)}</ol>
            return <ul className={block.type==='checklist'?'via-guide-checklist':undefined} key={index}>{block.items.map(text=><li key={text}>{block.type==='checklist'&&<Check size={19} aria-hidden="true"/>}<span>{text}</span></li>)}</ul>
          })}</div>
          <Link className="via-public-button is-primary" to={guide.to}>{guide.cta}<ArrowRight size={18} aria-hidden="true"/></Link>
        </article>
      </> : <><h2>Guide not found.</h2><p>Browse our guides to find your next step.</p><GuideLink className="via-public-button">View All Guides</GuideLink></>}
    </div>
  </PublicDialog>
}
