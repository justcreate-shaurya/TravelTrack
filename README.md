# TravelTrack · Plaksha

Cab pooling out of Sector 101. It is organised around fixed corridor hubs and flexible departure windows instead of a chat feed.

```
frontend/   Next.js 16 (App Router) PWA · Zustand · Tailwind
backend/    FastAPI · Pydantic v2 · SQLAlchemy 2 · APScheduler · Web Push
db/         schema.sql for Supabase / Neon Postgres
```

## Run locally

**Backend** (Python 3.11+)

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # DEV_LOGIN=true lets you sign in without Microsoft
uvicorn app.main:app --reload --port 8000
pytest -q                       # matching, capacity, UPI and a full API flow
```

**Frontend** (Node 20+)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

With `DEV_LOGIN=true`, the login page shows a dev form. It accepts any `@plaksha.edu.in` address, so you can open two browsers as two different students to test matching.

## Production setup

1. **Microsoft sign-in (Entra ID / Office 365)**: in the Azure portal, go to *Microsoft Entra ID → App registrations → New registration*.
   - **Supported account types**: *Accounts in this organizational directory only* (single tenant).
   - **Platform**: *Single-page application*, with redirect URIs `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`. It must be the SPA platform, not *Web*, or the browser can't redeem the code (error `AADSTS9002327`).
   - **API permissions**: the default `User.Read` / `openid profile email` are enough. Most campus tenants need admin consent the first time, so ask IT if students see "Need admin approval".
   - Copy the *Application (client) ID* into `MS_CLIENT_ID` and the *Directory (tenant) ID* GUID into `MS_TENANT_ID` on the backend. The frontend reads both from `GET /meta`.

   The browser runs authorization code + PKCE (`frontend/src/lib/msauth.ts`) as a full-page redirect, with no client secret. The backend verifies the ID token's signature against Microsoft's JWKS, then checks the audience, issuer, `tid == MS_TENANT_ID`, the nonce, and that the email (`email` / `preferred_username`) ends in `@plaksha.edu.in`. The domain check also blocks guest accounts in the tenant.
2. **Database**: run `db/schema.sql` in the Supabase or Neon SQL editor. Set `DATABASE_URL` to the Postgres URL (`postgres://…` is handled automatically) and set `AUTO_CREATE_TABLES=false`.
3. **Web Push**: generate keys with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Students turn on reminders from the Profile page. On iOS this only works after "Add to Home Screen".
4. Set `JWT_SECRET` to a long random string, set `DEV_LOGIN=false`, and set `CORS_ORIGINS` to your frontend origin.
5. Run **one** API process. The realtime feed and the scheduler are in-process (see Scaling below).

## How it works

### Trips both ways
Every pool has Plaksha at exactly one end. It is either **From Plaksha** (e.g. Plaksha → IXC) or **To Plaksha** (e.g. IXC → Plaksha, for someone landing at 16:40 who wants a ride back). The API rejects a pool with neither end at Plaksha. The board shows both directions by default.
- **Pickup points:** return trips default to the hub's pickup spot (*Arrivals exit* at IXC, *Station main entrance* at CDG, and so on); trips out default to *Plaksha main gate*.
- **Transit Sync:** on return trips the train or flight time is shown as an arrival ("Flight lands 16:40 6E 2134").
- **Reminders:** a return trip's push reads *"Pickup in 20m"*.

### Matching (`backend/app/matching.py`)
Two pools on the same origin → destination pair match if

```
max(start_A, start_B) <= min(end_A, end_B) + 15 min
```

`POST /pools` checks for matches before creating anything. If a joinable pool exists (open, with room for your seat and your bags), it returns `409 MATCH_FOUND` with the candidates, and the drawer shows *"Avnet already has a 17:00 IXC Airport → Plaksha ride with 3 seats open. Join theirs instead?"* Choosing **Post mine anyway** resends the request with `force: true`. Pools on the same train or flight (Transit Sync) are ranked first.

### Vehicles, seats & luggage
| Vehicle | Examples | Passenger seats | Boot (large bags) |
|---|---|---|---|
| Hatchback | Swift, WagonR | 4 | 2 |
| Sedan (default) | Dzire, Etios | 4 | 3 |
| SUV | Ertiga, XL6 | 6 | 3 |
| MUV | Innova | 7 | 4 |

