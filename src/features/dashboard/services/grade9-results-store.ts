import { supabase } from '../../../services/supabase'
import type { OnboardingOption } from '../../onboarding/services/model'
import { buildReportHistory, type AcademicHistoryMark, type AcademicHistoryRow, type Grade9ReportHistory } from './grade9-results'

export async function loadGrade9ReportHistory(userId: string, options: OnboardingOption[], signal: AbortSignal): Promise<Grade9ReportHistory[]> {
  const records: AcademicHistoryRow[] = []
  // History is fetched only on My Results; Home does not wait for this source.
  for (let start = 0; ; start += 200) {
    const result = await supabase.from('via_academic_records').select('id,user_id,school_name,academic_year,grade,report_type,report_id,created_at').eq('user_id', userId).in('grade', [8, 9]).order('created_at', { ascending: false }).order('id').range(start, start + 199).abortSignal(signal)
    if (result.error) throw result.error
    records.push(...result.data as AcademicHistoryRow[])
    if (result.data.length < 200) break
  }
  const marks: AcademicHistoryMark[] = []
  for (let index = 0; index < records.length; index += 100) {
    const ids = records.slice(index, index + 100).map(record => record.id)
    for (let start = 0; ; start += 500) {
      const result = await supabase.from('via_academic_results').select('record_id,user_id,subject_id,mark').eq('user_id', userId).in('record_id', ids).order('record_id').order('subject_id').range(start, start + 499).abortSignal(signal)
      if (result.error) throw result.error
      marks.push(...result.data as AcademicHistoryMark[])
      if (result.data.length < 500) break
    }
  }
  return buildReportHistory(userId, records, marks, options)
}
