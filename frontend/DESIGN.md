# TravelTrack frontend kit

Phone-first, soft, rounded, card-based. Dark feature cards, a mint accent, ticket shapes, fluid motion.
Everything a screen needs is in `src/lib/` and `src/components/ui/`. Do not re-create these pieces in a screen; extend the kit instead.

Stack: Next.js 16 App Router, React 19, Zustand 5, Tailwind 3, `motion` (import from `motion/react`), `lucide-react`.

## 1. Rules of the house

- Every screen file starts with `"use client"`.
- Signed-in screens: `<AuthGate><AppShell ...>...</AppShell></AuthGate>`. `AuthGate` also loads presets and `/meta` into the store.
- Import primitives from `@/components/ui`. Import `AppShell`, `PageHeader`, `BottomNav`, `ROUTES` from `@/components/ui/AppShell` (kept out of the barrel because it imports the create wizard, which uses the barrel).
- The root layout already mounts `MotionConfig reducedMotion="user"`, the `Toast` and the global success moment. Do not mount them again.
- Colours only through tokens (below). No hex values in screens, no purple/blue gradients, no `dark:` variants (tokens swap by themselves).
- No uppercase tracked labels, no hairline table rows, no 4px corners. Captions are sentence case in `text-label text-ink3` (or the `.label` class).
- Radii: big cards `rounded-card` (28px), cards inside cards `rounded-inner` (20px), inputs `rounded-input` (16px), buttons/chips `rounded-full`.
- Numbers (times, prices, counts) get `tnum`. All times are IST: always format with `lib/time.ts`.
- Icons: `lucide-react`, `strokeWidth={1.75}`, 18-22px. Icon-only actions use `IconButton` (needs `label`).
- Touch targets are at least 44px (`h-11`). Inputs use the `field` class (16px text, so iOS does not zoom).
- Animate only `transform` and `opacity`. Use `SPRING` for presses/sheets/tabs and `EASE` for fades.
- No bags/luggage anywhere. Capacity is seats only.
- Page padding is `px-5` (AppShell's default for `<main>`); horizontal rails use the `rail` class to bleed to the screen edge.

## 2. Tokens

CSS variables live in `src/app/globals.css` (light is primary; dark follows `prefers-color-scheme`). Tailwind names map to them; opacity modifiers work (`bg-accent/25`, `text-ink/60`, `bg-surface/55`).

| Tailwind name | CSS variable | Light | Dark | Use |
|---|---|---|---|---|
| `canvas` | `--canvas` | #E7E9E4 | #090C0A | page background |
| `surface` | `--surface` | #FFFFFF | #131816 | cards, sheets |
| `soft` | `--surface-soft` | #F2F4EF | #1A201C | inner tiles, input fill, grey chips |
| `ink` | `--ink` | #0D1210 | #EEF2EE | main text, selected chips (`bg-ink text-surface`) |
| `ink2` | `--ink-2` | #5A625C | #A3ACA5 | secondary text |
| `ink3` | `--ink-3` | #8E968F | #6C756E | captions, placeholders |
| `line` | `--line` | ink 8% | white 8% | hairline borders (`border-line`) |
| `dark` | `--dark-card` | #0E1411 | #1B221E | dark feature cards, toasts |
| `ondark` | `--on-dark` | #F1F5F0 | same | text on dark cards |
| `ondark2` | `--on-dark-2` | #9BA59D | same | secondary text on dark cards |
| `darkline` | `--line-on-dark` | white 10% | same | borders on dark cards |
| `accent` | `--accent` | #7AF09A | same | primary actions, selected, filled seats |
| `accentInk` | `--accent-ink` | #062A12 | same | text on accent |
| `accentDeep` | `--accent-deep` | #15803D | #7AF09A | accent-coloured text on light surfaces |
| `warn` | `--warn` | #F5B83D | same | urgency, Near-you card |
| `warnInk` | `--warn-ink` | #3A2A00 | same | text on warn |
| `danger` | `--danger` | #D92D20 | #F87168 | errors, destructive |

Each also exists as channels (`--accent-rgb` etc.) for `rgb(var(--accent-rgb) / 0.3)` in hand-written CSS.

Other Tailwind additions: `rounded-card|inner|input`, `shadow-card` (resting card), `shadow-float` (sheets, dark cards), `shadow-nav`, `shadow-glow` (accent glow under primary buttons), `max-w-phone` (440px), `text-2xs` (11px), `text-label` (13px), `text-title` (32px/600), `h-nav`/`pb-nav` spacing (`--nav-space`), font `font-sans` = Outfit.

CSS classes (globals.css):

| Class | What it does |
|---|---|
| `tnum` | tabular numbers |
| `label` | 13px caption in ink-3 (on-dark-2 inside `.on-dark`) |
| `title` | 32px/600 page title |
| `field` / `field-surface` | form control (soft fill) / white fill + hairline for soft backgrounds |
| `on-dark` | put on a dark container so `label`, focus rings and skeletons adapt (`Card tone="dark"` adds it) |
| `pt-safe`, `pb-safe`, `mb-safe` | safe-area padding/margin (min 12px for the paddings) |
| `pb-nav` | bottom padding that clears the floating nav |
| `rail` | horizontal scroller (flex, gap-2, hidden scrollbar) that bleeds through `px-5` |
| `no-scrollbar` | hides scrollbars |
| `frost` | translucent blurred surface (nav, sticky bars) |
| `press` | CSS-only press scale for plain links |
| `ticket-notch` | the perforation strip used by `TicketCard` |
| `skeleton` | shimmer background used by `Skeleton` |

Layout variables: `--nav-h` (68px), `--nav-gap`, `--nav-space` (what a page must leave free at the bottom).

## 3. Routes

`ROUTES` from `@/components/ui/AppShell`:

```ts
ROUTES.home        // "/"            Home / board
ROUTES.rides       // "/rides"       My rides (bottom nav tab)
ROUTES.profile     // "/profile"     Profile (bottom nav tab)
ROUTES.login       // "/login"
ROUTES.onboarding  // "/onboarding"  first-run form; AuthGate redirects here until me.onboarded
ROUTES.pool(id)    // "/pool/<id>"   ride page
```

The bottom nav highlights Home on `/`, My rides on `/rides*`, Profile on `/profile*`.

## 4. Components (`@/components/ui`)

### AppShell, PageHeader, BottomNav — `@/components/ui/AppShell`

```tsx
<AppShell
  header?: ReactNode          // above the content, padded for the status bar
  nav?: boolean               // floating bottom nav, default true
  bottomBar?: ReactNode       // sticky action bar; sits in flow so it never covers content
  tone?: "canvas" | "dark"    // page backdrop; "dark" for the ride page (light ticket on dark)
  className?: string          // classes for <main>, default "px-5"
>
```

Renders the 440px column, `PageTransition`, `BottomNav` (Home / My rides / raised "+" that calls `openCreate()` / Profile) and `<CreateSheet />` from `@/components/create/CreateSheet` (must export a component named `CreateSheet` taking no props; it reads `createOpen`, `createPrefill`, `closeCreate` from the store).
With `tone="dark"` the header/main text is `text-ondark`; give light cards inside their own `text-ink` (Card and TicketCard already do).

```tsx
<PageHeader
  title?: ReactNode      // h1
  eyebrow?: ReactNode    // small line above, e.g. "Hey, Kavish"
  leading?: ReactNode    // Avatar or back IconButton
  trailing?: ReactNode   // IconButton(s)
  compact?: boolean      // centred small title with leading/trailing 44px slots (sub-pages)
/>
```

```tsx
// Home
<AuthGate>
  <AppShell header={<PageHeader eyebrow={`Hey, ${first}`} title="Find a ride"
      leading={<Avatar name={me.name} seed={me.id} />}
      trailing={<IconButton label="Use my location" variant="surface" onClick={geo.request}><LocateFixed size={20} strokeWidth={1.75} /></IconButton>} />}>
    ...
  </AppShell>
</AuthGate>

// Ride page
<AppShell tone="dark" nav={false}
  header={<PageHeader compact title="Your ride" leading={<IconButton label="Back" variant="onDark" href={ROUTES.home}><ChevronLeft size={20} /></IconButton>} />}
  bottomBar={<Button full size="lg" onClick={join}>Join ride</Button>}>
  <TicketCard stub={...}>...</TicketCard>
</AppShell>
```

### Motion helpers

```ts
SPRING       // { type: "spring", stiffness: 420, damping: 34 }  sheets, tabs, presses
SPRING_POP   // { stiffness: 460, damping: 30 }                  seats, checks, numbers
EASE         // { duration: 0.22, ease: [0.22, 1, 0.36, 1] }     fades
PRESS        // { whileTap: { scale: 0.97 }, transition: SPRING } spread on a motion element
STAGGER_STEP // 0.035
```

- `<PageTransition className?>` — fade + 10px slide up per route. AppShell already applies it; use it yourself only on pages without AppShell (login, onboarding).
- `<Stagger as?="div"|"ul" className?>` + `<StaggerItem as?="div"|"li" className?>` — list rows enter 35ms apart; rows added later animate on their own.
- `<FadeIn delay? y? className?>` — one block fades/lifts in.

```tsx
<Stagger className="space-y-3">
  {pools.map((p) => <StaggerItem key={p.id}><RideCard pool={p} /></StaggerItem>)}
</Stagger>
```

### Button, IconButton, buttonClass

```tsx
<Button
  variant?: "primary" | "dark" | "soft" | "ghost" | "danger" | "onDark"   // default primary (accent); onDark = quiet button on dark cards / the dark ride page
  size?: "sm" | "md" | "lg"                                    // 44 / 48 / 56px tall
  full?: boolean
  loading?: boolean        // spinner, blocks presses
  icon?: ReactNode  iconRight?: ReactNode
  href?: string            // internal path -> next/link; anything else (upi:, https:) -> <a>
  target? rel?
  ...button props (onClick, type, disabled, aria-*)
/>
<IconButton
  label: string            // required, becomes aria-label
  variant?: "soft" | "surface" | "dark" | "ghost" | "accent" | "onDark"   // default soft
  size?: "sm" | "md" | "lg"   // 36 (44 hit area) / 44 / 56
  href?: string  target?: string  rel?: string  dot?: boolean   // target="_blank" for external links
  ...button props
>{icon}</IconButton>
buttonClass({ variant?, size?, full? }): string   // for odd cases only
```

```tsx
<Button full size="lg" loading={busy} onClick={submit}>Post ride</Button>
<Button variant="dark" size="sm" icon={<Plus size={16} />}>Join</Button>
<Button href={line.upi_link} variant="primary" full>Pay ₹{line.amount}</Button>
<IconButton label="Swap pickup and drop" onClick={swap}><ArrowUpDown size={18} strokeWidth={1.75} /></IconButton>
```

### Pill, Badge

```tsx
<Pill selected? onClick? icon? tone?="surface"|"soft" size?="sm"|"md" disabled? aria-label?>   // tappable chip; selected = ink
<Badge tone?="neutral"|"accent"|"accentSolid"|"warn"|"danger"|"dark"|"onDark"|"outline" icon? size?="sm"|"md">   // static label
```

```tsx
<div className="rail">
  {presets.map((p) => (
    <Pill key={p.key} selected={filters.placeKey === p.key}
      onClick={() => setFilter("placeKey", filters.placeKey === p.key ? null : p.key)}>{p.short}</Pill>
  ))}
</div>
<Badge tone="warn">1 seat left</Badge>
<Badge tone="onDark" icon={<VehicleIcon vehicle="sedan" size={14} />}>Cab</Badge>
```

### SegmentedTabs

```tsx
<SegmentedTabs<T extends string>
  options: { value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
  label: string                       // accessible group name
  tone?: "surface" | "soft" | "dark"  // white track / grey track / on dark cards
  size?: "sm" | "md"
  full?: boolean                      // equal widths, default true
/>
```

The selected pill slides between options (`layoutId`). Arrow keys move the selection.

```tsx
<SegmentedTabs<DirectionFilter> label="Direction" value={filters.direction}
  onChange={(v) => setFilter("direction", v)}
  options={[{ value: "all", label: "All" }, { value: "out", label: "From Plaksha" }, { value: "in", label: "To Plaksha" }]} />
```

### Sheet

```tsx
<Sheet
  open: boolean
  onClose: () => void
  title?: ReactNode  description?: ReactNode
  ariaLabel?: string          // when there is no title
  header?: ReactNode          // replaces the title row (wizard back button + progress)
  footer?: ReactNode          // pinned under the body, safe-area padded: primary action
  height?: "auto" | "tall"    // "tall" = 92dvh (create wizard)
  dismissible?: boolean       // false blocks backdrop/drag/Escape (while submitting)
  padded?: boolean            // body px-5, default true
>
```

Springs up from the bottom, drag down from the handle/header to dismiss, backdrop fades, focus is trapped and restored, Escape closes, page scroll is locked. Portalled; sheets can be stacked (a place-search sheet over the wizard).

```tsx
<Sheet open={open} onClose={close} title="Join this ride" footer={<Button full size="lg" onClick={join}>Join</Button>}>
  <Stepper label="Seats" value={seats} onChange={setSeats} min={1} max={pool.seats_open} />
</Sheet>
```

### Stepper, AnimatedNumber

```tsx
<Stepper value onChange min?=1 max?=6 label: string hint?: ReactNode icon?: ReactNode unit?: string disabled? />
<AnimatedNumber value: number format?: (n) => string className? />   // rolls up/down on change
```

```tsx
<Stepper label="Seats in the ride" hint="Including you" value={maxSeats} onChange={setMaxSeats} min={2} max={vehicleSeats(vehicle)} unit="seats" />
<p className="text-3xl font-semibold"><AnimatedNumber value={pool.seats_open} /> left</p>
<AnimatedNumber value={perSeat} format={(n) => `₹${n}`} />
```

### Avatar, AvatarStack

```tsx
<Avatar name: string seed?: string src?: string | null size?: "xs"|"sm"|"md"|"lg"|"xl" />   // 24/32/40/56/80px, initials on a deterministic tint
<AvatarStack users: { id; name }[] max?=4 size?="sm" ring?: "surface"|"soft"|"dark"|"canvas"|"warn" />   // ring = colour of the card it sits on
initials(name): string
avatarTint(seed): { background, color }
```

```tsx
<AvatarStack users={pool.members.map((m) => m.user)} ring="dark" />
```

### SeatDots

```tsx
<SeatDots taken: number total: number tone?: "light"|"dark" size?: "sm"|"md"|"lg" />
```

One dot per seat; dots pop in one by one, a seat fills with a spring when `taken` rises (also on live updates). `total` = `pool.seats_taken + pool.seats_open`.

```tsx
<SeatDots taken={pool.seats_taken} total={pool.seats_taken + pool.seats_open} tone="dark" />
```

### RouteLine, VehicleIcon

```tsx
<RouteLine
  orientation?: "horizontal" | "vertical"   // vertical for From/To cards
  tone?: "light" | "dark"
  color?: "ink" | "accent" | "warn"         // default ink on light, accent on dark
  variant?: "trip" | "solid"                // solid then dashed after the marker / solid end to end
  vehicle?: Vehicle | null                  // marker icon
  icon?: ReactNode                          // custom marker instead
  progress?: number                         // marker position 0..1, default 0.5
  animate?: "mount" | "loop" | "none"       // "loop" = ride page idle
  size?: "sm" | "md" | "lg"                 // marker 24 / 30 / 44px
  delay?: number
/>
<VehicleIcon vehicle: Vehicle size?=20 strokeWidth?=1.75 className? />   // auto / cab / SUV / MUV
```

Start ring dot, line, end dot. The line draws itself and the marker travels to its spot on mount. Horizontal fills the container width; vertical fills its height (give the parent a height or use `self-stretch`).

```tsx
// Ride card (image 2): times at the ends, names beneath
<div className="flex items-center gap-3">
  <span className="tnum text-xl font-semibold">{hhmm(pool.window_start)}</span>
  <RouteLine tone="dark" vehicle={pool.vehicle} />
  <span className="tnum text-xl font-semibold">{hhmm(pool.window_end)}</span>
</div>

// From/To card
<div className="flex gap-3">
  <RouteLine orientation="vertical" size="sm" className="py-3" />
  <div className="flex-1">…From row… …To row…</div>
</div>

// Settled-ride card (image 1): amount in the middle of a yellow line
<RouteLine tone="dark" color="warn" variant="solid" size="lg" icon={<IndianRupee size={20} />} />
```

### Card, TicketCard

```tsx
<Card tone?: "surface"|"soft"|"dark"|"warn"|"accent" radius?: "card"|"inner" pad?: "none"|"sm"|"md"
      href?: string onClick?: () => void aria-label? className? />
```

`href`/`onClick` make the whole card pressable (scale 0.97). `tone="dark"` is the dark feature card (first/soonest ride); `tone="warn"` is the Near-you prompt.

```tsx
<TicketCard
  stub?: ReactNode            // part below the perforation; omit for no notches
  tone?: "light" | "dark"
  href?: string  aria-label?
  bodyClassName?  stubClassName?  className?
>{main part}</TicketCard>
```

Semicircular side notches + dashed divider are real cut-outs, so it works on any backdrop.

```tsx
<TicketCard tone="light" stub={<div className="grid grid-cols-3 gap-3">…pickup / vehicle / seats…</div>}>
  …route with times…
</TicketCard>
```

### Countdown

```tsx
<Countdown iso: string now: number tone?: "light"|"dark" size?: "sm"|"md" urgentUnder?=15 />
countdownText(iso, now, urgentUnder?): { text, urgent, past }
```

"In 2h" → "Leaving in 12m" (warn yellow, soft pulse under 15 min) → "Leaving now" → "Left 5m ago". `now` comes from `useNow()`.

### Skeleton, RideCardSkeleton, SkeletonList

```tsx
<Skeleton className="h-4 w-24" />              // shimmer block; size + radius via classes
<RideCardSkeleton tone?="light"|"dark" />
<SkeletonList label?="Loading">{...}</SkeletonList>   // role=status wrapper, space-y-3
```

### EmptyState

```tsx
<EmptyState icon? title: string body? action? variant?: "card"|"plain" />
```

```tsx
<EmptyState icon={<CarTaxiFront size={26} strokeWidth={1.75} />} title="No rides yet"
  body="Post one and people heading the same way will be pointed to it."
  action={<Button onClick={() => openCreate()}>Post a ride</Button>} />
```

### Toast (global)

Mounted in the root layout. Trigger from anywhere:

```ts
showToast(text: string, tone?: "info" | "success" | "error", action?: { label: string; onClick: () => void })
```

```tsx
const showToast = useStore((s) => s.showToast);
showToast("Couldn't load rides", "error", { label: "Retry", onClick: reload });
```

### SuccessBurst, SuccessCheck (success moments)

Global, preferred: `useStore.getState().celebrate("Ride posted")` — dimmed overlay, animated check burst, label, short vibration, auto-dismiss after 1.4s. Use it for posted / joined / booked / paid.

```tsx
<SuccessBurst show: boolean label?: string onDone?: () => void duration?=1400 />   // controlled overlay
<SuccessCheck size?=88 />                                                         // just the animated mark, inline
```

### Field, Input, Textarea, inputClass

```tsx
<Field label: string hint? error?: string | null aside?: ReactNode>{one control}</Field>   // wires id / aria-invalid / aria-describedby
<Input leading?: ReactNode trailing?: ReactNode surface?: boolean ...input props />
<Textarea surface? rows?=3 ...textarea props />
inputClass   // "field": for native <select>, <input type="time"> etc.
```

```tsx
<Field label="UPI ID" hint="So riders can pay you back" error={err}>
  <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" inputMode="email" autoCapitalize="none" />
</Field>
<input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
```

### DateStrip

```tsx
<DateStrip value: string | null onChange: (v: string | null) => void
  allowNone?: boolean      // tap the selected day again to clear (board filter)
  days?=7  tone?: "canvas" | "soft"  label?="Day" />
```

7-day strip (IST); the selected day is a raised white card with an accent bar that slides between days. Use inside a `px-5` container (it bleeds to the edges).

```tsx
<DateStrip value={filters.day} onChange={(d) => setFilter("day", d)} allowNone />   // home
<DateStrip value={date} onChange={(d) => d && setDate(d)} tone="soft" />            // wizard
```

### Other components

- `@/components/AuthGate` — `<AuthGate allowUnonboarded?>`; redirects to `/login?next=…` or `/onboarding`; loads presets + meta.
- `@/components/ui/Providers`, `@/components/SWRegister` — root layout only.

## 5. lib

### types.ts

```ts
type Vehicle = "auto" | "sedan" | "suv" | "muv";
type PoolStatus = "open" | "full" | "booked" | "departed";
type PoolDirection = "outbound" | "inbound" | "other";
type TransitMode = "none" | "train" | "flight";
type BookedVia = "uber" | "ola" | "indrive" | "rapido" | "other";

interface Place { name: string; lat: number; lng: number }
interface Preset extends Place { key: string; short: string; code: string; pickup: string }
interface PlaceResult extends Place { detail: string }
interface PublicUser { id: string; name: string; batch: string | null }
interface Me { id; name; email; phone: string | null; batch: string | null; upi_id: string | null; avatar_url: string | null; onboarded: boolean }
interface Member { user: PublicUser; seats: number; is_booker: boolean; has_paid: boolean; joined_at: string }
interface Pool {
  id: string; origin: Place; destination: Place; direction: PoolDirection; distance_km: number;
  window_start: string; window_end: string; custom_route_note: string | null; meeting_point: string;
  max_seats: number; vehicle: Vehicle; vehicle_seats: number; status: PoolStatus;
  seats_taken: number; seats_open: number; total_fare: number | null; booked_via: BookedVia | null;
  transit_mode: TransitMode; transit_code: string | null; transit_time: string | null;
  bookable_at: string; creator: PublicUser; members: Member[]; created_at: string; contact_url: string | null;
}
interface PoolDetail extends Pool { whatsapp_group_url: string | null; member_contacts: { user_id: string; wa_link: string | null }[] | null; can_book: boolean }
interface PoolCreate {
  origin: Place; destination: Place; window_start: string; window_end: string;
  vehicle?: Vehicle; max_seats: number; my_seats: number;
  meeting_point?: string | null; custom_route_note?: string | null; whatsapp_group_url?: string | null;
  transit_mode?: TransitMode; transit_code?: string | null; transit_time?: string | null; force?: boolean;
}
interface PoolUpdate { vehicle?: Vehicle; max_seats?: number; meeting_point?: string | null; custom_route_note?: string | null; whatsapp_group_url?: string | null }
interface MatchQuery { origin: Place; destination: Place; window_start: string; window_end: string; seats?: number; transit_code?: string | null }
interface Match { pool: Pool; overlap_minutes: number; start_delta_minutes: number; same_transit: boolean; origin_distance_m: number; destination_distance_m: number }
interface SettlementLine { user: PublicUser; seats: number; amount: string; upi_link: string | null; has_paid: boolean }
interface Settlement { total_fare: number; seats: number; per_seat: string; booker: PublicUser; booker_upi: string | null; booked_via: BookedVia | null; lines: SettlementLine[] }
interface Meta { ms_client_id; ms_tenant; dev_login: boolean; allowed_domain; vapid_public_key; match_grace_minutes: number; booking_unlock_minutes: number; match_radius_km: number }
interface AuthResponse { token: string; user: Me }
```

### api.ts

```ts
API_URL: string
class ApiError extends Error { status: number; code: string; message: string; data: Record<string, unknown> }
matchesFromError(e): Match[] | null     // matches from a 409 MATCH_FOUND, else null
isAbort(e): boolean                     // a request cancelled by AbortSignal
errorMessage(e, fallback?): string      // toast-ready text

api.meta(): Promise<Meta>
api.microsoftLogin(id_token, nonce): Promise<AuthResponse>
api.devLogin(email): Promise<AuthResponse>
api.me(): Promise<Me>
api.updateMe(body: Partial<Pick<Me, "name" | "phone" | "batch" | "upi_id">>): Promise<Me>

api.presets(): Promise<Preset[]>                                              // prefer store.loadPresets()
api.placeSearch(q, { limit?: number; signal?: AbortSignal }?): Promise<PlaceResult[]>   // q 2..80 chars; 502 GEOCODER_DOWN when the geocoder is down
api.placeReverse(lat, lng, { signal? }?): Promise<PlaceResult>               // names a coordinate (preset within 0.6 km wins)

api.pools(): Promise<Pool[]>
api.pool(id): Promise<PoolDetail>
api.matches(query: MatchQuery): Promise<Match[]>
api.createPool(body: PoolCreate): Promise<PoolDetail>      // 409 MATCH_FOUND unless body.force
api.updatePool(id, body: PoolUpdate): Promise<PoolDetail>  // 409 NOT_ENOUGH_SEATS, 422 TOO_MANY_SEATS
api.deletePool(id): Promise<void>
api.join(id, seats = 1): Promise<PoolDetail>               // POOL_FULL, NOT_ENOUGH_SEATS
api.updateMySeats(id, seats): Promise<PoolDetail>
api.leave(id): Promise<{ deleted: boolean; pool?: Pool }>
api.book(id, total_fare, booked_via): Promise<PoolDetail>
api.unbook(id): Promise<PoolDetail>
api.settlement(id): Promise<Settlement>
api.markPaid(id, userId, has_paid): Promise<Settlement>
api.pushSubscribe(sub) / api.pushUnsubscribe(sub): Promise<void>
```

Create flow with the join prompt:

```ts
try {
  const pool = await api.createPool(body);
  upsertPool(pool); celebrate("Ride posted"); closeCreate(); router.push(ROUTES.pool(pool.id));
} catch (e) {
  const matches = matchesFromError(e);
  if (matches) showJoinPrompt(e as ApiError, matches);   // (e as ApiError).message is the ready-made sentence; matches[0].origin_distance_m
  else showToast(errorMessage(e, "Couldn't post the ride"), "error");
}
// "Post mine anyway" -> api.createPool({ ...body, force: true })
```

### store.ts (`useStore`, Zustand)

```ts
type DirectionFilter = "all" | "out" | "in";
interface Filters { direction: DirectionFilter; day: string | null /* YYYY-MM-DD IST */; placeKey: string | null /* preset key */ }
interface UserLocation { lat: number; lng: number; accuracy: number; at: number }
interface CreatePrefill { origin?: Place; destination?: Place }
type ToastTone = "info" | "success" | "error";
interface ToastAction { label: string; onClick: () => void }
DEFAULT_FILTERS: Filters
useMatchRadiusKm(): number    // meta.match_radius_km, 2 until /meta loads

// state
token: string | null;  me: Me | null
pools: Record<string, Pool>;  loaded: boolean;  live: boolean   // live = websocket connected
filters: Filters
meta: Meta | null
presets: Preset[];  presetsLoaded: boolean
createOpen: boolean;  createPrefill: CreatePrefill | null
userLocation: UserLocation | null        // memory only; never persisted, never sent to the backend
toast: ToastState | null;  success: { id: number; label: string } | null

// actions
setAuth(token, me); setMe(me); logout()
setPools(pools); upsertPool(pool); removePool(id); setLive(live)
setFilter(key, value); resetFilters()
openCreate(prefill?: CreatePrefill); closeCreate()
setUserLocation(loc | null)
showToast(text, tone?, action?); clearToast()
celebrate(label); clearSuccess()
refreshPools(): Promise<void>               // throws on failure
loadMeta(): Promise<Meta | null>            // cached
loadPresets(): Promise<Preset[]>            // fetched once, cached; [] on failure (retryable)
joinPool(poolId, seats = 1): Promise<boolean>   // optimistic; on failure rolls back and shows the error toast
```

Persisted (localStorage `traveltrack`, version 2): `token`, `me`, `filters` (without `day`). The v2 migration resets filters.

### pools.ts (board logic; use these instead of re-deriving)

```ts
isMember(pool, userId): boolean
mySeats(pool, userId): number
sortPools(pools): Pool[]                                   // soonest first
poolTouchesPlace(pool, place, radiusKm): boolean
filterPools(pools, filters, { presets, radiusKm }): Pool[] // direction / day / place chip, sorted; "other" pools only under "all"
nearbyPools(pools, location, { radiusKm, meId?, now? }): { pool: Pool; distanceKm: number }[]
   // open, not mine, pickup within radius of the device, starting within 3 hours; closest first
NEARBY_WINDOW_MINUTES = 180
```

```tsx
const radiusKm = useMatchRadiusKm();
const all = useMemo(() => Object.values(poolsById), [poolsById]);
const visible = useMemo(() => filterPools(all, filters, { presets, radiusKm }), [all, filters, presets, radiusKm]);
const near = useMemo(() => nearbyPools(all, geo.location, { radiusKm, meId: me.id, now }), [all, geo.location, radiusKm, me.id, now]);
```

### geo.ts

```ts
PLAKSHA: { lat: 30.631, lng: 76.7245 };  PLAKSHA_RADIUS_KM = 0.6;  PRESET_SNAP_KM = 0.6;  DEFAULT_MATCH_RADIUS_KM = 2
haversineKm(lat1, lng1, lat2, lng2): number
distanceKm(a: {lat,lng}, b: {lat,lng}): number
formatDistance(km): string          // "350 m" | "1.4 km"
formatMeters(m): string             // same, from metres
isPlaksha(lat, lng): boolean
nearestPreset(presets, lat, lng, withinKm = 0.6): Preset | null
shortPlaceName(place, presets): string    // preset short name if the place sits on one, else place.name
placeCode(place, presets): string         // "IXC", "PLK", or first 3 letters
presetToPlace(preset): Place
samePlace(a, b): boolean                  // under 0.3 km apart (backend rejects such a ride)
```

### useGeolocation.ts

```ts
const geo = useGeolocation();
geo.status    // "unknown" | "prompt" | "granted" | "denied" | "unsupported"
geo.location  // UserLocation | null (same object as store.userLocation)
geo.loading; geo.error   // error: readable string | null
geo.request() // Promise<UserLocation | null>; call ONLY from a tap
```

Never prompts on load. If access was granted earlier, the position refreshes silently on mount. To name the spot for the wizard: `api.placeReverse(loc.lat, loc.lng)` (that call is an explicit user action, e.g. "Use my location" as pickup; the Near-you list itself never sends the location).

### time.ts (all IST)

```ts
TZ = "Asia/Kolkata"
hhmm(iso): string                          // "17:30"
dateKey(d): string                         // "YYYY-MM-DD"
istDateKey(offsetDays = 0): string
dayLabel(iso): string                      // "Today" | "Tomorrow" | "Thu 12 Nov"
dayKeyLabel(key): string                   // same, from a YYYY-MM-DD key
toIso(date, "HH:MM"): string
buildWindow(date, start, end): { start, end }   // ISO strings; end before start rolls to next day
nextSlot(leadMinutes = 30): string         // next quarter hour "HH:MM"
addMinutes("HH:MM", minutes): string
minutesUntil(iso, now?): number
relative(iso, now?): string                // "in 20m", "in 1h 15m", "now", "12m ago"
nextDays(count = 7, now?): StripDay[];  next7Days(now?): StripDay[]
   // StripDay { key: "YYYY-MM-DD"; weekday: "Thu"; day: "12"; month: "Nov"; isToday: boolean }
durationLabel(minutes): string             // "25m", "1h 20m"
windowMinutes(startIso, endIso): number
windowLabel(startIso, endIso): string      // "17:30 – 18:00"
```

### vehicles.ts

```ts
VEHICLES: Record<Vehicle, { label: string; seats: number; examples: string }>
   // auto Auto 3 · sedan Cab 4 · suv SUV 6 · muv MUV 7
VEHICLE_ORDER: Vehicle[]  // ["auto", "sedan", "suv", "muv"]
DEFAULT_VEHICLE = "sedan";  MIN_POOL_SEATS = 2;  MAX_POOL_SEATS = 7;  MAX_PARTY_SEATS = 6
vehicleLabel(v): string;  vehicleSeats(v): number
capacity(vehicle, maxSeats, seatsTaken): { vehicle_seats, seats_taken, seats_open }
joinBlocker(vehicle, maxSeats, seatsTaken, addSeats): "POOL_FULL" | "NOT_ENOUGH_SEATS" | null
smallestVehicleFor(seats): Vehicle
```

### Other

- `useNow(ms = 30_000): number` — re-renders on an interval; pass the value to `Countdown`.
- `useRealtime()` — call once per signed-in screen that shows pools; keeps `pools` live and sets `live`.
- `haptic(pattern?)`, `SUCCESS_HAPTIC` (`lib/haptics.ts`) — vibration where supported; `celebrate()` and `Stepper` already use it.
- `cn(...classes)` (`lib/cn.ts`) — joins class names.
- `firstName(name)` (`lib/names.ts`) — "Kavish Jain" -> "Kavish".
- `ROUTES` is defined in `lib/routes.ts` (re-exported by `@/components/ui/AppShell`); files that AppShell imports (the create wizard) import it from `@/lib/routes`.
- `msauth.ts`, `push.ts` — unchanged.

## 6. Screen recipes

- Home: `PageHeader` (eyebrow + avatar + location IconButton, title "Find a ride") → `SegmentedTabs` direction → `rail` of place `Pill`s → `DateStrip allowNone` → Near-you `Card tone="warn"` (only when `geo.location` and `nearbyPools(...)` is non-empty; otherwise a quiet "See rides near you" action that calls `geo.request()`) → `Stagger` list, first ride in `Card tone="dark"`, the rest `Card tone="surface"`; each: times at both ends of a `RouteLine`, place names beneath, then `Badge` (vehicle) + `SeatDots` + `AvatarStack` + a small `Button` "Join".
- Create wizard: `Sheet height="tall"` with a custom `header` (back, step dots) and `footer` (one-line summary + one primary `Button`). Where: From/To card with vertical `RouteLine` and a swap `IconButton`. When: `DateStrip tone="soft"`, time input (`inputClass`), flexibility `Pill`s. Ride: big vehicle cards (`Card tone="soft"` / selected `tone="dark"`, `VehicleIcon`), two `Stepper`s.
- Ride page: `AppShell tone="dark" nav={false}` + `TicketCard` with a `stub`; `RouteLine animate="loop"`; details grid; riders with `Avatar`; `bottomBar` action. After booking: `Card tone="dark"` with `RouteLine color="warn" variant="solid" size="lg"` and the per-seat amount in the middle.
- Loading: `SkeletonList` + `RideCardSkeleton`. Empty: `EmptyState`. Errors: `showToast(..., "error")`. Success: `celebrate(...)`.
