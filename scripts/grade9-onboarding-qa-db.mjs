import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
export async function createGrade9QaDatabase(){
 const {PGlite}=await import(pathToFileURL(path.resolve('node_modules/.tmp/via-sql-validation/node_modules/@electric-sql/pglite/dist/index.js')).href)
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,aud text,role text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema auth,storage to anon,authenticated,service_role;grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`)
 for(const name of ['auth_setup_v1','onboarding_setup_v2','adaptive_onboarding_setup_v3','public_discovery_setup_v4','public_qualification_setup_v6','connected_discovery_setup_v7','connected_discovery_links_v8','institution_explorer_setup_v9','demo_institution_dataset_v10','complete_onboarding_setup_v11'])await db.exec(await fs.readFile(`supabase/sql/${name}.sql`,'utf8'))
 const id='75000000-0000-4000-8000-000000000001',legacyId='75000000-0000-4000-8000-000000000002'
 await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'grade9-browser@example.invalid','{"first_name":"Learner","last_name":"Fixture"}'),($2,'grade9-legacy@example.invalid','{"first_name":"Existing","last_name":"Learner"}')`,[id,legacyId])
 await db.query(`update public.via_profiles set education_stage='grade_9',education_stage_confirmation_required=false where id=$1`,[legacyId])
 await db.query(`insert into public.via_onboarding(user_id,flow_version,journey_answers,answers,current_step,answered_steps,completed_at) values($1,4,via_private.journey_defaults()||' {"school_name":"Existing school","report_grade":9,"report_type":"final","academic_year":2025,"school_subject_ids":["subject-1"],"results":[{"subject_id":"subject-1","mark":64}]} '::jsonb,'{"legacy":"keep"}','ready',array['welcome','current','results','interests','career-interests'],'2026-10-01T10:00:00Z')`,[legacyId])
 await db.exec(await fs.readFile('supabase/sql/grade9_onboarding_setup_v12.sql','utf8'))
 let queue=Promise.resolve()
 const query=(userId,sql,params=[])=>{
  const request=queue.catch(()=>{}).then(async()=>{
   await db.exec('begin;')
   try{await db.query(`select set_config('request.jwt.claims',$1,true)`,[JSON.stringify({sub:userId,role:'authenticated'})]);await db.exec('set local role authenticated;');const result=await db.query(sql,params);await db.exec('commit;');return result.rows}
   catch(error){await db.exec('rollback;');throw error}
  });queue=request;return request
 }
 return {db,id,legacyId,query,flush:()=>queue.catch(()=>{})}
}
