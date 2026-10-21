import fs from 'node:fs'
// Browser fixtures are derived from the canonical SQL catalog, never a second
// production catalog or a React fallback dataset.
export const options = fs.readFileSync('supabase/migrations/20261016000400_via_onboarding_catalog.sql','utf8').split('\n').filter(line=>line.startsWith("('")).map(line=>{
  const values=[...line.matchAll(/'((?:''|[^'])*)'/g)].map(match=>match[1].replaceAll("''", "'"))
  return {id:values[0],category:values[1],label:values[2],description:values[3],icon:values[4],tone:values[5],sort_order:Number(line.match(/,(\d+)\)[,;]/)[1])}
})
export function fullAnswers() {
  return {current_id:'current-3',interest_ids:['interest-2'],personality_ids:['personality-1'],goal_ids:['study_goal-3'],preference_ids:[],institution_type_ids:['institution_type-1'],location_mode:'anywhere',province_ids:[],school_name:'Fixture School',academic_year:2026,results:[{subject_id:'subject-1',mark:64}],report_id:null}
}
