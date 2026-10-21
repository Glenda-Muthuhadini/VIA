import fs from 'node:fs'
import assert from 'node:assert/strict'

// Alternative packaging of the released v12 migrations, not a new migration.
// Split only at the seed's complete INSERT statements, never inside SQL values.
const directory = 'supabase/sql/grade9_v12_sql_editor'
const schemaPath = 'supabase/migrations/20261021001800_grade9_confirmed_onboarding.sql'
const seed = fs.readFileSync('supabase/migrations/20261021001900_grade9_school_directory.sql', 'utf8')
const start = seed.indexOf('insert into public.via_schools')
const end = seed.lastIndexOf('commit;')
assert(start > 0 && end > start)
const body = seed.slice(start, end).trim()
const statements = body.match(/insert into public\.via_schools\(id,name,province,source_url,source_year\) values\n[\s\S]*?;(?=\s*(?:insert into public\.via_schools|$))/g)
assert(statements?.length)
assert.equal(statements.join('\n').replace(/\s+/g, ' '), body.replace(/\s+/g, ' '))
const files = [['01_onboarding_schema.sql', '-- Apply ONCE after v11. Alternative to the combined v12 bundle.\n' + fs.readFileSync(schemaPath, 'utf8')]]
let batch = []
const flush = () => {
  if (!batch.length) return
  const number = String(files.length + 1).padStart(2, '0')
  files.push([`${number}_school_directory.sql`, `-- VIA v12 SQL Editor part ${number}. Run after the preceding part.\n-- Original school seed INSERT statements, unchanged.\nbegin;\n${batch.join('\n')}\ncommit;\n`])
  batch = []
}
for (const statement of statements) {
  if (Buffer.byteLength([...batch, statement].join('\n')) > 390_000) flush()
  batch.push(statement)
}
flush()
assert(files.every(([, content]) => Buffer.byteLength(content) < 400_000))
fs.mkdirSync(directory, { recursive: true })
for (const [name, content] of files) {
  const target = `${directory}/${name}`
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), content, target)
  else {
    if (fs.existsSync(target)) assert.equal(fs.readFileSync(target, 'utf8'), content, 'Existing SQL parts must stay unchanged')
    fs.writeFileSync(target, content)
  }
}
const instructions = `# Grade 9 v12: smaller SQL Editor files

Use these files instead of the 4.65 MB combined v12 bundle when SQL Editor
rejects its size. These are the same two released migrations, split into
complete transactions below 400 KB each; no schema or school data is changed.

1. Confirm v11 is applied in VIA's Supabase project.
2. Open and run each SQL file below separately, in order. Wait for success
   before running the next file. Do not paste all files into one query.
3. Run [the rollback-only verification](../../tests/grade9_onboarding.sql).
4. Reload VIA and verify the signed-in Grade 9 flow.

${files.map(([name]) => `- [${name}](${name})`).join('\n')}

Apply the schema part once. Each school-directory part is one transaction;
if a part fails, fix the error and rerun that failed part before continuing.
If the combined v12 bundle already succeeded, do not apply these files.
The reported "Query is too large" rejection did not execute that query.
If execution status is uncertain, check it before rerunning the schema part.

Generate/check with \`node scripts/build-grade9-sql-editor-parts.mjs [--check]\`.
Local PostgreSQL verification is separate from applying SQL to live Supabase.
`
if (!process.argv.includes('--check')) fs.writeFileSync(`${directory}/README.md`, instructions)
else assert.equal(fs.readFileSync(`${directory}/README.md`, 'utf8'), instructions)
console.log(`PASS: ${files.length} ordered SQL Editor files, each below 400 KB; original schema and all ${statements.length} seed INSERT statements preserved.`)
