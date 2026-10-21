import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

export function GuideLink({ slug = 'all', className, children }: { slug?: string; className?: string; children: ReactNode }) {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const alreadyOpen = search.has('guide') || location.pathname.startsWith('/guides')
  search.set('guide', slug)
  return <Link className={className} to={{ pathname: location.pathname, search: `?${search}`, hash: location.hash }} replace={alreadyOpen} preventScrollReset aria-haspopup="dialog">{children}</Link>
}
