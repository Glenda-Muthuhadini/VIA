import { Grade9StepPage } from './Grade9StepPage'
import { OnboardingProgress } from '../components/OnboardingProgress'
import { OnboardingHomeLink } from '../components/OnboardingHomeLink'
import {
  ArrowRight,
  Camera,
  Clock,
  FileText,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingControls } from '../components/OnboardingControls'
import { ManualResultsDialog } from '../components/ManualResultsDialog'
import { reportUrl } from '../services/onboarding'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { IconCircle } from '../../../components/ui'

export function ResultsStepPage(){const {record,educationStage}=useOnboarding();return record?.flow_version===4&&educationStage==='grade_9'?<Grade9StepPage kind="results"/>:<ExistingResultsStepPage/>}
function ExistingResultsStepPage() {
  const { educationStage, answers, reports, addReport, busy, patch } = useOnboarding()
  const uploadInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualGrade,setManualGrade]=useState<number|undefined>(undefined)
  const [uploadError, setUploadError] = useState('')
  const [reportLink, setReportLink] = useState<{ id: string; url: string } | null>(null)
  const report = reports.find(report => report.id === answers.report_id)
  const resultTitle=educationStage==='grade_9'?'How are you doing at school?':educationStage==='grade_12'?'Add your Grade 11 final results.':educationStage==='post_matric'?'Add your final matric results.':'Add your latest results.'
  const url = reportLink?.id === report?.id ? reportLink?.url : ''
  useEffect(() => {
    let active = true
    const refresh = () => { if (report) void reportUrl(report).then(url => { if (active) setReportLink({ id: report.id, url }) }).catch(() => { if (active) setUploadError('We could not prepare your report link. Reload this screen to try again.') }) }
    refresh()
    const timer = window.setInterval(refresh, 240000)
    return () => { active = false; window.clearInterval(timer) }
  }, [report])
  async function selectFile(file?: File) {
    if (!file || busy) return
    setUploadError('')
    try { await addReport(file) }
    catch (error) { setUploadError(error instanceof Error ? error.message : 'We could not save your report. Please try again.') }
    finally { if (uploadInput.current) uploadInput.current.value = ''; if (cameraInput.current) cameraInput.current.value = '' }
  }
  return (
    <main className="via-product-page via-onboarding-choice">
      <img className="via-onboarding-bg" src={backgroundImage} alt="" />
      <div className="via-onboarding-choice-wash" />
      <div className="via-onboarding-arc via-onboarding-arc-one" />
      <div className="via-onboarding-arc via-onboarding-arc-two" />
      <div className="via-onboarding-arc via-onboarding-arc-three" />

      <section className="via-onboarding-panel via-onboarding-panel-upload">
        <header className="via-onboarding-panel-header">
          <OnboardingHomeLink>
            <img className="via-onboarding-panel-logo" src={viaLogo} alt="VIA" />
          </OnboardingHomeLink>

          <OnboardingProgress />

          <div className="via-onboarding-panel-time">
            <Clock size={18} />
            About 3 minutes
          </div>
        </header>

        <div className="via-onboarding-panel-copy">
          <h1>{resultTitle}</h1>
          <p>
            Upload your latest school report securely, or enter your school,
            subjects and results manually.
          </p>
          {educationStage==='grade_12'&&<p>You can also add your latest Grade 12 results if available. Previous results are kept in your academic history.</p>}
        </div>

        <section className="via-onboarding-upload-card">
          <div className="via-onboarding-upload-drop">
            <IconCircle className="via-onboarding-upload-icon" size="large">
              <UploadCloud size={30} strokeWidth={1.6} />
            </IconCircle>
            <h2>Upload your latest results</h2>
            <p>Upload a clear copy of your latest school report.</p>

            <div className="via-onboarding-upload-actions">
              <button className="via-onboarding-upload-primary" type="button" disabled={busy} onClick={() => cameraInput.current?.click()}>
                <Camera size={18} />
                Take a photo
              </button>
              <button className="via-onboarding-upload-secondary" type="button" disabled={busy} onClick={() => uploadInput.current?.click()}>
                <Upload size={18} />
                {educationStage==='grade_12'||educationStage==='post_matric'?'Upload Results':'Upload My Report'}
              </button>
            </div>

            <input ref={uploadInput} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={event => void selectFile(event.target.files?.[0])} />
            <input ref={cameraInput} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={event => void selectFile(event.target.files?.[0])} />
            <small>Accepted formats: PDF, JPG, PNG · Up to 10 MB</small>
            {report && <p className="via-onboarding-report-summary">{url ? <a href={url} target="_blank" rel="noopener noreferrer">{report.file_name} ↗</a> : report.file_name}<br />Stored securely. Enter your marks manually to use them in your VIA.</p>}
            {answers.results.length > 0 && <p role="status">{answers.results.length} subject{answers.results.length === 1 ? '' : 's'} saved{answers.school_name ? ` · ${answers.school_name}` : ''}</p>}
            {reports.some(item => item.id !== answers.report_id) && <label className="via-onboarding-existing-report">Previously uploaded reports<select value={answers.report_id ?? ''} onChange={event => patch({ report_id: event.target.value || null })}><option value="">Choose a report</option>{reports.map(item => <option value={item.id} key={item.id}>{item.file_name}</option>)}</select></label>}
            {uploadError && <p className="via-onboarding-feedback" role="alert">{uploadError}</p>}
          </div>
        </section>

        <div className="via-onboarding-or">
          <span />
          or
          <span />
        </div>

        <section className="via-onboarding-manual-card">
          <IconCircle className="via-onboarding-manual-icon" size="medium">
            <FileText size={22} strokeWidth={1.6} />
          </IconCircle>
          <div>
            <h2>Don&apos;t have your report right now?</h2>
            <p>Enter your results manually instead.</p>
          </div>
          <button type="button" disabled={busy} onClick={() => {setManualGrade(undefined);setManualOpen(true)}}>
            {educationStage==='grade_9'||educationStage==='grade_10'?'Enter My Marks Manually':'Enter Results Manually'}
            <ArrowRight size={18} />
          </button>
        </section>
        {educationStage==='grade_12'&&(answers.results.length>0||answers.report_id)&&<button className="via-onboarding-save-action" type="button" disabled={busy} onClick={()=>{setManualGrade(12);setManualOpen(true)}}>Add Latest Grade 12 Results</button>}

        <OnboardingControls />
        {manualOpen && <ManualResultsDialog initialGrade={manualGrade} onClose={() => setManualOpen(false)} />}
      </section>
    </main>
  )
}

