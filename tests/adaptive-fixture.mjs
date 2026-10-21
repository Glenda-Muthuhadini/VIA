import fs from 'node:fs'
import { options as legacy } from './onboarding-fixture.mjs'
export const options = [...legacy.map(option => ({...option,education_stages:['interest','personality'].includes(option.category)?['grade_10','grade_11','grade_12','post_matric','tertiary','graduate']:null})),
 ...fs.readFileSync('supabase/migrations/20261016000600_grade9_catalog.sql','utf8').split('\n').filter(line=>line.startsWith("('")).map(line=>{
 const values=[...line.matchAll(/'((?:''|[^'])*)'/g)].map(match=>match[1].replaceAll("''", "'"))
 return {id:values[0],category:values[1],label:values[2],description:values[3],icon:values[4],tone:values[5],sort_order:Number(line.match(/,(\d+),array/)[1]),education_stages:['grade_9']}
 })]
