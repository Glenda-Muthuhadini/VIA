import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Camera, Check, FileUp, FileText, PencilLine, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import { SubjectResultsEditor, type ResultRow } from '../../../components/academic/SubjectResultsEditor'
import { uploadReport } from '../../onboarding/services/onboarding'
import { checkConnectedQualification, confirmedResults, myQualificationResults, qualificationMetadata, type ConnectedResponse } from '../services/qualification'
import type { ResultsGrade } from '../services/report-results'
import type { SubjectResult } from '../../onboarding/services/model'
import { PublicDialog } from './PublicDialog'
import { QualificationResults } from './QualificationResults'
import './qualification.css'

type Method = 'upload' | 'camera' | 'manual'
const blankRow = (): ResultRow => ({ key: crypto.randomUUID(), subject_id: '', mark: '' })
const methods = [
  { id: 'upload', title: 'Upload report', copy: 'PDF, JPG or PNG', icon: FileUp },
  { id: 'camera', title: 'Take a photo', copy: 'Use your camera', icon: Camera },
  { id: 'manual', title: 'Enter manually', copy: '', icon: PencilLine },
] as const

export function QualificationChecker({ onClose, onView }: { onClose: () => void; onView: (id: string) => void }) {
  const { user } = useAuth()
  return <QualificationCheckerBody key={user?.id ?? 'guest'} onClose={onClose} onView={onView} />
}
function QualificationCheckerBody({ onClose, onView }: { onClose: () => void; onView: (id: string) => void }) {
  const { user } = useAuth(), userId = user?.id
  const [method, setMethod] = useState<Method | null>(null), [grade, setGrade] = useState<ResultsGrade | null>(null), [changeGrade,setChangeGrade]=useState(false)
  const [rows, setRows] = useState<ResultRow[]>(() => [blankRow()]), [subjects, setSubjects] = useState<{ id: string; label: string }[]>([]), [years, setYears] = useState<number[]>([]), [year, setYear] = useState('')
  const [response, setResponse] = useState<ConnectedResponse | null>(null), [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('')
  const [metadataError, setMetadataError] = useState(false), [retry, setRetry] = useState(0)
  const [ownResults, setOwnResults] = useState<SubjectResult[]>([]), [ownError, setOwnError] = useState(false), [ownRetry, setOwnRetry] = useState(0)
  const [fileInfo, setFileInfo] = useState<{ name: string; url: string } | null>(null), [extracted, setExtracted] = useState(false), [notice, setNotice] = useState('')
  const fileUrl = useRef(''), extraction = useRef<AbortController | null>(null), request = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null), photoInput = useRef<HTMLInputElement>(null), live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false; request.current?.abort(); extraction.current?.abort(); if (fileUrl.current) URL.revokeObjectURL(fileUrl.current) } }, [])
  useEffect(() => {
    const controller = new AbortController()
    void qualificationMetadata(controller.signal).then(data => {
      if (!controller.signal.aborted) { setSubjects(data.subjects); setYears(data.years); setYear(current => data.years.includes(Number(current)) ? current : String(data.years[0] ?? '')) }
    }).catch(() => { if (!controller.signal.aborted) setMetadataError(true) })
    return () => controller.abort()
  }, [retry])
  useEffect(() => { let active = true; if (userId) void myQualificationResults(userId).then(results => { if (active) setOwnResults(results) }).catch(() => { if (active) setOwnError(true) }); return () => { active = false } }, [userId, ownRetry])
  function changed() { request.current?.abort(); setBusy(false); setResponse(null); setError('') }
  function chooseGrade(value:ResultsGrade) {
    changed();setGrade(value);setChangeGrade(false)
    if(value>=10)setRows(previous=>{const valid=previous.filter(row=>!row.subject_id.startsWith('subject-g9-'));return valid.length?valid:[blankRow()]})
  }
  function choose(next: Method) {
    extraction.current?.abort(); setReading(false); changed(); setMethod(next)
    if (next === 'upload') fileInput.current?.click()
    if (next === 'camera') photoInput.current?.click()
  }
  async function readReport(file: File | undefined) {
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 10485760) { setError('Choose a PDF, JPG or PNG up to 10 MB.'); return }
    changed(); extraction.current?.abort()
    const controller = new AbortController(); extraction.current = controller
    setReading(true); setExtracted(false); setGrade(null); setChangeGrade(false); setNotice(''); setProgress('Opening report…')
    if (fileUrl.current) URL.revokeObjectURL(fileUrl.current)
    fileUrl.current = URL.createObjectURL(file); setFileInfo({ name: file.name, url: fileUrl.current })
    try {
      const { extractReport } = await import('../services/report-reader')
      if (controller.signal.aborted) return
      const result = await extractReport(file, subjects, controller.signal, message => { if (!controller.signal.aborted) setProgress(message) })
      if (controller.signal.aborted) return
      setRows(result.results.map(row => ({ ...row, key: crypto.randomUUID() })))
      setGrade(result.grade); setExtracted(true)
      setNotice(result.needsReview ? 'Check the detected marks. Unclear values are left blank.' : 'Check the detected subjects and marks before continuing.')
      if (user) {
        try { await uploadReport(user.id, file) }
        catch { if (!controller.signal.aborted) setNotice('Results read. Your report could not be saved to VIA; you can still continue.') }
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'We could not read this report. Try another photo or enter results manually.')
    } finally { if (live.current && !controller.signal.aborted) setReading(false) }
  }
  async function calculate() {
    try {
      if (!grade) throw new Error('Choose the grade these results are from.')
      const results = confirmedResults(rows)
      if (!years.includes(Number(year))) throw new Error('An intake year could not be loaded. Please try again.')
      request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setError('')
      try {
        const result = await checkConnectedQualification(results,grade,Number(year),controller.signal)
        if (!controller.signal.aborted) setResponse(result)
      } catch { if (!controller.signal.aborted) setError('We could not check your results. Please try again.') }
      finally { if (!controller.signal.aborted) setBusy(false) }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Check your subjects and marks.') }
  }
  const showResults = method === 'manual' || (extracted && !reading)
  const visibleSubjects=grade&&grade>=10?subjects.filter(subject=>!subject.id.startsWith('subject-g9-')):subjects
  return <PublicDialog title="Check what you qualify for" onClose={onClose} className="via-qualification-dialog">
    <div className="via-qualification-content">
      <h2>Check what you qualify for</h2>
      <p className="via-qualification-subtitle">{grade&&grade<=10?'Add your results to explore future study pathways.':'Add your results to see programmes you meet the requirements for.'}</p>
      <h3 className="via-qualification-method-title">Choose how to add your results</h3>
      <div className="via-qualification-methods" role="group" aria-label="Choose one way to add results">
        {methods.map(({ id, title, copy, icon: Icon }) => <button type="button" key={id} aria-pressed={method === id} onClick={() => choose(id)} disabled={id !== 'manual' && (!subjects.length || metadataError)}>
          <Icon size={21} aria-hidden="true" /><span>{title}{copy && <small>{copy}</small>}</span>{method === id && <Check size={14} className="via-qualification-selected" aria-hidden="true" />}
        </button>)}
      </div>
      <input ref={fileInput} className="via-public-sr-only" tabIndex={-1} type="file" accept="application/pdf,image/jpeg,image/png" aria-label="Upload report file" onChange={event => { void readReport(event.target.files?.[0]); event.target.value = '' }} />
      <input ref={photoInput} className="via-public-sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png" capture="environment" aria-label="Take or upload report photo" onChange={event => { void readReport(event.target.files?.[0]); event.target.value = '' }} />
      {metadataError ? <div className="via-public-empty" role="alert"><p>Subjects could not be loaded.</p><button className="via-public-button" type="button" onClick={() => { setMetadataError(false); setRetry(value => value + 1) }}>Try again</button></div> : !subjects.length && <p role="status" className="via-qualification-note">Loading subjects…</p>}
      {method && method !== 'manual' && <div className="via-qualification-file-area">
        {fileInfo ? <a className="via-qualification-file" href={fileInfo.url} target="_blank" rel="noopener noreferrer"><FileText size={20} aria-hidden="true" /><span>{fileInfo.name}</span><ArrowRight size={16} aria-hidden="true" /></a>
          : <button className="via-qualification-pick-file" type="button" disabled={!subjects.length} onClick={() => method === 'camera' ? photoInput.current?.click() : fileInput.current?.click()}>{method === 'camera' ? 'Open camera' : 'Choose report'}<small>Up to 10 MB · read privately in your browser</small></button>}
        {reading && <div className="via-qualification-reading" role="status"><LoaderCircle size={18} aria-hidden="true" /><span>{progress}</span><button type="button" onClick={() => { extraction.current?.abort(); setReading(false) }}>Cancel</button></div>}
      </div>}
      {showResults&&subjects.length>0&&<div className="via-qualification-grade-choice">
        {method==='manual'||!grade||changeGrade?<><h3>{method==='manual'?'What grade are you in?':'What grade are these results from?'}</h3><div className="via-qualification-grades" role="group" aria-label="Results grade">{([9,10,11,12] as const).map(value=><button type="button" key={value} aria-pressed={grade===value} onClick={()=>chooseGrade(value)}>Grade {value}</button>)}</div></>:<div className="via-qualification-grade-detected"><span>Grade {grade} results</span><button className="via-public-text-button" type="button" onClick={()=>setChangeGrade(true)}>Change</button></div>}
      </div>}
      {showResults && grade && subjects.length > 0 && <form onSubmit={(event: FormEvent) => { event.preventDefault(); void calculate() }}>
        <div className="via-qualification-results-heading"><h3>{method === 'manual' ? 'Results' : 'Review your results'}</h3>
          {method === 'manual' && ownResults.length > 0 && <button className="via-public-text-button" type="button" onClick={() => { changed(); setRows(ownResults.map(row => ({ ...row, mark: String(row.mark), key: crypto.randomUUID() }))) }}>Use my VIA results</button>}
          {method === 'manual' && ownError && <button className="via-public-text-button" type="button" onClick={() => { setOwnError(false); setOwnRetry(value => value + 1) }}>Retry saved results</button>}
        </div>
        {notice && method !== 'manual' && <p className="via-qualification-note" role="status">{notice}</p>}
        <SubjectResultsEditor rows={rows} onChange={value => { changed(); setRows(value) }} subjects={visibleSubjects} disabled={reading} />
        {years.length > 1 && <label className="via-qualification-year">Intake year<select value={year} onChange={event => { changed(); setYear(event.target.value) }}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
        <button className="via-public-button is-primary via-qualification-submit" type="submit" disabled={busy || reading || !years.length}>{busy ? 'Checking your results…' : grade<=10?'See my pathways':'See what I qualify for'}<ArrowRight size={18} /></button>
      </form>}
      {error && <p className="via-public-inline-notice" role="alert">{error}</p>}
      {response&&<QualificationResults response={response} onView={onView} onClose={onClose} busy={busy}/>}
    </div>
  </PublicDialog>
}

export function QualificationLauncher({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), navigate = useNavigate()
  return <><button className={className} type="button" onClick={() => setOpen(true)}>{children}</button>{open && <QualificationChecker onClose={() => setOpen(false)} onView={id => { setOpen(false); navigate('/programmes?' + new URLSearchParams({ opportunity: id })) }} />}</>
}