- **Seats:** the creator picks the car, then **Seats for you** (themselves plus friends) and **Seats to give**. The pool's `max_seats` is the two added together. A joiner can also take several seats for a group.
- **Luggage:** bags that don't fit in the boot go on seats, one seat per bag. Seats lost that way show as hatched amber pips.
- **Blocked joins:** a join that won't fit is rejected with `NOT_ENOUGH_SEATS` or `BIGGER_CAR_REQUIRED`. The creator can then switch to a bigger car or change the total seats.
- **At creation:** posting is refused if the creator's own luggage would use up every seat they're giving.
- **Tuning:** change the numbers in `VEHICLE_RULES` (`backend/app/matching.py`) and in `frontend/src/lib/vehicles.ts`.

### Booking & settlement
Booking unlocks when the pool is full, or 30 minutes before `window_start`. One rider taps **I'm booking the cab** and enters the total fare, and the pool locks as `booked`. The fare is split **per seat**: ₹280 over 4 seats is ₹70 a seat, so someone holding 2 seats pays ₹140. Every other rider gets a `upi://pay?pa=…&am=…&tn=…` link that opens GPay, PhonePe or Paytm with the amount and note filled in. Riders can mark themselves paid, or the booker can mark them. The booker needs a UPI ID on their profile.

### Background jobs (`backend/app/scheduler.py`, every 10 min)
- Pools that ended more than 30 min ago are archived to `departed` and removed from live boards.
- A push reminder goes out about 45 min before departure: *"Your 17:00 IXC Airport pool with Avnet leaves in 42m from Main Gate"*. Riders also get a push when someone books.

### Privacy
Phone numbers are never sent in board lists or realtime broadcasts. Only riders in the same pool get the WhatsApp links (`contact_url`, `member_contacts`).

### Realtime
`/ws?token=…` broadcasts `pool.upsert` and `pool.delete` events. The Zustand store merges them in, joins are optimistic (the seat pip fills at once and rolls back if the server refuses), and the client resyncs on reconnect or when the tab becomes visible again.

## API summary

| Method | Path | |
|---|---|---|
| GET | `/meta` | public config (Microsoft client/tenant ID, VAPID key) |
| POST | `/auth/microsoft`, `/auth/dev` | Entra ID token (or dev email) → JWT |
| GET/PATCH | `/me` | profile: WhatsApp number, batch, UPI ID |
| GET | `/pools` | active board |
| POST | `/pools/matches` | preview matches for a window |
| POST | `/pools` | create (409 `MATCH_FOUND` unless `force`) |
| GET/PATCH/DELETE | `/pools/{id}` | detail / creator edits / cancel |
| POST | `/pools/{id}/join`, `/leave` | |
| PATCH | `/pools/{id}/me` | change my luggage count |
| POST | `/pools/{id}/book`, `/unbook` | |
| GET | `/pools/{id}/settlement` | split + UPI links |
| POST | `/pools/{id}/members/{uid}/paid` | |
| POST | `/push/subscribe`, `/push/unsubscribe` | |

Interactive docs: http://localhost:8000/docs

## Design notes
- **Typeface**: Plus Jakarta Sans via `next/font`. To use Sofia Pro, put woff2 files in `frontend/public/fonts/` and uncomment the block at the top of `globals.css`.
- **Numbers**: every time, fare and count uses `tabular-nums` (the `.tnum` class), so digits line up down the feed.
- **Theme**: follows the system setting. Dark is Obsidian `#0B0D0E` with Slate `#121517` surfaces; light is Alabaster `#F8F9FA`. Borders are 1px hairlines and corners are 4–6px.
- **Frosted glass**: used only on the sticky filter bar and the bottom creation bar and drawer.
- **Accent colours**: Plaksha teal is used for active pills and primary actions. Amber is used only for urgency (*1 seat left*, *Leaving in 20m*) and luggage-locked seats.
- **Times**: all times display in IST (`src/lib/time.ts`), whatever the device timezone.

## Scaling / next steps
- **Multiple API workers**: replace `app/realtime.py` with Supabase Realtime or Postgres `LISTEN/NOTIFY`. Run the scheduler in a single worker, or move archiving to `pg_cron` (snippet in `db/schema.sql`).
- **Schema changes**: add Alembic once the schema starts changing.
- **PNG icons**: the manifest uses SVG icons. Add 192px and 512px PNGs for older Android launchers.
- **Phase 2, WhatsApp bridge**: a baileys listener that parses messages like "anyone going to the station around 4:30" with a small LLM prompt, and posts them as ghost cards linking to the sender via `wa.me`.
