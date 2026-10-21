import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportHistory, capsPerformance, compareReports, reportPeriod, resultAverage, subjectProgress } from '../src/features/dashboard/services/grade9-results.ts'

const owner = 'learner-a'
const record = (id, changes = {}) => ({ id, user_id: owner, school_name: 'Actual School', academic_year: 2026, grade: 9, report_type: 'term_1', report_id: null, created_at: '2026-10-01T00:00:00Z', ...changes })
const mark = (record_id, subject_id, value, changes = {}) => ({ record_id, user_id: owner, subject_id, mark: value, ...changes })
const options = ['maths', 'english'].map(id => ({ id, category: 'subject', label: id === 'maths' ? 'Mathematics' : 'English' }))

test('history keeps only actual owner Grade 8/9 reports and valid owner marks, preserving zero', () => {
  const history = buildReportHistory(owner, [record('old', { grade: 8, academic_year: 2025 }), record('current'), record('other', { user_id: 'learner-b' }), record('future', { grade: 10 })], [mark('old', 'maths', '59'), mark('current', 'maths', 0), mark('current', 'english', 120), mark('current', 'english', 99, { user_id: 'learner-b' })], options)
  assert.deepEqual(history.map(row => row.id), ['current', 'old'])
  assert.deepEqual(history[0].results, [{ subjectId: 'maths', subject: 'Mathematics', percentage: 0 }])
  assert.equal(history[1].results[0].percentage, 59)
  assert.deepEqual(buildReportHistory(owner, [], [], options), [])
})

test('report chronology uses academic year and term before upload timestamp', () => {
  assert(compareReports(record('term1', { created_at: '2026-10-10' }), record('term2', { report_type: 'term_2', created_at: '2026-08-01' })) < 0)
  assert(compareReports(record('last-year', { academic_year: 2025, report_type: 'final' }), record('now')) < 0)
  assert.equal(reportPeriod('term_3'), 'Term 3')
  assert.equal(reportPeriod(null), 'Report period not recorded')
})

test('progress finds the latest known earlier report containing the same subject and reports percentage points', () => {
  const records = [record('term1', { created_at: '2026-10-10' }), record('term2', { report_type: 'term_2', created_at: '2026-07-01' }), record('term3', { report_type: 'term_3' }), record('same-term-edit', { report_type: 'term_3', created_at: '2026-11-01' })]
  const history = buildReportHistory(owner, records, [mark('term1', 'maths', 59), mark('term1', 'english', 70), mark('term2', 'english', 72), mark('term3', 'maths', 64), mark('term3', 'english', 69), mark('same-term-edit', 'maths', 99)], options)
  const changes = subjectProgress(history.find(row => row.id === 'term3'), history)
  assert.equal(changes[0].previous.id, 'term1')
  assert.equal(changes[0].change, 5)
  assert.equal(changes[1].previous.id, 'term2')
  assert.equal(changes[1].change, -3)
})

test('ambiguous report periods, missing subjects, same-term revisions and another owner do not invent progress', () => {
  const current = { ...record('current'), results: [{ subjectId: 'maths', subject: 'Mathematics', percentage: 64 }] }
  assert.deepEqual(subjectProgress(current, [current, { ...record('unknown', { report_type: 'latest' }), results: current.results }, { ...record('other', { user_id: 'learner-b', academic_year: 2025 }), results: current.results }]), [])
  assert.equal(resultAverage([]), null)
  assert.equal(resultAverage([{ subjectId: 'maths', subject: 'Mathematics', percentage: 0 }, { subjectId: 'english', subject: 'English', percentage: 61 }]), 30.5)
})

test('CAPS achievement levels honour every percentage boundary', () => {
  for (const [mark, expected] of [[0, 1], [29, 1], [30, 2], [39, 2], [40, 3], [49, 3], [50, 4], [59, 4], [60, 5], [69, 5], [70, 6], [79, 6], [80, 7], [100, 7]]) assert.equal(capsPerformance(mark).level, expected)
})
