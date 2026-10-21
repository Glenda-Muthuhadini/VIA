// Focused disposable PostgreSQL test for the demo seed. No live writes.
import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(path.resolve('node_modules/.tmp/via-sql-validation/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite()
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,aud text,role text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage to anon,authenticated,service_role;
 grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`)

 for(const name of ['auth_setup_v1','onboarding_setup_v2','adaptive_onboarding_setup_v3','public_discovery_setup_v4','public_qualification_setup_v6','connected_discovery_setup_v7','connected_discovery_links_v8','institution_explorer_setup_v9','demo_institution_dataset_v10'])await db.exec(await fs.readFile('supabase/sql/'+name+'.sql','utf8'))
 const result=await db.exec(await fs.readFile('supabase/tests/demo_catalogue.sql','utf8'));console.log(JSON.stringify(result.at(-1)?.rows))
}catch(error){console.error(error.message,error.where??'',error.detail??'');process.exitCode=1}finally{await db.close()}
