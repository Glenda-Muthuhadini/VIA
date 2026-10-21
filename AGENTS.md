# VIA project requirements

## Responsive design is part of the Definition of Done

These requirements apply to every VIA page, component, feature, modal, form,
dashboard, onboarding screen, and UI element. Responsiveness is mandatory and
must not depend on the user requesting it again.

- Plan every UI change for large and standard desktops, laptops, tablets,
  mobiles, and small mobile screens. A reference image establishes visual
  direction, not a fixed viewport or monitor resolution.
- Preserve hierarchy, readability, usability, spacing, visual quality, and
  functionality at every size. Adapt the composition instead of shrinking the
  desktop UI. Do not assume mouse-only interaction.
- On desktops, use available space with balanced whitespace and sensible maximum
  container widths; avoid both unnecessarily narrow content and excessive
  stretching on ultra-wide monitors.
- On laptops, especially at limited viewport heights, reduce vertical gaps and
  padding and reorganize content when appropriate. Aim to fit onboarding within
  100dvh where practical without making content excessively small.
- Adapt multi-column layouts at tablet widths, before mobile becomes cramped.
  Use flexible Grid/Flexbox layouts and column counts appropriate to the content.
- Design mobile layouts intentionally: stack content when appropriate, reduce
  unnecessary decoration, reposition floating UI, keep primary actions obvious,
  and maintain comfortable touch targets. Horizontal scrolling is appropriate
  only for deliberate components such as product rows, not the whole page.
- Prevent unwanted horizontal page scrolling. Keep content within its containers
  using flexible sizing, wrapping, and appropriate minimum widths. Constrain page
  width to 100% where appropriate; do not use overflow hiding to conceal broken
  layouts.
- Prefer responsive typography and spacing, using clamp(), rem, percentages,
  appropriate viewport units, and flexible gaps. Keep body text and labels readable.
- Make images responsive with suitable width, height, object-fit, and
  object-position. Adjust background positioning by breakpoint when necessary;
  keep important subjects such as people visible on mobile.
- Reserve absolute positioning for suitable decoration, floating cards,
  overlays, and hero effects. Structural layout should use Grid/Flexbox, and
  floating elements must reposition, resize, stack, or disappear appropriately.
- Prefer modern viewport units such as 100dvh for full-screen experiences. Never
  let fixed heights clip important content. Allow tablet/mobile scrolling when
  needed, including when the on-screen keyboard reduces available height.
- Forms must remain comfortable on mobile: readable labels, full-width fields
  where appropriate, adequate input and button touch sizes, and no overflow.
- Adapt navigation to the available width using an appropriate mobile pattern
  when needed. Desktop links must not overflow on smaller screens.
- Dialogs must fit small screens with responsive width and maximum height
  (for example, width: min(90vw, 600px) and max-height: 90dvh). Allow internal
  scrolling when needed; keep close controls and actions accessible.
- When modifying an existing page, audit its responsiveness and fix obvious
  problems within that scope. Preserve working designs and functionality; avoid
  unrelated redesigns.

## Required responsive verification

For every new or significantly modified page, check widths around 375, 430, 768,
1024, 1280, 1440, and 1920 CSS pixels. Test different heights as well as widths,
especially shorter laptop viewports. For forms, consider the mobile keyboard.

Before calling the UI complete, verify:

1. No unwanted horizontal scrolling, clipped text, or overlapping components.
2. Buttons remain accessible; cards stay within their containers.
3. Images crop appropriately and typography scales appropriately.
4. Forms remain usable and navigation adapts correctly.
5. Mobile and tablet layouts are intentional and desktop layouts stay balanced.
6. Functionality and important content remain accessible at every breakpoint
   and at different viewport heights.

Address failed checks before declaring completion. Build/type checks and source
inspection do not substitute for browser layout checks. If browser verification
is unavailable, explicitly report which responsive checks remain unverified;
do not claim they passed.

## SQL version history

Keep every version of VIA database SQL in this repository. Store schema changes
as new timestamped files under `supabase/migrations/`; never overwrite released
migrations. Keep numbered, paste-ready setup releases under `supabase/sql/`, with
an ordered migration list and setup instructions in `supabase/README.md`. Preserve
older releases when adding a new version. Never include credentials or user
passwords in SQL files. Keep database verification and access-policy tests alongside
the migrations, and distinguish locally checked SQL from SQL actually applied and
tested against the connected Supabase project.
