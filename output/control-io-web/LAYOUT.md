# Layout inventory - ORDI -> control.io

The three ORDI screenshots are the contract. Rows here become components.

## Template tokens (read off the images)

| | Template (from the image) | Yours |
|---|---|---|
| mode | light, warm | light, cool |
| ground | sand `#E9DCC3` inside a rounded 20px "stage" floating on a paler `#F6ECDC` blurred page | concrete `#E4E8EA` stage on `#EEF1F2` page |
| surface | white glass `rgba(255,255,255,.55)` + blur, inner white cards `#FFFFFF` | same white glass (kept - it is structure, not brand) |
| ink | `#2A2622` | `#1C2226` |
| accent | orange `#F26B2B` (CTA, High pill, highlight card, ring) | lagoon blue `#0A8FA3` |
| accent2 | amber `#F5A524` (Medium pill, schedule block) | metal grey `#6B737A` |
| display font | Manrope 800, giant uppercase, tracking -0.04em | Space Grotesk 700 |
| body font | Manrope 400/500 | Inter |
| corner radius | stage 20, glass cards 28, inner cards 16, pills 8, round buttons 14 | same |
| nav pattern | wordmark left, 4 text links right, dark pill CTA | same |
| card style | frosted glass container holding white inner cards; title 22/600 + muted subtitle; square white "↗" button top-right | same |

## Screens

### Screen 1 - landing hero (image_original1.png)
| # | Region | Component | Contents | Layout | States / motion |
|---|---|---|---|---|---|
| 1 | nav | TopNav | icon+wordmark, Product / AI Features / Use Cases / Pricing, dark pill "Get Started" | space-between, links gap 60px | hover underline |
| 2 | headline | SplitHeadline | "FOCUS" left, "YOUR / TIME" right-aligned, ~150px caps | two columns around centre object | none |
| 3 | centre object | Hero3D | furry lightning bolt, overlaps headline + cards | absolute centre, ~45% width | slow float |
| 4 | video card | HowItWorksCard | phone thumb + play, title, 2-line text | under left headline, 300px | hover lift |
| 5 | floating rows | GlassRows | 2 rows: name / pill (High orange, Medium amber) / status / time | glass tray 390px, overlaps object | - |
| 6 | today card | TodayCardPair | glass card, title+sub, ↗ button, 2 white cards (date/time, title, hours, status + dot) | right-centre, 500px | - |
| 7 | value copy | LeadCopy | 18px bold title + 3-line paragraph | bottom-left | - |
| 8 | carousel | CarouselControls | ← dots(6, one active) → | bottom-left | - |
| 9 | caption | Caption | 2-line uppercase 13px | bottom-right | - |
| 10 | watermark | Watermark | huge "ORDI" ghost letters | behind everything | - |

### Screen 2 - dashboard (image_original2.png)
| # | Region | Component | Contents | Layout | States / motion |
|---|---|---|---|---|---|
| 1 | top bar | AppTopBar | wordmark, search pill 260px + round voice btn; bell (dot), avatar, accent "Menu ≡" pill | space-between | - |
| 2 | rail | IconRail | 4 square white icon buttons mid-left + 2 at bottom | floating left, 48px | active = white |
| 3 | headline | PageHeadline | "OWN / YOUR TIME" white caps ~70px over 3D object | left, above cards | - |
| 4 | analytics bar | SegmentBar | label + big "34h 14m", 4 labelled segments with % pills (accent / amber / black / white) | glass, full width of left 2 cols | - |
| 5 | schedule | TimelineCard | title + dark "AI Optimized" pill + sub, ↗; white inner card with hour ruler 09:00-15:00, coloured blocks w/ avatars, scrub line | 1.4fr | - |
| 6 | highlight | AccentCard | solid accent card, title/sub, ↗; 2 translucent sub-cards: title, 2-line text, "8 Tasks" white pill + "75%" black pill, avatars | 1fr | - |
| 7 | table | TaskTable | title/sub/↗; header row; 4 white rows: name / priority pill / status / time; full-width white "Add New Task" | right column 400px | - |
| 8 | gauge | RingGauge | title, "Week total", "Today ⌄" select; ring with big 06:14; pause/stop left, + right | right column | ring animates |

### Screen 3 - mobile (image_original3.png)
| # | Region | Component | Contents | Layout | States / motion |
|---|---|---|---|---|---|
| 1 | onboarding | Onboarding | 4-step progress bar, 3D object, 2-line white headline, sub, Skip (white) / Next (accent) | full phone | step progress |
| 2 | home | TrackerCard + AccentCard | round search/voice, bell/avatar; ring card; accent overview card | stacked | - |
| 3 | tasks | CardRail + ScheduleCard | horizontal white cards; schedule with vertical accent line | stacked | h-scroll |
| 4 | tab bar | PillTabBar | 5 rounded-square icons in a glass pill, active = accent fill | floating bottom | - |

## Section plan (web landing)
1. nav - TopNav
2. hero - Screen 1 whole stage (3D tower replaces fur bolt)
3. features - glass cards with white inner cards (Screen 1/2 card anatomy)
4. stats - SegmentBar + big numbers
5. timeline - TimelineCard: how a flight becomes a verdict
6. gallery - drone shots / 3D mesh examples in TodayCardPair anatomy
7. faq (GEO) - TaskTable anatomy rows
8. cta - AccentCard

App dashboard reproduces Screen 2 one-to-one.

## Mobile derivation
| Web region | Mobile treatment | Tab |
|---|---|---|
| nav | round icon buttons header (search, live, bell, avatar) | - |
| hero | Onboarding (first launch) | - |
| RingGauge + AccentCard | Home | home |
| TodayCardPair + TimelineCard | Flights feed | flights |
| Hero3D | 3D viewer (WebView of /embed/model) | 3d |
| reports | list + share PDF | reports |
| footer / settings | settings | settings |
