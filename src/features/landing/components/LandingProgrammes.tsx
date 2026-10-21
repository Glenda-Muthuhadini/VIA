import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { searchOpportunities } from '../../discovery/services/discovery'
import type { Opportunity } from '../../discovery/services/model'

const studyImage = '/images/Sunlit Green Study Workspace.png'

export function LandingProgrammes() {
  const [programmes, setProgrammes] = useState<Opportunity[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void searchOpportunities('programmes', '', {}, 1, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return
        setProgrammes(result.items.slice(0, 3))
        setStatus('ready')
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [retry])

  return <div className="via-landing-opportunity-grid" aria-busy={status === 'loading'}>
    {status === 'loading' ? <p className="via-landing-programme-state" role="status">Loading programmes…</p>
      : status === 'error' ? <div className="via-landing-programme-state" role="alert">
        <p>Programmes could not be loaded.</p>
        <button className="via-landing-button via-landing-button-muted" type="button" onClick={() => { setStatus('loading'); setRetry(value => value + 1) }}>Try again</button>
      </div>
      : !programmes.length ? <p className="via-landing-programme-state">Programmes will appear here when available.</p>
      : programmes.map(programme => <article className="via-landing-opportunity-card" key={programme.id}>
        <Link to={`/programmes?${new URLSearchParams({ opportunity: programme.id })}`}>
          <img src={programme.image_url || studyImage} alt="" loading="lazy" />
          <div className="via-landing-opportunity-caption">
            <h3>{programme.title}</h3>
            <p>View programme<ArrowRight size={15} aria-hidden="true" /></p>
          </div>
        </Link>
      </article>)}
  </div>
}
