import { X } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useOnboarding } from '../context/onboarding-context'
import { SubjectResultsEditor, type ResultRow } from '../../../components/academic/SubjectResultsEditor'

export function ManualResultsDialog({ onClose, initialGrade }: { onClose: () => void; initialGrade?:number }) {
  const { answers, choices, patch, save, educationStage } = useOnboarding()
  const dialog = useRef<HTMLDialogElement>(null)
  const [school, setSchool] = useState(answers.school_name)
  const [year, setYear] = useState(initialGrade?'':answers.academic_year?.toString() ?? '')
  const [reportType, setReportType] = useState(initialGrade?'latest':answers.report_type ?? '')
  const defaultGrade=educationStage==='grade_9'?9:educationStage==='grade_10'?10:educationStage==='grade_11'||educationStage==='grade_12'?11:12
  const [reportGrade,setReportGrade]=useState(initialGrade??answers.report_grade??defaultGrade)
  const [rows, setRows] = useState<ResultRow[]>(!initialGrade&&answers.results.length ? answers.results.map(result => ({ subject_id: result.subject_id, mark: String(result.mark), key: crypto.randomUUID() })) : [{ subject_id: '', mark: '', key: crypto.randomUUID() }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!rows.length || rows.some(row => !row.subject_id || row.mark.trim() === '' || !Number.isFinite(Number(row.mark)) || Number(row.mark) < 0 || Number(row.mark) > 100)) { setError('Choose a subject and enter a mark between 0 and 100 for each row.'); return }
    if (new Set(rows.map(row => row.subject_id)).size !== rows.length) { setError('Please list each subject only once.'); return }
    if (year && (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100)) { setError('Enter a valid academic year between 2000 and 2100.'); return }
    setSaving(true)
    patch({ school_name: school.trim(), academic_year: year ? Number(year) : null, report_type: reportType || (educationStage==='grade_12'||educationStage==='post_matric'?'final':null), report_grade: reportGrade, ...(initialGrade?{report_id:null}:{}), results: rows.map(row => ({ subject_id: row.subject_id, mark: Number(row.mark) })) })
    try { await save(); onClose() }
    catch { setError('Your results could not be saved. Check your connection and try again.') }
    finally { setSaving(false) }
  }
  return <dialog className="via-manual-results-dialog" ref={dialog} aria-labelledby="via-manual-results-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <header><h2 id="via-manual-results-title">Enter results manually</h2><button type="button" aria-label="Close results" disabled={saving} onClick={onClose}><X size={22} /></button></header>
    <form onSubmit={submit}>
      <div className="via-manual-school-fields"><label>School name (optional)<input maxLength={200} value={school} onChange={event => setSchool(event.target.value)} autoComplete="organization" /></label><label>Academic year (optional)<input type="number" min={2000} max={2100} value={year} onChange={event => setYear(event.target.value)} /></label></div>
      <div className="via-manual-school-fields"><label>Report grade<select value={reportGrade} onChange={event=>setReportGrade(Number(event.target.value))}>{(educationStage==='grade_12'?[11,12]:[defaultGrade]).map(value=><option key={value} value={value}>Grade {value}</option>)}</select></label><label>Report type<select value={reportType} onChange={event => setReportType(event.target.value)}><option value="">{educationStage==='grade_12'||educationStage==='post_matric'?'Final':'Not specified'}</option>{['latest','term_1','term_2','term_3','term_4','final'].map(value => <option key={value} value={value}>{value.replace('_',' ')}</option>)}</select></label></div>
      <SubjectResultsEditor rows={rows} onChange={setRows} subjects={choices('subject')} disabled={saving}/>
      {error && <p className="via-onboarding-feedback" role="alert">{error}</p>}
      <footer><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button className="via-onboarding-continue-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save results'}</button></footer>
    </form>
  </dialog>
}
