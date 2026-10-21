import fs from 'node:fs'

// Keep released migrations immutable. A future change gets a new dated file;
// update this ordered list and create a new numbered release bundle.
const authMigrations = [
  'supabase/migrations/20261016000100_via_auth_profiles.sql',
  'supabase/migrations/20261016000200_via_auth_profile_bootstrap.sql',
]
const authBundle = '-- VIA AUTH SETUP v1: paste this entire file into Supabase SQL Editor.\n'
  + '-- Contains migrations 20261016000100 and 20261016000200, in order.\n'
  + '-- Run as the project SQL Editor postgres role. No credentials belong in SQL.\n\n'
  + authMigrations.map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file, 'utf8')}`).join('\n\n')
const onboardingMigrations = [
  'supabase/migrations/20261016000300_via_onboarding.sql',
  'supabase/migrations/20261016000400_via_onboarding_catalog.sql',
]
const onboardingBundle = '-- VIA ONBOARDING SETUP v2: paste this entire file into Supabase SQL Editor.\n'
  + '-- Upgrade: requires auth_setup_v1.sql to have been applied already.\n'
  + '-- Apply this version ONCE. Keep the existing auth v1 release unchanged.\n\n'
  + 'begin;\n' + onboardingMigrations.map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file, 'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm, '')}`).join('\n\n') + '\ncommit;\n'
const adaptiveBundle = '-- VIA ADAPTIVE ONBOARDING v3. Apply ONCE after onboarding_setup_v2.sql.\n-- Preserves legacy answers, users, private reports and completion history.\nbegin;\n'
  + ['supabase/migrations/20261016000500_adaptive_onboarding_foundation.sql','supabase/migrations/20261016000600_grade9_catalog.sql'].map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file, 'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm, '')}`).join('\n\n') + '\ncommit;\n'
fs.mkdirSync('supabase/sql', { recursive: true })
const journeyOutput='supabase/sql/complete_onboarding_setup_v11.sql'
const journeyMigration='supabase/migrations/20261020001700_complete_journey_onboarding.sql'
const journeyBundle='-- VIA COMPLETE ONBOARDING v11. Apply ONCE after v10.\n-- Preserves legacy answers, reports, academic records and stage history.\n-- SOURCE: '+journeyMigration+'\n'+fs.readFileSync(journeyMigration,'utf8')
if(process.argv.includes('--check')){
  if(!fs.existsSync(journeyOutput)||fs.readFileSync(journeyOutput,'utf8')!==journeyBundle){console.error('v11 bundle differs from its migration.');process.exitCode=1}else console.log(journeyOutput+' matches its versioned migration.')
}else{
  if(fs.existsSync(journeyOutput)&&fs.readFileSync(journeyOutput,'utf8')!==journeyBundle)throw Error('Released SQL bundles are immutable. Create a new release.')
  fs.writeFileSync(journeyOutput,journeyBundle)
}
const discoveryBundle = '-- VIA PUBLIC DISCOVERY v4. Apply ONCE after adaptive onboarding v3.\n-- Public catalogue + owner-only saved opportunities; no auth/onboarding changes.\nbegin;\n'
  + ['supabase/migrations/20261016000700_public_discovery.sql','supabase/migrations/20261016000800_public_discovery_seed.sql'].map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file,'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm,'')}`).join('\n\n')+'\ncommit;\n'
const qualificationBundle = '-- VIA DISCOVERY + QUALIFICATION v5. Apply ONCE after public_discovery_setup_v4.sql.\n-- Preserves existing users, answers, reports and saved opportunity IDs.\nbegin;\n'
  + ['supabase/migrations/20261017000900_public_qualification.sql','supabase/migrations/20261017001000_verified_discovery_catalogue.sql'].map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file,'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm,'')}`).join('\n\n')+'\ncommit;\n'
const qualificationFixedBundle = '-- VIA DISCOVERY + QUALIFICATION v6. Apply ONCE after public_discovery_setup_v4.sql.\n-- Replaces the FAILED v5 release; do not run v5 first. Its failed transaction did not apply.\n-- Preserves existing users, answers, reports and saved opportunity IDs.\nbegin;\n'
  + ['supabase/migrations/20261017000900_public_qualification.sql','supabase/migrations/20261017001100_verified_discovery_catalogue_fix.sql'].map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file,'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm,'')}`).join('\n\n')+'\ncommit;\n'
const connectedBundle = '-- VIA CONNECTED DISCOVERY v7. Apply ONCE after public_qualification_setup_v6.sql.\n-- New grade-aware read RPC, relational links and source-backed catalogue additions.\n-- No auth credentials, saved marks, existing users or opportunity IDs are changed.\nbegin;\n'
  + ['supabase/migrations/20261018001200_connected_discovery.sql','supabase/migrations/20261018001300_connected_catalogue.sql'].map(file => `-- SOURCE: ${file}\n${fs.readFileSync(file,'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm,'')}`).join('\n\n')+'\ncommit;\n'
