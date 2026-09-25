# Build brief - control-io-web

**Request:** control.io - B2B SaaS that supervises multistorey construction sites with drone flights, 3D reconstruction and AI comparison against construction schedule documents to prove developer delays
**Platform:** web  |  **Company:** control.io
**Reference design:** ORDI - AI Productivity SaaS, Landing Page + Dashboard (`landing-page-and-dashboard-ui-ux-for-productivity-saas-ui-ux-designer`)
**Reference folder:** `Landing Page & Dashboard UI:UX for Productivity SaaS | UI UX Designer`
**Look at these before writing code:** `Landing Page & Dashboard UI:UX for Productivity SaaS | UI UX Designer/image_original1.png`, `Landing Page & Dashboard UI:UX for Productivity SaaS | UI UX Designer/image_original2.png`, `Landing Page & Dashboard UI:UX for Productivity SaaS | UI UX Designer/image_original3.png`

## Direction
- Style: **glassmorphic** (also claymorphic, minimal, playful)
- Mode: **light**
- Industry: saas, ai, developer-tools
- Layout: split-screen, bento-grid, sidebar, centered, full-bleed, single-column

## Tokens - template -> yours

_template tokens are authored in meta.json_

| Role | Template | Yours |
|---|---|---|
| ground | `#E9DCC3` | `#E4E8EA` **<-** |
| surface | `#FFFFFF` | `#DCE0E2` **<-** |
| ink | `#7A7268` | `#1C2226` **<-** |
| muted | `#2A2622` | `#767B7E` **<-** |
| accent | `#F26B2B` | `#0A8FA3` **<-** |
| accent2 | `#C86D40` | `#6B737A` **<-** |
| display font | Manrope | Space Grotesk **<-** |
| body font | Manrope | Inter **<-** |

## Tokens
- Roles: ground=#E4E8EA  surface=#DCE0E2  ink=#1C2226  muted=#767B7E  accent=#0A8FA3  accent2=#6B737A
- Fonts: Space Grotesk, Inter
- Radius: 20px  |  Shadow: 0 8px 32px rgba(0,0,0,.35)
- Section padding: 160px desktop / 96px mobile
- Display type: clamp(2.5rem, 5vw, 4rem), leading 1.1
- Body type: 16px

## Sections, in order
1. nav
2. hero
3. features
4. stats
5. timeline
6. gallery
7. cta

## Motion
- **3d-webgl** via three.js / react-three-fiber - apply ACES filmic tone mapping or the model renders dark and muddy
- **reveal-on-scroll** via IntersectionObserver + CSS - fire once at ~20% viewport; never re-animate on scroll up

## Non-negotiables
- No purple-to-blue gradient on a white card unless the reference design actually uses one.
- No emoji as icons. Use a real icon set or draw inline SVG.
- Body text is never below 15px, and never pure #000 on pure #FFF.
- Every section must differ from its neighbour in background, rhythm or column count - eleven identical centred slabs is the single clearest tell of a generated page.
- Buttons need real hover, focus-visible and active states, not just a colour change.
- Respect prefers-reduced-motion: hold transforms, keep opacity fades.
- Images need explicit width/height or aspect-ratio so nothing shifts on load.
- Ship real copy, not lorem ipsum, and not three-word headlines that say nothing.
- Cap backdrop-filter surfaces at ~6 on screen; more will drop frames on mid-range hardware.

## Image prompts

**hero** (16:9)
> Wide cinematic hero image for a saas, ai website. control.io. claymorphic, glassmorphic art direction, palette #E9DCC3, #FFFFFF, #F26B2B, #2A2622, no text, no watermark, no UI chrome. Strong single focal point positioned off-centre with generous negative space on the left third for a headline overlay. Shallow depth of field, controlled contrast so white type stays readable over it.

**feature-texture** (1:1)
> Abstract close-up texture evoking saas, ai. claymorphic, glassmorphic art direction, palette #E9DCC3, #FFFFFF, #F26B2B, #2A2622, no text, no watermark, no UI chrome. Macro detail, soft directional light, extremely shallow depth of field, reads as a background at low opacity rather than as a subject.

