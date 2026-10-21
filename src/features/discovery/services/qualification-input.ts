export function confirmedResults(rows:{subject_id:string;mark:string}[]) {
 if(!rows.length||rows.length>20||rows.some(row=>!row.subject_id||!row.mark.trim()||!Number.isFinite(Number(row.mark))||Number(row.mark)<0||Number(row.mark)>100))throw new Error('Choose a subject and enter a mark between 0 and 100 for every row.')
 if(new Set(rows.map(row=>row.subject_id)).size!==rows.length)throw new Error('List each subject only once.')
 return rows.map(row=>({subject_id:row.subject_id,mark:Number(row.mark)}))
}
