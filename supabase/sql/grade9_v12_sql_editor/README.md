# Grade 9 v12: smaller SQL Editor files

Use these files instead of the 4.65 MB combined v12 bundle when SQL Editor
rejects its size. These are the same two released migrations, split into
complete transactions below 400 KB each; no schema or school data is changed.

1. Confirm v11 is applied in VIA's Supabase project.
2. Open and run each SQL file below separately, in order. Wait for success
   before running the next file. Do not paste all files into one query.
3. Run [the rollback-only verification](../../tests/grade9_onboarding.sql).
4. Reload VIA and verify the signed-in Grade 9 flow.

- [01_onboarding_schema.sql](01_onboarding_schema.sql)
- [02_school_directory.sql](02_school_directory.sql)
- [03_school_directory.sql](03_school_directory.sql)
- [04_school_directory.sql](04_school_directory.sql)
- [05_school_directory.sql](05_school_directory.sql)
- [06_school_directory.sql](06_school_directory.sql)
- [07_school_directory.sql](07_school_directory.sql)
- [08_school_directory.sql](08_school_directory.sql)
- [09_school_directory.sql](09_school_directory.sql)
- [10_school_directory.sql](10_school_directory.sql)
- [11_school_directory.sql](11_school_directory.sql)
- [12_school_directory.sql](12_school_directory.sql)
- [13_school_directory.sql](13_school_directory.sql)
- [14_school_directory.sql](14_school_directory.sql)

Apply the schema part once. Each school-directory part is one transaction;
if a part fails, fix the error and rerun that failed part before continuing.
If the combined v12 bundle already succeeded, do not apply these files.
The reported "Query is too large" rejection did not execute that query.
If execution status is uncertain, check it before rerunning the schema part.

Generate/check with `node scripts/build-grade9-sql-editor-parts.mjs [--check]`.
Local PostgreSQL verification is separate from applying SQL to live Supabase.
