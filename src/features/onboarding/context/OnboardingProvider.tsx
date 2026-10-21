import { getFlow } from '../config/flows'
import { flowPosition, activeSteps, validResume } from '../services/flow-engine'
import type { EducationStage } from '../config/education-stages'
import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import { OnboardingStatus } from '../components/OnboardingStatus'
import { OnboardingContext } from './onboarding-context'
import { normaliseAnswers, emptyAnswers, saveError, steps, type Answers, type OnboardingRecord, type Step } from '../services/model'
import { loadOnboarding, saveOnboarding, uploadReport, setEducationStage, saveAdaptive } from '../services/onboarding'
import '../onboarding.css'

export function OnboardingLayout() {
  const { user } = useAuth()
  return user ? <OnboardingProvider key={user.id} userId={user.id} /> : null
}
function OnboardingProvider({ userId }: { userId: string }) {
  const { refreshProfile } = useAuth()
  const location = useLocation()
  const routeStep = location.pathname.split('/').at(-1) as Step
  const step = steps.includes(routeStep) ? routeStep : 'welcome'
  const [data, setData] = useState<Awaited<ReturnType<typeof loadOnboarding>> | null>(null)
  const [answers, setAnswers] = useState(emptyAnswers)
  const [loadError, setLoadError] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)
  const [status, setStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editVersion, setEditVersion] = useState(0)
  const current = useRef(answers)
  const currentStep = useRef(step)
  currentStep.current = step
  const revision = useRef(0)
  const savedSignature = useRef('')
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const active = useRef(true)
  const dirty = useRef(false)
  const conflict = useRef(false)
  const latestRecord = useRef<OnboardingRecord | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    void loadOnboarding(userId).then(result => {
      if (cancelled) return
      const value = result.activeAnswers
      current.current = value
      revision.current = result.record?.revision ?? 0
      latestRecord.current = result.record
      savedSignature.current = ''
      dirty.current = false
      conflict.current = false
      setAnswers(value); setData(result); setStatus('saved'); setError(''); setLoadError(false)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [userId, reloadCount])

  function patch(changes: Partial<Answers>) {
    current.current = { ...current.current, ...changes }
    dirty.current = true
    setAnswers(current.current); setStatus('unsaved'); setEditVersion(value => value + 1)
  }
  function save(target?: Step, complete = false, skipped = false, confirmResults = false): Promise<OnboardingRecord> {
    const operation = queue.current.catch(() => {}).then(async () => {
      if (!active.current) throw new Error('Onboarding was closed')
      if (conflict.current) throw new Error('Reload saved progress first')
      // An autosave queued behind Continue must not rewind the saved step.
      if (!target && !dirty.current && latestRecord.current) return latestRecord.current
      const destination = target ?? currentStep.current
      setStatus('saving'); setError('')
      try {
        // Capture at execution time, and flush edits made during the request
        // before resolving an action that may leave this provider.
        while (active.current) {
          const snapshot = current.current
          const signature = JSON.stringify([snapshot, destination, complete, skipped, confirmResults])
          if (signature === savedSignature.current && latestRecord.current) {
            dirty.current = false
            setStatus('saved')
            return latestRecord.current
          }
          const previous = latestRecord.current
          const flow = getFlow(data?.profile?.education_stage ?? null,previous?.flow_version ?? 4,previous?.carried_steps?.filter(id=>id!==currentStep.current))
          const position = flowPosition(flow,snapshot,currentStep.current)
          const tracked = target === position.next && !['building','ready'].includes(currentStep.current) ? currentStep.current : null
          const answered = [...new Set([...(previous?.answered_steps ?? []), ...(tracked && !skipped ? [tracked] : [])])].filter(id => !(skipped && id === tracked))
          const skippedSteps = [...new Set([...(previous?.skipped_steps ?? []), ...(tracked && skipped ? [tracked] : [])])].filter(id => !(tracked === id && !skipped))
          if (!data?.profile?.education_stage) throw new Error('Choose your education stage first')
          const record = (previous?.flow_version ?? 4) >= 3
            ? await saveAdaptive(userId, data.profile.education_stage, snapshot, destination, revision.current, complete, answered, skippedSteps, confirmResults)
            : await saveOnboarding(userId, snapshot, destination, revision.current, complete)
          revision.current = record.revision
          latestRecord.current = record
          savedSignature.current = signature
          if (active.current) setData(data => data ? { ...data, record } : data)
          if (confirmResults && snapshot === current.current && record.grade9) {
            current.current=normaliseAnswers({...record.journey_answers,grade9:record.grade9},data.options,data.reports)
            setAnswers(current.current);dirty.current=false;setStatus('saved');return record
          }
          if (snapshot === current.current) {
            dirty.current = false
            if (active.current) setStatus('saved')
            return record
          }
        }
        throw new Error('Onboarding was closed')
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '40001') conflict.current = true
        if (active.current) { setStatus('error'); setError(saveError(error)) }
        throw error
      }
    })
    queue.current = operation
    return operation
  }
  // Save only user edits. Back/Continue/finish-later explicitly await the queue.
  useEffect(() => {
    if (!data || !dirty.current || !editVersion || conflict.current) return
    const timer = window.setTimeout(() => { if (dirty.current) void save().catch(() => {}) }, 650)
    return () => window.clearTimeout(timer)
    // The mutable refs deliberately capture the latest draft and route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVersion])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  async function storeGrade9Report(file:File){
    const report=await uploadReport(userId,file)
    if(!active.current)throw new Error('Onboarding was closed')
    setData(data=>data?{...data,reports:[report,...data.reports]}:data)
    return report
  }
  async function addReport(file: File) {
    setBusy(true)
    try {
      const report = await uploadReport(userId, file)
      if (!active.current) return
      setData(data => data ? { ...data, reports: [report, ...data.reports] } : data)
      const stage=data?.profile?.education_stage
      patch(data?.record?.flow_version===4?{report_id:report.id,results:[],report_grade:current.current.report_grade??(stage==='grade_9'?9:stage==='grade_10'?10:stage==='post_matric'?12:11),report_type:current.current.report_type??(stage==='grade_12'||stage==='post_matric'?'final':'latest')}:{ report_id: report.id })
      await save()
    } finally { if (active.current) setBusy(false) }
  }
  async function changeStage(stage: EducationStage) {
    setBusy(true); setError('')
    try {
      if (dirty.current) await save()
      await queue.current.catch(() => {})
      if (conflict.current) throw new Error('Reload saved progress first')
      await setEducationStage(userId, stage, revision.current)
      const result = await loadOnboarding(userId)
      revision.current = result.record?.revision ?? 0; latestRecord.current = result.record
      current.current = result.activeAnswers; dirty.current = false; savedSignature.current = ''
      setAnswers(result.activeAnswers); setData(result); setStatus('saved')
      refreshProfile()
    } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === '40001') conflict.current = true; setError(saveError(error)); setStatus('error'); throw error }
    finally { setBusy(false) }
  }
  function reload() {
    if (status === 'saving' || busy) return
    setData(null); setLoadError(false); setReloadCount(value => value + 1)
  }
  if (loadError) return <OnboardingStatus retry={reload} />
  if (!data) return <OnboardingStatus />
  const educationStage = data.profile?.education_stage ?? null
  const flow = getFlow(educationStage, data.record?.flow_version ?? 4,data.record?.carried_steps?.filter(id=>id!==step))
  const first = validResume(flow, answers, data.record)
  if (data.record?.flow_version === 2 && !data.record.completed_at && flowPosition(flow,answers,step).index > flowPosition(flow,answers,first).index) return <Navigate to={`/onboarding/${first}`} replace />
  if (step !== 'welcome' && step !== 'current' && !educationStage) return <Navigate to="/onboarding/current" replace />
  if (!['building','ready'].includes(step) && !activeSteps(flow,answers).some(item => item.id === step)) return <Navigate to={`/onboarding/${first}`} replace />
  if (['building','ready'].includes(step) && !(educationStage==='grade_9'&&data.record?.flow_version===4) && (!data.record?.completed_at || !flow.implemented)) return <Navigate to={`/onboarding/${flowPosition(flow,answers,'current').next}`} replace />
  return <OnboardingContext.Provider value={{ flow, educationStage, changeStage, confirmationRequired: data.profile?.education_stage_confirmation_required !== false, answers, record: data.record, reports: data.reports, options: data.options, status, error, busy, step,
    choices: category => data.options.filter(option => option.category === category && (!option.education_stages || (educationStage && option.education_stages.includes(educationStage))) ), patch, save, reload, addReport, storeGrade9Report }}><Outlet /></OnboardingContext.Provider>
}
