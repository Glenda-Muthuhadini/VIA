begin;
-- Existing catalog entries remain available to legacy flows, never deleted.
update public.via_onboarding_options set education_stages=array['grade_10','grade_11','grade_12','post_matric','tertiary','graduate'] where category in ('interest','personality');
insert into public.via_onboarding_options(id,category,label,description,icon,tone,sort_order,education_stages) values
('g9-interest-1','interest','Technology & Computing','', 'BookOpen','emerald',1,array['grade_9']),
('g9-interest-2','interest','Engineering & Building','', 'BookOpen','emerald',2,array['grade_9']),
('g9-interest-3','interest','Business & Money','', 'BookOpen','emerald',3,array['grade_9']),
('g9-interest-4','interest','Health & People','', 'BookOpen','emerald',4,array['grade_9']),
('g9-interest-5','interest','Science & Nature','', 'BookOpen','emerald',5,array['grade_9']),
('g9-interest-6','interest','Law & Society','', 'BookOpen','emerald',6,array['grade_9']),
('g9-interest-7','interest','Creative & Design','', 'BookOpen','emerald',7,array['grade_9']),
('g9-interest-8','interest','Teaching & Education','', 'BookOpen','emerald',8,array['grade_9']),
('g9-interest-9','interest','People & Communities','', 'BookOpen','emerald',9,array['grade_9']),
('g9-personality-1','personality','Solving problems','', 'BookOpen','emerald',1,array['grade_9']),
('g9-personality-2','personality','Working with numbers','', 'BookOpen','emerald',2,array['grade_9']),
('g9-personality-3','personality','Building or making things','', 'BookOpen','emerald',3,array['grade_9']),
('g9-personality-4','personality','Helping people','', 'BookOpen','emerald',4,array['grade_9']),
('g9-personality-5','personality','Using computers','', 'BookOpen','emerald',5,array['grade_9']),
('g9-personality-6','personality','Designing or creating','', 'BookOpen','emerald',6,array['grade_9']),
('g9-personality-7','personality','Understanding how things work','', 'BookOpen','emerald',7,array['grade_9']),
('g9-personality-8','personality','Leading or organising','', 'BookOpen','emerald',8,array['grade_9']),
('g9-personality-9','personality','Writing or communicating','', 'BookOpen','emerald',9,array['grade_9']),
('g9-future_interest-1','future_interest','Engineering','', 'BookOpen','emerald',1,array['grade_9']),
('g9-future_interest-2','future_interest','Computer Science & Technology','', 'BookOpen','emerald',2,array['grade_9']),
('g9-future_interest-3','future_interest','Health & Medicine','', 'BookOpen','emerald',3,array['grade_9']),
('g9-future_interest-4','future_interest','Business','', 'BookOpen','emerald',4,array['grade_9']),
('g9-future_interest-5','future_interest','Accounting & Finance','', 'BookOpen','emerald',5,array['grade_9']),
('g9-future_interest-6','future_interest','Law','', 'BookOpen','emerald',6,array['grade_9']),
('g9-future_interest-7','future_interest','Architecture & Built Environment','', 'BookOpen','emerald',7,array['grade_9']),
('g9-future_interest-8','future_interest','Education','', 'BookOpen','emerald',8,array['grade_9']),
('g9-future_interest-9','future_interest','Science','', 'BookOpen','emerald',9,array['grade_9']),
('g9-future_interest-10','future_interest','Creative fields','', 'BookOpen','emerald',10,array['grade_9']);
commit;