const sourceFixBundle='-- VIA CONNECTED DISCOVERY v8: apply after connected_discovery_setup_v7.sql.\n-- Updates two moved TUT source destinations; no scoring or user-data changes.\n\n-- SOURCE: supabase/migrations/20261018001400_tut_source_links.sql\n'+fs.readFileSync('supabase/migrations/20261018001400_tut_source_links.sql','utf8')
const institutionBundle='-- VIA INSTITUTION EXPLORER v9: apply ONCE after v8.\n-- Academic units, compact public browsing and official application destinations.\n\n-- SOURCE: supabase/migrations/20261018001500_institution_faculties.sql\n'+fs.readFileSync('supabase/migrations/20261018001500_institution_faculties.sql','utf8')
const demoBundle='-- VIA HACKATHON DEMO v10. Apply ONCE after v9. Synthetic data is explicitly marked.\n\n-- SOURCE: supabase/migrations/20261018001600_hackathon_demo_catalogue.sql\n'+fs.readFileSync('supabase/migrations/20261018001600_hackathon_demo_catalogue.sql','utf8')
for (const [output, bundle] of [['supabase/sql/auth_setup_v1.sql', authBundle], ['supabase/sql/onboarding_setup_v2.sql', onboardingBundle], ['supabase/sql/adaptive_onboarding_setup_v3.sql',adaptiveBundle], ['supabase/sql/public_discovery_setup_v4.sql',discoveryBundle], ['supabase/sql/public_qualification_setup_v5.sql',qualificationBundle],['supabase/sql/public_qualification_setup_v6.sql',qualificationFixedBundle],['supabase/sql/connected_discovery_setup_v7.sql',connectedBundle],['supabase/sql/connected_discovery_links_v8.sql',sourceFixBundle],['supabase/sql/institution_explorer_setup_v9.sql',institutionBundle],['supabase/sql/demo_institution_dataset_v10.sql',demoBundle]]) {
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== bundle) {
    console.error('SQL bundle differs from the versioned migrations. Run npm run sql:build.')
    process.exitCode = 1
  } else console.log(`${output} matches its versioned migrations.`)
} else {
  if (fs.existsSync(output) && fs.readFileSync(output, 'utf8') !== bundle) {
    throw new Error('Released SQL bundles are immutable. Create a new migration and numbered release instead of overwriting v1.')
  }
  fs.writeFileSync(output, bundle)
  console.log(`Created ${output}`)
}
}

const grade9Output='supabase/sql/grade9_onboarding_setup_v12.sql'
const grade9Migrations=['supabase/migrations/20261021001800_grade9_confirmed_onboarding.sql','supabase/migrations/20261021001900_grade9_school_directory.sql']
const grade9Bundle='-- VIA GRADE 9 ONBOARDING v12. Apply ONCE after complete onboarding v11.\n-- Grade 9 only: real report extraction/review, private drafts, explicit confirmation and DBE school directory.\n-- Other stage flows and dashboards remain unchanged.\nbegin;\n'+grade9Migrations.map(file=>'-- SOURCE: '+file+'\n'+fs.readFileSync(file,'utf8').replace(/^begin;\r?\n|^commit;\r?$/gm,'')).join('\n\n')+'\ncommit;\n'
if(process.argv.includes('--check')){
 if(!fs.existsSync(grade9Output)||fs.readFileSync(grade9Output,'utf8')!==grade9Bundle){console.error('v12 differs from its versioned migrations.');process.exitCode=1}else console.log(grade9Output+' matches its versioned migrations.')
}else{
 if(fs.existsSync(grade9Output)&&fs.readFileSync(grade9Output,'utf8')!==grade9Bundle)throw Error('Released SQL bundles are immutable. Create a new release.')
 fs.writeFileSync(grade9Output,grade9Bundle)
}

const grade9DashboardOutput='supabase/sql/grade9_dashboard_setup_v13.sql'
const grade9DashboardMigration='supabase/migrations/20261021211512_grade9_dashboard_subject_plan.sql'
const grade9DashboardBundle='-- VIA GRADE 9 DASHBOARD v13. Apply ONCE after Grade 9 onboarding v12.\n-- Private subject plans and actual planning actions; existing learner/onboarding/academic data is preserved.\n-- SOURCE: '+grade9DashboardMigration+'\n'+fs.readFileSync(grade9DashboardMigration,'utf8')
if(process.argv.includes('--check')){
 if(!fs.existsSync(grade9DashboardOutput)||fs.readFileSync(grade9DashboardOutput,'utf8')!==grade9DashboardBundle){console.error('v13 differs from its versioned migration.');process.exitCode=1}else console.log(grade9DashboardOutput+' matches its versioned migration.')
}else{
 if(fs.existsSync(grade9DashboardOutput)&&fs.readFileSync(grade9DashboardOutput,'utf8')!==grade9DashboardBundle)throw Error('Released SQL bundles are immutable. Create a new release.')
 fs.writeFileSync(grade9DashboardOutput,grade9DashboardBundle)
}
