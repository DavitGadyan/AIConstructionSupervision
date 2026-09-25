# Layout inventory - ORDI - AI Productivity SaaS, Landing Page + Dashboard -> control.io

Fill this in **before** writing any component. Open every file listed under
"Screens" and record what you see, top to bottom. The images are the template;
this file is the contract you build against. Rows here become components; a
component with no row here is an invention, and inventions are how a re-skin
drifts back into a generic page.

## Template tokens (read off the images)

| | Template (from the image) | Yours |
|---|---|---|
| mode | light | light |
| ground | warm sand/amber vertical gradient (#E9DCC3 -> #F0C27A) | cool concrete gradient #E4E8EA -> #D6DDE0 |
| surface | white inner cards | #FFFFFF inner cards |
| glass | cream translucent cards (~55% white) | rgba(255,255,255,.55) + BlurView (iOS/web) |
| ink | near-black #2A2622 | #1C2226 (muted #5F666B) |
| accent | orange #F26B2B | lagoon blue #0A8FA3 (accentSoft 12%) |
| accent2 | amber #C86D40 | metal grey #6B737A |
| status | - | danger #C2412D, warn #B7791F, ok #2F855A |
| display font | Manrope | Space Grotesk 500/600/700 |
| body font | Manrope | Inter 400/500/600/700 |
| corner radius | ~28 card / ~16 inner / ~8 pill | card 28 / inner 16 / pill 8 / btn 14 |
| nav pattern | floating glass pill of 5 rounded-square icon buttons, active filled orange | same, active filled lagoon |
| card style | glass card, title + subtitle, square white "↗" top-right | same |

Brief overrides applied: every "Yours" colour and both fonts differ from the template - this is a real re-skin.

If the "Yours" column matches what you read off the image, the brief had no
overrides for it - say so to the user, because a re-skin that keeps the
template's brand colour is not a re-skin.

## Screens

### Screen 1 - `design-reference/image_original1.png` (1600x1200, viewport)
_one screen - read it for composition and how much air the headline gets_

| # | Region (top -> bottom) | Component type | Contents (copy, counts, media) | Layout (cols, alignment) | States / motion |
|---|---|---|---|---|---|
| 1 | Landing page | marketing hero | (web only) | - | - |

Not reproduced on the phone: its hero role is taken by the onboarding screen (Screen 3, row 1-3).

### Screen 2 - `design-reference/image_original2.png` (1600x1200, viewport)
_one screen - read it for composition and how much air the headline gets_

| # | Region (top -> bottom) | Component type | Contents (copy, counts, media) | Layout (cols, alignment) | States / motion |
|---|---|---|---|---|---|
| 1 | Top bar | logo, search field, waveform, bell, avatar, Menu | "ORDI" | space-between | - |
| 2 | Time Analytics | glass strip with big number + segmented bars | 34h 14m, 63/18/12/7% | row | - |
| 3 | AI Smart Schedule | glass card, horizontal time grid | task chips with avatars | grid | - |
| 4 | Team Tasks Overview | solid orange card, 2 translucent sub-cards | title, 2-line text, "8 Tasks" + "75%" pills, avatars | stack | - |
| 5 | Today's Tasks | glass card, table rows as white pills | task/priority/status/time, "Add New Task" | table | - |
| 6 | Time Tracker | glass card, ring | "06:14 HOURS", Today chip, pause/stop/+ | ring right, controls left | - |

### Screen 3 - `design-reference/image_original3.png` (1600x1200, viewport)
_three phone screens: onboarding, time tracker home, tasks/schedule_

| # | Region (top -> bottom) | Component type | Contents (copy, counts, media) | Layout (cols, alignment) | States / motion |
|---|---|---|---|---|---|
| 1 | Onboarding progress | 4 segments | first segment orange | row, full width | step advances |
| 2 | Onboarding hero | full-bleed 3D image + headline | "Your Workday, Optimized by AI", 2-line sub | text bottom-left, white | - |
| 3 | Onboarding actions | Skip (white) / Next (orange) | 2 equal buttons | row | pressed |
| 4 | Header | 2 icon buttons + bell/avatar | search, waveform; bell with orange dot, photo avatar | space-between | pressed |
| 5 | Time Tracker | glass card + ring gauge | "06:14 HOURS", "Today ⌄" chip, pause/stop left, + right | centred ring | ring fill |
| 6 | Team Tasks Overview | solid accent card | translucent sub-card, "8 Tasks" white pill + "75%" dark pill | stack | - |
| 7 | Today's Tasks | glass card + horizontal rail of white cards | date/time, title, sub, status + dot | horizontal scroll, cut-off 2nd card | - |
| 8 | AI Smart Schedule | white card, vertical orange line | time labels 09:00 / 11:30, grey slot card | line + stack | - |
| 9 | Tab bar | floating glass pill | 5 rounded-square icons, active filled | centred, bottom | active state |

## Section plan

The ordered list of blocks to build, derived from the screens above. This is
what `--sections` should have been; if it differs from `designice.json`, this
file wins.

1. Onboarding (4 steps) -> Login -> Project picker (skipped when only one project)
2. Home: header, schedule-variance ring, lag alerts, drone-shot rail, planned-vs-actual schedule, phase bars
3. Flights (expandable flights with shot rails, live SSE/polling), full-screen shot viewer, upload modal
4. 3D (WebView embed), Reports (generate/open/share PDF), Settings

## Mobile derivation

The reference is a desktop page. Record how each web region becomes a phone
treatment - see the properui skill's `references/mobile-derivation.md`.

| Web region | Mobile treatment | Tab |
|---|---|---|
| nav (logo, search, waveform, bell, avatar, Menu) | header row: search slot -> project switcher (swap glyph, the same as the Project screen's switch button; the app has no search, so no magnifier), waveform -> live flights, bell (dot on a running order or findings) -> Activity, avatar -> Company; Menu dropped | all (home) |
| sidebar icon rail | floating glass pill tab bar (custom `tabBar`), 5 rounded squares, active filled accent | global |
| hero "OWN YOUR TIME" + 3D object | onboarding screen: full-bleed drone orbit photo, big white headline, Skip/Next | onboarding |
| Time Analytics bar | "Progress by phase" earned-vs-planned bars (stacked vertically instead of one wide row) | home |
| Time Tracker ring | "Schedule variance" ring: days behind, earned arc + planned marker, flight chip, pause/stop live, + upload | home |
| Team Tasks Overview | "Lag alerts" accent card, findings as translucent sub-cards with shots/% pills | home |
| Today's Tasks table | horizontal rail of white shot cards (the mobile frame of the same card) | home, flights |
| AI Smart Schedule (horizontal timeline) | vertical accent line + date labels + grey milestone slots (mobile frame's variant) | home |
| Add New Task button | "+" in the ring card and Flights header -> upload modal | home, flights |
| (none) | 3D WebView of the web embed | 3D |
| (none) | report list + generate CTA (accent card) | reports |
| footer | account, API URL, live toggle, about, sign out as grouped rows | settings |
