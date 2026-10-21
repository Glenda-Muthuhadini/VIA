import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ChevronDown } from 'lucide-react'

/** Supporting information stays available without filling the whole page. */
export function Grade9Disclosure({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const location = useLocation()
  useEffect(() => {
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null
    if (target && ref.current?.contains(target)) {
      ref.current.open = true
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
    }
  }, [location.hash, location.key])
  return <details className="g9-section g9-disclosure" id={id} ref={ref}>
    <summary><span>{title}</span><ChevronDown size={19} aria-hidden="true" /></summary>
    <div className="g9-disclosure-content">{children}</div>
  </details>
}
