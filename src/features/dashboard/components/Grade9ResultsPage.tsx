import { Grade9Disclosure } from './Grade9Disclosure'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Camera, Check, FileUp, History, PencilLine, Plus } from 'lucide-react'
import { reportUrl } from '../../onboarding/services/onboarding'
import { deriveDashboard, type DashboardData } from '../services/dashboard-model'
import { capsPerformance, reportPeriod, resultAverage, subjectProgress, type Grade9ReportHistory } from '../services/grade9-results'
import { loadGrade9ReportHistory } from '../services/grade9-results-store'
import './Grade9ResultsPage.css'

export function Grade9ResultsPage({ data, onReviewed, onSubjectChoices }: { data: DashboardData; onReviewed: () => void | Promise<void>; onSubjectChoices?: () => void }) {
  const view = deriveDashboard(data), owner = data.profile?.id ?? data.record?.user_id ?? ''
  const [historySource, setHistorySource] = useState<{ owner: string; reports: Grade9ReportHistory[]; status: 'loading' | 'ready' | 'error' }>({ owner: '', reports: [], status: 'loading' }), [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState(''), [opening, setOpening] = useState(''), [error, setError] = useState(''), [reviewing, setReviewing] = useState(false), [reviewed, setReviewed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    if (owner) loadGrade9ReportHistory(owner, data.options, controller.signal).then(rows => { if (!controller.signal.aborted) setHistorySource({ owner, reports: rows, status: 'ready' }) }).catch(() => { if (!controller.signal.aborted) setHistorySource({ owner, reports: [], status: 'error' }) })
    return () => controller.abort()
  }, [owner, data.options, retry])
  const history = historySource.owner === owner ? historySource.reports : [], status = historySource.owner === owner ? historySource.status : 'loading'
  const chosen = history.find(report => report.id === selected)
  const current: Grade9ReportHistory = chosen ?? {
    id: 'current-confirmed', user_id: owner, school_name: view.answers.school_name || view.answers.grade9.school_name,
    academic_year: view.answers.academic_year, grade: view.answers.report_grade ?? 9, report_type: view.answers.report_type,
    report_id: view.answers.report_id, created_at: data.record?.updated_at ?? '', results: view.results,
  }
  const average = resultAverage(current.results)
  const strongest = [...current.results].filter(result => result.percentage >= 70).sort((a, b) => b.percentage - a.percentage)
  const attention = [...current.results].filter(result => result.percentage < 50).sort((a, b) => a.percentage - b.percentage)
  const maths = current.results.find(result => /^mathematics$/i.test(result.subject)), progress = subjectProgress(current, history)
  async function openOriginal(id: string) {
    const report = data.reports.find(row => row.id === id && row.user_id === owner)
    if (!report) return
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    setOpening(id); setError('')
    try { const url = await reportUrl(report); if (tab) tab.location.replace(url); else setError('Allow pop-ups, then select Open original again.') }
    catch { tab?.close(); setError('Your original report could not be opened. Please try again.') }
    finally { setOpening('') }
  }
  async function markReviewed() {
    setReviewing(true); setError('')
    try { await onReviewed(); setReviewed(true) } catch { setError('We could not save your review. Please try again.') }
    finally { setReviewing(false) }
  }
  return <>
    <header className="g9-welcome"><div><span className="g9-eyebrow">MY JOURNEY / MY RESULTS</span><h1>My Results</h1><p>Your academic record, your progress, and the foundations for your Grade 10 choices.</p></div><Link className="g9-button primary" to="/onboarding/results"><Plus size={17} />Add Results</Link></header>
    <section className="g9-section" id="grade9-academic-overview" aria-labelledby="g9-academic-overview"><span className="g9-eyebrow">YOUR ACADEMIC OVERVIEW</span><h2 id="g9-academic-overview">{chosen ? 'Saved report' : 'Latest Results'}</h2>
      <dl className="g9r-overview"><div><dt>Grade</dt><dd>{current.grade ?? 'Not recorded'}</dd></div><div><dt>School</dt><dd>{current.school_name || 'Not recorded'}</dd></div><div><dt>Academic year</dt><dd>{current.academic_year ?? 'Not recorded'}</dd></div><div><dt>Report</dt><dd>{reportPeriod(current.report_type)}</dd></div><div><dt>Overall Average</dt><dd className="g9r-average">{average === null ? 'No marks yet' : `${average}%`}</dd></div></dl>
      <p className="g9r-fine">The average treats each recorded subject equally. It is a planning overview, not your school’s weighted promotion result.</p>
      {chosen && <button className="g9-button" onClick={() => setSelected('')}>Return to latest confirmed results</button>}
      {current.report_id && data.reports.some(report => report.id === current.report_id && report.user_id === owner) && <button className="g9-button" disabled={opening === current.report_id} onClick={() => void openOriginal(current.report_id!)}>{opening === current.report_id ? 'Opening report…' : 'Open original report ↗'}</button>}
    </section>
    <section className="g9-section" aria-labelledby="g9r-results-heading"><h2 id="g9r-results-heading">{chosen ? 'Report Results' : 'Latest Results'}</h2>
      {current.results.length ? <><div className="g9r-table"><div className="g9r-table-head" aria-hidden="true"><span>Subject</span><span>Mark</span><span>CAPS Level / performance</span></div><ul aria-label="Complete report results">{current.results.map(result => { const caps = capsPerformance(result.percentage); return <li key={result.subjectId}><strong>{result.subject}</strong><b aria-label={`Mark ${result.percentage} percent`}>{result.percentage}%</b><span><strong className="g9r-level">Level {caps.level}</strong><span>{caps.label}</span></span></li> })}</ul></div><p className="g9r-fine">CAPS levels describe your mark on the national seven-point achievement scale. <a href="https://www.education.gov.za/Portals/0/Documents/Reports/2024/2024NSC%20Examination%20Report.pdf?ver=2025-01-14-090227-007" target="_blank" rel="noopener noreferrer">View the DBE achievement scale ↗</a></p></> : <p className="g9-note">No confirmed marks are available for this report. Add your subjects and results to build your academic picture.</p>}
    </section>
    <Grade9Disclosure title="Strengths & areas to improve"><div className="g9r-snapshot"><article className="g9-summary"><h3>Doing Well</h3>{strongest.length ? <ul>{strongest.map(result => <li key={result.subjectId}><strong>{result.subject}</strong><span>{result.percentage}%</span></li>)}</ul> : <p>{current.results.length ? 'Keep building your foundations. Your next report can show how you are progressing.' : 'Your strengths will appear once you add confirmed results.'}</p>}</article><article className="g9-summary"><h3>Needs Attention</h3>{attention.length ? <><ul>{attention.map(result => <li key={result.subjectId}><strong>{result.subject}</strong><span>{result.percentage}%</span></li>)}</ul><p>Ask your teacher which topics to work on first.</p></> : <p>{current.results.length ? 'No recorded subjects are below 50%. Keep working on your foundations.' : 'Add results to identify subjects where support may help.'}</p>}</article></div></Grade9Disclosure>
    <section className="g9-section" aria-labelledby="g9r-insights-heading"><h2 id="g9r-insights-heading">Result insights</h2><ul className="g9r-insights">{maths && <li>Mathematics is a foundation to watch because it can affect several Grade 10 subject choices and future study options. Your current mark is {maths.percentage}%.</li>}{strongest[0] && <li>You are performing strongly in {strongest[0].subject} ({strongest[0].percentage}%). Think about how much you enjoy the work as well as the mark.</li>}{attention[0] && <li>{attention[0].subject} is your lowest recorded mark at {attention[0].percentage}%. Ask your teacher about one manageable improvement goal.</li>}{!current.results.length && <li>Add confirmed results to see observations based on your own subjects.</li>}{current.results.length > 0 && !maths && !strongest.length && !attention.length && <li>Your recorded subjects are between 50% and 69%. Keep practising, and compare your next report to see what improves.</li>}</ul><p className="g9r-fine">These observations support planning. Marks alone do not decide which subjects or career you should choose.</p>
      {!chosen && current.results.length > 0 && <button className="g9-button" disabled={reviewing || reviewed} onClick={() => void markReviewed()}>{reviewed ? <><Check size={17} />Results Reviewed</> : reviewing ? 'Saving review…' : 'Mark Results Reviewed'}</button>}
    </section>
    <Grade9Disclosure title="Report history" id="grade9-report-history"><p>Only reports you have actually saved appear here. Earlier reports stay available when you add a new one.</p>
      {status === 'loading' && <p role="status">Loading your report history…</p>}
      {status === 'error' && <p className="g9-note" role="alert">Your report history could not be loaded. Your latest confirmed results are still shown above. <button onClick={() => { setHistorySource({ owner, reports: [], status: 'loading' }); setRetry(value => value + 1) }}>Retry history</button></p>}
      {status === 'ready' && !history.length && <p className="g9-note">No separate report history has been saved yet. Your current confirmed results remain above. A new confirmed report builds your history.</p>}
      {history.length > 0 && <div className="g9r-history-list">{history.map(report => <button className={`g9r-history-item${selected === report.id ? ' selected' : ''}`} key={report.id} aria-pressed={selected === report.id} onClick={() => { setSelected(report.id); document.getElementById('grade9-academic-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><span><strong>Grade {report.grade} · {reportPeriod(report.report_type)}</strong><span>{report.academic_year ?? 'Year not recorded'} · {report.results.length} recorded subjects</span></span><ArrowRight size={17} /></button>)}</div>}
      {data.reports.filter(report => report.user_id === owner).length > 0 && <details className="g9r-originals"><summary>Original uploaded reports ({data.reports.filter(report => report.user_id === owner).length})</summary><p className="g9r-fine">An uploaded original can be kept before its marks are confirmed. Only confirmed marks are used in your academic history.</p><ul>{data.reports.filter(report => report.user_id === owner).map(report => <li key={report.id}><span>{report.file_name}</span><button className="g9-button" disabled={opening === report.id} onClick={() => void openOriginal(report.id)}>{opening === report.id ? 'Opening…' : 'Open original ↗'}</button></li>)}</ul></details>}
    </Grade9Disclosure>
    <Grade9Disclosure title="Compare my progress">{progress.length ? <div className="g9r-progress-list">{progress.map(result => <article key={result.subjectId}><h3>{result.subject}</h3><p>{reportPeriod(result.previous.report_type)} {result.previous.academic_year}: <strong>{result.previousMark}%</strong><br />{reportPeriod(current.report_type)} {current.academic_year}: <strong>{result.percentage}%</strong></p><strong className={result.change > 0 ? 'g9r-change up' : result.change < 0 ? 'g9r-change down' : 'g9r-change'}>{result.change > 0 ? '+' : ''}{result.change} percentage points</strong></article>)}</div> : <p>When the same subject appears in two reports with a known year and period, you can compare its marks here. Add earlier reports to build that picture.</p>}</Grade9Disclosure>
    <Grade9Disclosure title="Add or upload a report"><div className="g9-actions"><Link className="g9-button" to="/onboarding/results?mode=scan"><Camera size={17} />Scan Report</Link><Link className="g9-button" to="/onboarding/results?mode=upload"><FileUp size={17} />Upload Report</Link><Link className="g9-button" to="/onboarding/results?mode=manual"><PencilLine size={17} />Enter Marks Manually</Link><a className="g9-button" href="#grade9-report-history"><History size={17} />View Report History</a></div><Link className="g9-button primary" to="/dashboard/subject-choices" onClick={onSubjectChoices}>Use these results in my Grade 10 plan <ArrowRight size={17} /></Link></Grade9Disclosure>
    {error && <p className="g9-note" role="alert">{error}</p>}
  </>
}
