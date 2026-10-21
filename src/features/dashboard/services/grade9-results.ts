import type { OnboardingOption } from '../../onboarding/services/model.ts'

export type AcademicHistoryRow = {
  id: string; user_id: string; school_name: string; academic_year: number | null
  grade: number | null; report_type: string | null; report_id: string | null; created_at: string
}
export type AcademicHistoryMark = { record_id: string; user_id: string; subject_id: string; mark: number | string }
export type HistorySubject = { subjectId: string; subject: string; percentage: number }
export type Grade9ReportHistory = AcademicHistoryRow & { results: HistorySubject[] }

export function reportPeriod(value: string | null | undefined) {
  if (value === 'final') return 'Final / year-end'
  if (/^term_[1-4]$/.test(value ?? '')) return `Term ${value!.slice(-1)}`
  return value === 'latest' ? 'Latest report' : 'Report period not recorded'
}

export function capsPerformance(mark: number) {
  const [level, label] = mark >= 80 ? [7, 'Outstanding achievement'] : mark >= 70 ? [6, 'Meritorious achievement'] : mark >= 60 ? [5, 'Substantial achievement'] : mark >= 50 ? [4, 'Adequate achievement'] : mark >= 40 ? [3, 'Moderate achievement'] : mark >= 30 ? [2, 'Elementary achievement'] : [1, 'Not achieved']
  return { level: Number(level), label: String(label) }
}

export function resultAverage(results: HistorySubject[]) {
  return results.length ? Math.round(results.reduce((sum, row) => sum + row.percentage, 0) / results.length * 10) / 10 : null
}

function periodOrder(period: string | null) {
  return period === 'final' ? 5 : /^term_[1-4]$/.test(period ?? '') ? Number(period!.slice(-1)) : null
}

// Upload time must not make a late-uploaded Term 1 report look newer than Term 2.
export function compareReports(a: AcademicHistoryRow, b: AcademicHistoryRow) {
  if (a.academic_year !== null && b.academic_year !== null && a.academic_year !== b.academic_year) return a.academic_year - b.academic_year
  if (a.grade !== null && b.grade !== null && a.grade !== b.grade) return a.grade - b.grade
  const ap = periodOrder(a.report_type), bp = periodOrder(b.report_type)
  if (ap !== null && bp !== null && ap !== bp) return ap - bp
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

export function buildReportHistory(owner: string, records: AcademicHistoryRow[], marks: AcademicHistoryMark[], options: OnboardingOption[]): Grade9ReportHistory[] {
  const labels = new Map(options.filter(option => option.category === 'subject').map(option => [option.id, option.label]))
  return records.filter(row => row.user_id === owner && [8, 9].includes(row.grade ?? 0)).map(row => ({
    ...row,
    results: marks.filter(mark => mark.user_id === owner && mark.record_id === row.id && Number.isFinite(Number(mark.mark)) && Number(mark.mark) >= 0 && Number(mark.mark) <= 100).map(mark => ({ subjectId: mark.subject_id, subject: labels.get(mark.subject_id) ?? 'Subject no longer in the catalogue', percentage: Number(mark.mark) })),
  })).sort((a, b) => compareReports(b, a))
}

function isKnownEarlier(a: AcademicHistoryRow, b: AcademicHistoryRow) {
  if (a.academic_year === null || b.academic_year === null) return false
  if (a.academic_year !== b.academic_year) return a.academic_year < b.academic_year
  if (a.grade !== null && b.grade !== null && a.grade !== b.grade) return a.grade < b.grade
  const ap = periodOrder(a.report_type), bp = periodOrder(b.report_type)
  return ap !== null && bp !== null && ap < bp
}

export function subjectProgress(current: Grade9ReportHistory, reports: Grade9ReportHistory[]) {
  return current.results.flatMap(result => {
    const previous = reports.filter(report => report.id !== current.id && report.user_id === current.user_id && isKnownEarlier(report, current) && report.results.some(row => row.subjectId === result.subjectId)).sort((a, b) => compareReports(b, a))[0]
    const mark = previous?.results.find(row => row.subjectId === result.subjectId)
    return previous && mark ? [{ ...result, previous, previousMark: mark.percentage, change: Math.round((result.percentage - mark.percentage) * 10) / 10 }] : []
  })
}