**section-support** (4:3)
> Editorial supporting photograph for a saas, ai website section. control.io. claymorphic, glassmorphic art direction, palette #E9DCC3, #FFFFFF, #F26B2B, #2A2622, no text, no watermark, no UI chrome. Documentary framing, natural light, one human gesture or one object in use, nothing staged or stock-like.

**og-card** (16:9)
> Open Graph share card background for a saas, ai brand. claymorphic, glassmorphic art direction, palette #E9DCC3, #FFFFFF, #F26B2B, #2A2622, no text, no watermark, no UI chrome. Simple, high contrast, centre kept visually quiet so a logo and title can be composited on top.

## Reference description

My role. UI UX Designer, UX/UI Designer, SaaS Designer, Dashboard Designer

Project description.

As a UI/UX Designer, I built both the landing page and the dashboard for a productivity SaaS focused on time management and task prioritization. The landing page was delivered end-to-end — design plus development — with clean UI, soft 3D visuals, and clear hierarchy that communicate scheduling, task tracking, and AI-powered workflows. The dashboard was built for clarity under load, combining scheduling, real-time tracking, and performance insights into one system that supports fast decisions in SaaS and B2B environments.

Skills and deliverables

UX & UI
UX & UI Design
Landing Page
Website
SaaS
Landing ui ux design with 3D model
Landing ui ux design with 3D model
SaaS dashboard UI UX design
SaaS dashboard UI UX design
Responsive design 
Responsive design
Productivity SaaS – UI/UX Design for Landing Page & Dashboard

As the UI/UX Designer for this productivity SaaS, I built both sides of the product — the marketing landing page (design + development) and the in-product dashboard. The platform focuses on time management, task prioritization, and AI-powered workflows, and the goal was to carry one coherent design language from the first marketing touchpoint to daily product use.
The idea: turn a complex productivity system into something that feels effortless on first impression and stays clear under daily load. Two surfaces, one design language — focused, structured, quietly modern.
➡️ Process:
UI/UX Research & Strategy:
We started with how productivity tools are used in real work environments — where users lose focus, where interfaces add friction, what separates a tool people open daily from one they abandon. Through user flows, wireframes, and competitive benchmarks, we shaped a UX rooted in clarity and pace.
Landing Page Design & Development:
I designed and developed the landing page end-to-end — not just a Figma handoff. Built as a single narrative: lead with outcome (time saved, tasks done), introduce the mechanics (scheduling, tracking, AI workflows), close with trust. Soft 3D visuals and clean typography carry the product tone without overwhelming the copy.
Dashboard Interface Design:
Designed around one principle: stay clear under load. Scheduling, task tracking, time allocation, and performance insights live in one system, but each module earns its own visual rhythm. Users see what matters first and drill down when needed.
Design System & Scalability:
A shared component library underpins both surfaces, so the product stays consistent as new features roll out. Typography, spacing, and interaction patterns defined once and reused everywhere.
Responsive & Cross-Device:
Both landing and dashboard adapt cleanly across desktop, tablet, and mobile — tuned for real usage patterns (quick checks on mobile, deep work on desktop).
🎯 Results:
Covering both landing and dashboard as one designer gave the product a coherent identity from first click to long-term use. The landing communicates value in under 10 seconds; the dashboard turns a dense feature set into a calm daily workspace.
🔑 Skills & Tools Used:
UI/UX Designer • SaaS UI Design • Dashboard Design • Landing Page Design & Development • Productivity App Design • UX Research • Design System • Wireframing & Prototyping • Figma • Responsive Web Design
ui ux designer, ui ux designer figma, ui designer, ux designer, ux ui designer, ux product designer, saas ux ui, saas ux designer, saas ui designer, dashboard designer, dashboard ui designer, productivity app designer, landing page designer, ui ux designer saas, ui ux web designer, web designer, figma designer, product designer, ui ux, ui ux designer figma. 💼
Key Highlights:

Built both landing page (design + development) and dashboard for one productivity SaaS
Delivered landing as a production-ready page, end-to-end
Designed a structured dashboard for task flow, time allocation, and real-time tracking
Integrated soft 3D visuals with clean UI for a modern product tone
Created one shared design system used across landing and product
Designed for clarity under load — fast decisions in SaaS and B2B environments

One design language — from marketing touchpoint to daily product use.