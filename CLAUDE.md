# Ash Align — Project Guide

## What This Is

A mediated conversation space for couples. Two participants join a shared room and go through AI-facilitated phases: **Intake** (private 1:1 with Ash), **Commons** (joint conversation), and **Conclusion** (AI-generated summary).

Built with Next.js 16, TypeScript, Tailwind CSS 4, Supabase (Postgres), and the Anthropic SDK.

Live URL: https://alignwithash.com/

## Critical Constraints

- **No direct database access.** The developer cannot push migrations or run SQL against the Supabase instance. All new features must work with the existing database schema, or use application-level workarounds (e.g., storing data in existing columns, using JSON in text fields, or client-side state).
- **The migration file `supabase/migrations/20260315000000_add_conclusion_phase.sql` exists but will NEVER be applied.** It is kept for reference only. All conclusion/wrap-up features have been implemented using application-level workarounds (see below).

## Database Workarounds

The DB schema only has two phases (`intake`, `commons`), no `wrap_up_ready` column, and no `conclusion_summary` column. The app works around this:

- **Wrap-up state** → Stored in `participants.summary` as JSON: `{ "intake": "…", "wrapUpReady": true }`. The `parseSummary()` helper in `lib/room.ts` handles both legacy plain-text and new JSON formats.
- **Conclusion phase** → The DB phase stays `commons`. The app derives "conclusion" by detecting a special marker message (`<!--CONCLUSION_SUMMARY:...-->`) in the messages table. `pollRoom()` checks for this marker and returns `phase: "conclusion"` to the client.
- **Conclusion summary** → Stored as a marker message in the `messages` table (role `assistant`, phase `commons`). The marker text is `<!--CONCLUSION_SUMMARY:{json}-->`. `pollRoom()` extracts the JSON and filters the marker from visible messages.

**When adding new features:** Always check if a new column/enum value is needed. If so, find an existing column to encode the data into (JSON in text fields, sentinel values, or derive from message content).

## Architecture

### Phases
1. **Intake** — Each participant has a private conversation with Ash (the AI). Messages are scoped per-participant.
2. **Commons** — Both participants join a shared conversation. Ash mediates, using turn management via `<!--NEXT:partner_a|partner_b|either-->` tags in AI responses.
3. **Conclusion** — AI generates a structured JSON summary with three sections (summary, insight, recommendations). Session ends with a Tally feedback popup.

### Key Files
- `lib/types.ts` — All shared types (`RoomPhase`, `RoomState`, `Participant`, `ChatMessage`, etc.)
- `lib/room.ts` — Core business logic: join, send, ready, wrapUp, poll, turn management
- `lib/anthropic.ts` — Anthropic SDK wrapper for AI responses
- `lib/prompts.ts` — All system prompts (intake, commons, summary, conclusion)
- `lib/supabase.ts` — Supabase client initialization
- `hooks/useSession.ts` — Client-side session hook (polling, send, ready, wrapUp)
- `hooks/useAutoScroll.ts` — Auto-scroll with double `requestAnimationFrame` for reliable timing
- `app/page.tsx` — Landing/setup page (splash → info → setup → share flow for room creator)
- `app/room/[roomId]/page.tsx` — Main room page (all phases rendered here; joiner flow: onboarding → name → chat)
- `components/BrushBackground.tsx` — Generative art background using p5.js + p5.brush (two variants: "flow" and "alignment")
- `components/MessageList.tsx` — Scrollable message area with optional footer slot for inline notices
- `components/MessageBubble.tsx` — Individual message rendering; splits assistant messages on `\n\n` into multiple bubbles
- `components/FinishedScreen.tsx` — Three-section conclusion display (summary/insight/recommendations) with alignment brush art
- `components/ChatInput.tsx` — Message input bar
- `components/TypingIndicator.tsx` — Animated typing dots

### API Routes (all under `app/api/room/`)
- `POST /create` — Create a new room
- `POST /join` — Join with a name, get/create participant
- `POST /message` — Send a message (phase-aware)
- `POST /poll` — Long-poll for state and message updates (1.5s interval)
- `POST /ready` — Mark intake as complete (triggers AI summary when both ready)
- `POST /wrapup` — Mark wrap-up ready (triggers conclusion when both ready)
- `GET /info` — Fetch room info

## Design System

### Fonts
- **Google Sans** (`font-sans`) — Body text
- **Libre Baskerville** (`font-display`) — Headings and display text
- **Libertinus Serif** — "Align" title on splash screen only

### Color Tokens (CSS custom properties)
- `--wood-*` (50–800) — Warm brown, used in intake phase
- `--olive-*` (50–700) — Green, used for ready states and intake accents
- `--damson-*` (200–800) — Deep purple-green, used in commons phase
- `--surface-*` (bg, elevated, high) — Background layers
- `--contrast-*` (strong, medium, weak, subtle) — Text hierarchy

