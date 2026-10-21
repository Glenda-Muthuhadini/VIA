// Conservative report parsing: ambiguous columns and conflicting values stay blank.
export type ReportSubject = { id: string; label: string }
export type ResultsGrade = 9 | 10 | 11 | 12
export type ExtractedResult = { subject_id: string; mark: string }
const normalise = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9%.,]+/g, ' ').replace(/\s+/g, ' ').trim()
function aliases(label: string) {
  const name = normalise(label)
  const values = [name, name.replace('home language', 'hl'), name.replace('first additional language', 'fal')]
  const short: Record<string, string[]> = {
    mathematics: ['maths'], 'mathematical literacy': ['maths literacy', 'mathematics literacy', 'maths lit'],
    'physical sciences': ['physical science', 'physics and chemistry'], 'life sciences': ['life science'],
    'life orientation': ['life orient', 'lo'], 'computer applications technology': ['cat'],
    'information technology': ['it'], 'engineering graphics and design': ['egd'],
  }
  return [...new Set([...values, ...(short[name] ?? [])])]
}
export function parseReportResults(text: string, subjects: ReportSubject[]) {
  const names = subjects.flatMap(subject => aliases(subject.label).map(alias => ({ ...subject, alias }))).sort((a, b) => b.alias.length - a.alias.length)
  const results = new Map<string, string>()
  let needsReview = false
  const markHeader = /mark|percentage|percent|%/i.test(text)
  for (const raw of text.split(/\r?\n/)) {
    const line = ` ${normalise(raw)} `
    const matches = names.filter(subject => line.includes(` ${subject.alias} `))
    const match = matches[0]
    if (!match) continue
    // Do not read two subjects on one OCR line as a single result.
    if (matches.some(other => other.id !== match.id && !match.alias.includes(other.alias))) { needsReview = true; continue }
    const suffix = line.slice(line.indexOf(` ${match.alias} `) + match.alias.length + 2)
    const percentages = [...suffix.matchAll(/(?<![\d.,])(?:100|[0-9]{1,2})(?:[.,]\d{1,2})?\s*%/g)].map(value => value[0].replace('%', '').trim().replace(',', '.'))
    const numbers = [...suffix.matchAll(/(?<![\d.,])\d+(?:[.,]\d+)?(?![\d.,])/g)].map(value => Number(value[0].replace(',', '.')))
    let mark = ''
    if (percentages.length === 1) mark = percentages[0]
    else if (!percentages.length && numbers.length === 1 && numbers[0] <= 100 && (numbers[0] > 7 || markHeader) && !/level|code|absent/i.test(suffix)) mark = String(numbers[0])
    if (results.has(match.id) && results.get(match.id) !== mark) mark = ''
    if (!mark) needsReview = true
    results.set(match.id, mark)
  }
  const grades = [...new Set([...text.matchAll(/\b(?:grade|gr\.?)[\s:.-]*(9|10|11|12)\b/gi)].map(match => Number(match[1])))]
  const gradeRange = /\b(?:grade|gr\.?)[\s:.-]*(?:9|10|11|12)\s*(?:\/|–|-|or|and)\s*(?:9|10|11|12)\b/i.test(text)
  return { results: [...results].map(([subject_id, mark]) => ({ subject_id, mark })), grade: grades.length === 1&&!gradeRange ? grades[0] as ResultsGrade : null, needsReview }
}

// Infer only a conservative academic bachelor threshold from a complete NSC set.
// Never treat a grade selection alone as proof of a bachelor pass.
// DBE: https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/tabid/338/Default.aspx
export function meetsBachelorAcademicMinimum(results: { subject_id: string; mark: number }[], subjects: ReportSubject[]) {
  const labels = new Map(subjects.map(subject => [subject.id, normalise(subject.label)]))
  const academic = results.filter(result => labels.get(result.subject_id) !== 'life orientation')
  return results.length === 7 && academic.length === 6 && results.every(result => result.mark >= 30)
    && academic.filter(result => result.mark >= 50).length >= 4
    && academic.filter(result => /home language|first additional language/.test(labels.get(result.subject_id) ?? '')).length >= 2
    && academic.some(result => labels.get(result.subject_id)?.includes('home language') && result.mark >= 40)
}
