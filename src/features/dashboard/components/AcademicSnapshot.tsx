import { ArrowRight, ChevronRight, ScanLine } from 'lucide-react'
import type { AcademicResult } from '../services/dashboard-model'

export function AcademicSnapshot({ results, loading, unavailable, onScan, onWhatIf }: { results: AcademicResult[]; loading: boolean; unavailable: boolean; onScan: () => void; onWhatIf: (id: string) => void }) {
  return <section className="via-workspace-detail-card via-workspace-glass" aria-labelledby="via-academic-title">
    <header className="via-workspace-section-heading"><span><ScanLine size={23} aria-hidden="true" /><h2 id="via-academic-title">Academic Snapshot</h2></span><button className="via-workspace-round-button" type="button" aria-label="View VIA Scan" onClick={onScan}><ChevronRight size={18} /></button></header>
    {loading ? <p className="via-workspace-empty" role="status">Loading your latest results…</p>
      : unavailable ? <p className="via-workspace-empty">Your results could not be loaded. Retry to see your academic snapshot.</p>
      : results.length ? <>
        <ul className="via-workspace-academic-results">{results.map(result => <li key={result.subjectId}>
          <span>{result.subject}</span><strong>{result.percentage}%</strong><small className={result.insight === 'Focus area' ? 'is-focus' : ''}>{result.insight}</small>
          {result.insight === 'Focus area' && <button type="button" onClick={() => onWhatIf(result.subjectId)}>See what this could unlock <ArrowRight size={13} /></button>}
        </li>)}</ul>
        <p className="via-workspace-insight-key">Study planning guide: Strong 70%+, On track 50–69%, Focus area below 50%. Programme requirements vary.</p>
      </> : <p className="via-workspace-empty">Upload your latest results to unlock your academic analysis.</p>}
    <button className="via-workspace-soft-button" type="button" onClick={onScan}>{results.length ? 'View VIA Scan' : 'Scan my results'}<ArrowRight size={16} aria-hidden="true" /></button>
  </section>
}
