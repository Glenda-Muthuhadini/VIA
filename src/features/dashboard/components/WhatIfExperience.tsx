import { useState } from 'react'
import type { AcademicResult } from '../services/dashboard-model'

export type WhatIfScenario = { subjectId: string; currentPercentage: number; targetPercentage: number }
// Future Match simulations can consume this scenario and return verified
// comparisons. Until that source exists, this component shows no invented gains.
export function WhatIfExperience({ results, initialSubjectId }: { results: AcademicResult[]; initialSubjectId?: string }) {
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? results[0]?.subjectId ?? '')
  const [target, setTarget] = useState<number | null>(null)
  const subject = results.find(result => result.subjectId === subjectId) ?? results[0]
  if (!subject) return <p className="via-workspace-dialog-description">Add your latest subject results in VIA Scan to explore a What-If scenario.</p>
  const scenario: WhatIfScenario = { subjectId: subject.subjectId, currentPercentage: subject.percentage, targetPercentage: Math.max(subject.percentage, Math.min(100, target ?? subject.percentage + 5)) }
  return <div className="via-workspace-whatif">
    <p className="via-workspace-dialog-description">Explore a study target. This scenario does not change your saved results.</p>
    <label>Subject<select value={subject.subjectId} onChange={event => { setSubjectId(event.target.value); setTarget(null) }}>{results.map(result => <option key={result.subjectId} value={result.subjectId}>{result.subject}</option>)}</select></label>
    <div className="via-workspace-whatif-values"><span>Saved result<strong>{subject.percentage}%</strong></span><span>What-If target<strong><output htmlFor="via-whatif-target">{scenario.targetPercentage}%</output></strong></span></div>
    <label htmlFor="via-whatif-target">Try a target percentage<input id="via-whatif-target" type="range" min={subject.percentage} max={100} step={0.1} value={scenario.targetPercentage} onChange={event => setTarget(Number(event.target.value))} /></label>
    <p className="via-workspace-whatif-change" role="status">{Number((scenario.targetPercentage - scenario.currentPercentage).toFixed(1))} percentage points above your saved result.</p>
    <div className="via-workspace-whatif-outcome"><strong>What could this unlock?</strong><p>Opportunity comparisons aren’t available yet. No new matches or eligibility changes have been calculated for this target.</p></div>
  </div>
}
