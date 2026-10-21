import { Plus, Trash2 } from 'lucide-react'

export type ResultRow = { key: string; subject_id: string; mark: string }
export function SubjectResultsEditor({ rows, onChange, subjects, disabled=false }: {
 rows: ResultRow[]; onChange: (rows:ResultRow[])=>void; subjects:{id:string;label:string}[]; disabled?:boolean
}) {
 return <div className="via-results-editor">
  <div className="via-manual-result-rows">{rows.map((row,index)=><div className="via-manual-result-row" key={row.key}>
   <label>Subject<select aria-label={`Subject ${index+1}`} disabled={disabled} value={row.subject_id} onChange={event=>onChange(rows.map(item=>item.key===row.key?{...item,subject_id:event.target.value}:item))}><option value="">Choose a subject</option>{subjects.map(subject=><option key={subject.id} value={subject.id}>{subject.label}</option>)}</select></label>
   <label>Mark (%)<input aria-label={`Mark ${index+1}`} disabled={disabled} type="number" inputMode="decimal" min={0} max={100} step="0.1" value={row.mark} onChange={event=>onChange(rows.map(item=>item.key===row.key?{...item,mark:event.target.value}:item))}/></label>
   <button type="button" disabled={disabled} aria-label={`Remove subject ${index+1}`} onClick={()=>onChange(rows.filter(item=>item.key!==row.key))}><Trash2 size={19}/></button>
  </div>)}</div>
  <button className="via-manual-add" type="button" disabled={rows.length>=20||disabled} onClick={()=>onChange([...rows,{key:crypto.randomUUID(),subject_id:'',mark:''}])}><Plus size={18}/>Add subject</button>
 </div>
}
