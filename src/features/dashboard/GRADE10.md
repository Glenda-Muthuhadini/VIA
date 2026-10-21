# Grade 10 dashboard

Grade 10 has a dedicated eight-section view focused on the subjects the learner
already takes: academic profile, subject pathways, programme exploration,
institution-specific subject comparisons, improvements, interests, careers and
next steps. The header and sidebar retain the shared dashboard design. Funding,
applications, APS scores and admission match percentages are not promoted in
the Grade 10 overview.

## Data and guidance

- Name and stage come from the authenticated profile. Subjects, marks and
  interests use the existing onboarding answers and catalogue labels.
- Selected subjects and confirmed Grade 10 result subjects establish what the
  learner takes. Results from previous or unknown grades remain labelled in the
  academic profile but cannot produce current Grade 10 comparisons or targets.
- Academic planning labels: Strong >=70%, Doing well 60–69%, Keep working
  50–59%, Needs attention <50%. The summary includes subjects below 60%.
- Broad subject-pathway illustrations explain connections without claiming
  admission eligibility. Mathematics and Mathematical Literacy remain distinct.
- Programme suggestions use published, non-demo catalogue offerings. Subject
  connections and saved interests/career interests order the suggestions.
  Qualifications, durations and careers are shown only from catalogue data.
  Missing catalogue data never generates a fake programme.
- The checker selects one programme group, then one institution/campus offering.
  Its exact structured requirements supply the displayed thresholds. Thresholds
  are not extracted or guessed from prose. Unknown minima, absent subjects,
  missing marks and recommended requirements have distinct honest states.
- Alternative subjects remain alternatives. Generic English can match an English
  HL/FAL result; an explicit language level cannot use a different language level.
- Targets use a higher stored compulsory minimum from a connected offering and
  identify that programme/institution. The nearest available higher target per
  subject is shown. There is no default target such as 60%, and targets do not
  imply that all other requirements are met.

## Interactions

Programme cards open the existing programme details dialog, including institution
accordions. The shared heart control saves separately from opening the card.
Card and dialog state are shared; persisted saves refresh the dashboard's Saved
Programmes panel. Save errors remain visible, and unavailable saved-state data
offers a retry rather than presenting a false unsaved state.

The details dialog can return to the Grade 10 mark comparison. Compare
Institutions opens the selected programme in the existing explorer. Pathway and
career links use the programme search query. Results, subjects and interests
edits use existing onboarding screens and persistence. Next-step checkmarks are
based on actual saved subjects and confirmed Grade 10 marks; exploration steps
do not pretend to be completed.

No schema migration or remote database changes are required. All existing SQL
versions are preserved.

## Verification

```text
npm run test:grade10
npm run test:grade10:browser
npm run test:grade9
npm run test:grade9:browser
npm run test:dashboard
npm run build
npm run lint
```

The Grade 10 browser runner intercepts Supabase requests with fixtures, including
save writes. It does not create real users or write to the connected database.
It checks widths 375, 430, 768, 1024, 1280, 1440 and 1920 plus 375×480 and
1280×650. Checks include overflow/control bounds, touch sizes, programme and
results dialogs, expanded institution tiles, whole-card clicks, heart separation,
card/modal/saved-panel synchronisation, different institution thresholds, previous
grade marks, Mathematical Literacy, missing subjects/marks, empty catalogue,
failure/retry and links to existing screens. Screenshots are stored in
`node_modules/.tmp/via-grade10-qa`.
