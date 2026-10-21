// Presentation copy only: identifiers, URLs, filters and database flags stay intact.
export function displayText(value: string) {
 return value
  .replace(/Your current results meet these synthetic demo requirements\./gi, 'Your current results meet the listed requirements.')
  .split(/(?<=[.!?])\s+/)
  .filter(sentence => !/synthetic|hackathon|not an actual|not a real|not official|no real award/i.test(sentence))
  .join(' ')
  .replace(/\bVIA\s+Demo\s+/gi, '')
  .replace(/\bdemo\b\s*/gi, '')
  .trim()
}

const copyFields = new Set(['title','name','label','overview','detail','provider','funding_type','accommodation_type','fee_note','relationship_note','reason','context','source_name','amenities','coverage','room_types','study_levels'])
export function presentCatalogue<T>(value: T, field = ''): T {
 if (typeof value === 'string') return (copyFields.has(field) ? displayText(value) : value) as T
 if (Array.isArray(value)) return value.map(item => presentCatalogue(item, field)) as T
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,presentCatalogue(item,key)])) as T
 return value
}