### Spacing
- `--radius-sm` (8px), `--radius-md` (16px), `--radius-lg` (24px), `--radius-pill` (32px)

### Layout Rules
- Message column and chat input: `max-w-[600px]` centered on desktop
- Desktop: reduced padding on header/footer (`lg:pt-4`, `lg:pb-4`)
- Mobile: compact padding (`pb-6` on input, `pb-8` on status bars)
- No border above message bar on desktop (`lg:border-t-0`)

## Figma Reference
Primary file: `IBIPLegu5KnTMGlJvNy223`

## Conventions
- Phase-aware rendering: check `room.phase` or `state.phase` before rendering UI
- Turn management: AI responses contain `<!--NEXT:...-->` tags parsed by `parseNextSpeaker()`
- Polling-based updates (not websockets) — 1.5s interval via `useSession` hook
- Wrap-up status displayed as inline notices in the message stream (not a fixed bottom bar) using `WrapUpNotice` component with `WrapUpIcon`
- Participant status icons are phase-aware (typing indicator normally, checkmark when action taken)
- Send button color changes by phase: wood in intake, damson in commons
- Assistant messages split on `\n\n` into multiple bubbles for readability
- `remark-breaks` plugin used in ReactMarkdown for single-newline line breaks

## BrushBackground Component

The generative art background (`components/BrushBackground.tsx`) uses **p5.js 2.0.1 + p5.brush 2.0.0-beta** loaded dynamically via `<script>` tags.

### Two Variants
- **`"flow"`** — Standard Perlin noise flow field for loading/transition screens
- **`"alignment"`** — Two streams (top green/olive, bottom warm/brown) converge toward center using blended noise + gravitational pull. Used on splash screen and conclusion screen.

### Key Technical Details
- **Must use p5.js 2.0+** because p5.brush 2.0.0-beta requires WebGL2 (`webgl2` version check)
- **Instance mode** via `brush.instance(p)` — required since the component is embedded in React
- **WEBGL coordinate system** requires `p.translate(-w/2, -h/2)` to shift origin to top-left
- **Static rendering** — all drawing happens in `setup()` with `p.noLoop()`; p5.brush is not designed for frame-by-frame animation
- **Deferred initialization** — uses `requestIdleCallback`/`setTimeout` to yield to the main thread before heavy rendering, so the page UI (buttons etc.) remains interactive during script loading and canvas drawing
- **Mobile performance** — line counts are reduced on screens < 768px wide (e.g., 200→80 lines per stream for alignment, 500→200 for flow) to prevent the main thread from blocking for 10+ seconds
- **Script loading** — handles race conditions from React strict mode double-mounting by tracking `data-loaded` attribute and listening for load events on existing script tags

### Convergence Field Algorithm (Alignment Variant)
```
pullAngle = atan2(centerY - cy, (centerX - cx) * 0.15)  // mostly vertical pull
distFromCenter = abs(cy - centerY) / (h/2)
pullStr = distFromCenter² * 0.7                           // quadratic falloff
angle = pullAngle + (noiseAngle - pullAngle) * (1 - pullStr)  // blend with circular interpolation
```

## Prompt Engineering Notes

- All prompts include: "Avoid em dashes (—). Use commas, periods, or short sentences instead."
- Commons prompt includes varied reflective listening phrasings to avoid repetitive "reflect back"
- Commons prompt has explicit `=== PARTICIPANTS ===` block mapping participant names to roles (Partner A/B) to prevent name confusion
- Conclusion prompt requests structured JSON with `summary`, `insight`, `recommendations` keys
- Intake/opening prompts include name-role mapping and explicit instruction not to use "reflect back"

## Wrap-Up Flow

When a participant clicks "Wrap Up" in the commons phase:

1. **One partner wraps up**: An inline gray notice appears in the message stream: "{Name} has indicated that they are ready to **wrap up** this conversation..." The other user can keep chatting and sees the "Wrap Up" button in the top bar.
2. **The initiator sees**: "You have indicated that you are ready to **wrap up**. Waiting for {partner} to also wrap up..."
3. **Both wrap up**: A green notice appears: "Both parties are ready to wrap up. Synthesizing this chat into a conclusion." Then the app transitions to a full-screen loading state while the conclusion is generated.
4. **Conclusion screen**: Three-section display (summary/insight/recommendations) with alignment brush background and Tally feedback iframe.

## Home/Landing Page Flow

### Creator Flow (app/page.tsx)
1. **Splash** — Logo + "Align" title + brush background (alignment variant) + "Begin" button + disclaimer text
2. **Info** — Three horizontally-scrollable cards explaining the process
3. **Setup** — Name entry (no brush background)
4. **Share** — Copy link + enter room

### Joiner Flow (app/room/[roomId]/page.tsx)
1. **Onboarding** — Simple welcome screen
2. **Name** — Name entry (no brush background — removed to match creator flow)
3. **Chat** — Enters intake phase directly
