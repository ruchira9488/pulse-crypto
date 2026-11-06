# PulseCrypto

A real-time cryptocurrency market viewer:

- **`backend/`**: a Node.js + TypeScript gateway that ingests Binance's public market streams, conflates and batches them, and fans them out to mobile clients over WebSockets with per-client back-pressure.
- **`mobile/`**: a React Native (Expo SDK 58) app showing a live watchlist, order book, depth chart and telemetry, designed to stay smooth under sustained update bursts.
- **`packages/contracts/`**: the wire protocol (TypeScript types), shared by both sides so protocol drift is a compile error.

> 📹 **Screen recording:** _add link here_

---

## Contents

1. [Quick start](#quick-start)
2. [Architecture](#architecture)
3. [Backend](#backend)
   - [Buffering and back-pressure strategy](#buffering-and-back-pressure-strategy)
   - [WebSocket protocol](#websocket-protocol)
   - [REST API](#rest-api)
   - [Configuration](#configuration)
4. [Mobile app](#mobile-app)
5. [Testing and verification](#testing-and-verification)
6. [Assumptions](#assumptions)
7. [Trade-offs](#trade-offs)
8. [How AI-assisted tools were used](#how-ai-assisted-development-tools-were-used)

---

## Quick start

### Prerequisites

- Node.js ≥ 20 (developed on Node 26)
- Android Studio with an Android emulator (required). The iOS Simulator works too.
- Internet access to `stream.binance.com` / `api.binance.com`. Without it, run the backend with `MARKET_SOURCE=synthetic`.

### 1. Install

```bash
npm install            # root workspaces: contracts + backend (builds contracts via postinstall)
npm run mobile:install # mobile app (kept out of the workspace, see Trade-offs)
```

### 2. Run the backend

```bash
npm run backend        # tsx watch; HTTP + WS on :8080
```

- `GET http://localhost:8080/pairs/meta`: pair metadata
- `GET http://localhost:8080/health`: upstream status and delivery stats
- `ws://localhost:8080/ws`: the live stream

To run without network access to Binance, or to stress test:

```bash
MARKET_SOURCE=synthetic SYNTHETIC_EVENTS_PER_SECOND=500 npm run backend
```

Production-style build:

```bash
npm run backend:start  # tsc build, then node dist/index.js
```

### 3. Run the app on the Android emulator

Start an emulator (Android Studio → Device Manager), then:

```bash
npm run mobile         # expo start
```

Press **`a`** in the Expo CLI to open the app in Expo Go on the emulator. Every native module used ships in Expo Go, so no native build is needed.

**How the app finds the backend.** In development it reuses the host Metro is served from (your machine's LAN IP), which works for both emulators and physical devices. If that fails it falls back to `10.0.2.2` (the Android emulator's alias for the host's localhost). To override:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8080 EXPO_PUBLIC_WS_URL=ws://192.168.1.20:8080/ws npm run mobile
```

To evaluate performance, run a production JS bundle; dev mode is several times slower:

```bash
cd mobile && npx expo start --no-dev --minify
```

A standalone debug build (optional) is available with `npm run android:build --prefix mobile` (`expo run:android`).

### 4. Tests

```bash
npm test               # backend (Vitest): 38 tests, including an end-to-end WS test
npm run mobile:test    # mobile (Jest / jest-expo): 30 tests
npm run typecheck      # contracts + backend
cd mobile && npx tsc --noEmit
```

---

## Architecture

```
            Binance (public)                                     Mobile app (Expo)
  ┌─────────────────────────────────┐                ┌───────────────────────────────────────┐
  │ combined stream, 1 socket:      │                │ features/market-stream                │
  │  <pair>@depth20@100ms           │                │   MarketSocket (backoff, NetInfo,     │
  │  <pair>@aggTrade                │                │     AppState, ping/watchdog)          │
  │  <pair>@miniTicker              │                │   TickBuffer (rAF conflation)         │
  │ REST: ticker/24hr, exchangeInfo │                │   zustand stores (narrow selectors)   │
  └───────────────┬─────────────────┘                │ features/{watchlist, market-details,  │
                  │                                  │   market-depth, favourites, settings, │
  ┌───────────────▼─────────────────────────────┐    │   telemetry, connection, pairs-meta,  │
  │ backend                                     │    │   app-shell}                          │
  │  features/market-ingest  ── MarketEvent ──► │    └───────────────▲───────────────────────┘
  │  features/market-state   (latest-value,     │                    │
  │                           versioned, cached)│   ws://…/ws        │  JSON frames
  │  features/broadcast      (per-client loop,  ├────────────────────┘  (hello, snapshot,
  │                           back-pressure)    │                        update, config, pong…)
  │  features/pairs-meta     GET /pairs/meta    ├──── HTTP ──────────►  pull-to-refresh
  │  app/server.ts           composition root   │
  └─────────────────────────────────────────────┘
                 packages/contracts: shared protocol types
```

### Feature-based structure

Both apps are organised **by feature, not by technical layer**. Each feature owns its UI, state, models and tests, and exposes a small public API through `index.ts`. Features import each other only through that index, never through internal files. A thin composition root wires them together (`backend/src/app/server.ts`, `mobile/src/app/_layout.tsx`).

```
backend/src/
├── app/                    config (validated env), server composition, entrypoint
├── features/
│   ├── market-ingest/      Binance combined-stream client, parsers, synthetic feed
│   ├── market-state/       conflating store + order-book metrics (pure)
│   ├── broadcast/          WS gateway, per-client session, inbound protocol validation
│   └── pairs-meta/         GET /pairs/meta (Binance REST + cache + mock fallback)
└── shared/                 backoff, logger interface

mobile/src/
├── app/                    Expo Router routes: thin, one line per screen
├── core/                   theme tokens, env, storage, formatters (no React features)
├── shared/ui/              design-system components (AppText, Button, FlashingNumber…)
└── features/
    ├── market-stream/      socket, tick buffer, market/connection stores, lifecycle
    ├── connection/         status badge + offline/reconnect banner
    ├── pairs-meta/         /pairs/meta client + persisted store
    ├── favourites/         persisted favourites + toggle
    ├── watchlist/          Markets screen, search/filter
    ├── market-details/     Terminal screen: price, stats, order book
    ├── market-depth/       Skia depth chart + liquidity/pressure readouts
    ├── telemetry/          FPS / throughput / heap sampling + dashboard
    ├── settings/           throttling controls synced to the gateway
    └── app-shell/          tab bar, drawer, FocusGate
```

The dependency direction is `app → features → shared/core`, never the reverse. On the backend, `market-ingest` produces normalised `MarketEvent`s and knows nothing about clients. `broadcast` reads the store and knows nothing about Binance. Swapping in a different exchange means adding one `MarketSource`.

---

## Backend

### Buffering and back-pressure strategy

**Goal:** Binance can deliver hundreds of events per second, and clients may be fast, slow or stalled. Memory must stay bounded regardless, and every client should see the *latest* state rather than a backlog of stale ones.

**1. Conflation at ingest (latest-value-wins).**
`MarketStateStore` holds exactly one state per pair. Each upstream event (depth snapshot, trade, 24h ticker) overwrites that pair's state in O(1) and bumps a **version counter**. Nothing is queued, so memory is `pairs × depth` whatever the feed rate.

**2. Lazy, shared derivation.**
The derived `PairTick` (spread, notional-weighted buy/sell pressure, 24h change) and its JSON encoding are computed **at most once per version**, on first read, and reused by every client. With 1,000 clients a pair is still serialised once per change.

**3. Pull-based, per-client batching.**
Each connection has a `ClientSession` with its own timer (default **100ms**, configurable per client from 10–1000ms). On each tick it compares the store's versions with the versions it last sent, collects only the pairs that changed, and writes **one** frame containing that batch (`{"type":"update","data":[…]}`). The frame is assembled from the cached per-pair JSON strings. If nothing changed, nothing is sent.

**4. Back-pressure via `bufferedAmount`.**
Before writing, the session checks the socket's `bufferedAmount` (bytes the kernel hasn't accepted yet):

| Condition | Action |
|---|---|
| `bufferedAmount > HIGH_WATER_MARK_BYTES` (256 KB) | **Skip** this frame. Nothing is lost: the next frame carries the newest state, because the version comparison still sees the change. |
| Above the high-water mark continuously for `SLOW_CONSUMER_TIMEOUT_MS` (15 s) | Disconnect with close code **1013** ("try again later"). |
| `bufferedAmount > MAX_BUFFERED_BYTES` (4 MB) | Disconnect immediately. |

After sending the close frame the socket is force-terminated after 1 s: the close frame sits behind the backlog the client isn't reading, so the handshake may never finish. **The memory a slow client can pin is therefore capped at `MAX_BUFFERED_BYTES`.**

**5. Adaptive mode (optional, per client).**
When the client enables "Adaptive Polling Strategy", a congested session doubles its interval (up to 1000ms) instead of only skipping frames, then halves it back after 10 healthy flushes. The effective interval is reported in every update frame.

**6. Liveness.**
- Upstream: a stale-data watchdog reconnects if Binance is silent for 10 s (half-open TCP), using jittered exponential backoff. Binance's 24-hour disconnect is just another reconnect.
- Downstream: protocol-level ping every 15 s; clients that miss a pong are terminated.

Verified with the bundled load test (`npm run loadtest -w backend`). Configuration: 50 normal clients plus 5 clients that stop reading their socket, a synthetic feed at 2,000 events/s per pair, and a 10ms interval. Result: normal clients kept receiving ~90 frames/s each, frames for the stalled clients were skipped (3,870), all 5 were disconnected at the 5 s test timeout, and server RSS stayed flat at about 170–180 MB.

### WebSocket protocol

Endpoint: `ws://<host>:8080/ws`. JSON text frames. All types are in [`packages/contracts/src/index.ts`](packages/contracts/src/index.ts).

**Server → client**

| `type` | When | Payload |
|---|---|---|
| `hello` | on connect | `protocolVersion`, `pairs`, current `config`, `compressionAvailable`, `upstream` |
| `snapshot` | right after `hello` | `seq`, `serverTime`, `data: PairTick[]` (every ready pair) |
| `update` | every interval, only if something changed | `seq`, `serverTime`, `effectiveIntervalMs`, `data: PairTick[]` (changed pairs only) |
| `config` | after `configure` | the applied `config` (values are clamped) |
| `pong` | after `ping` | `id`, `clientTime`, `serverTime` (client computes RTT) |
| `upstream` | Binance link changes | `status`: `connecting` / `connected` / `reconnecting` / `down` |
| `error` | bad client message | `code`, `message` |

`PairTick`:

```json
{
  "pair": "BTCUSDT",
  "timestamp": 1793940532988,
  "price": 75782.01,
  "change24h": -6.03,
  "high24h": 80794.01,
  "low24h": 75208.42,
  "volume24h": 26591.85,
  "bestBid": 75782.0,
  "bestAsk": 75782.01,
  "spread": 0.01,
  "spreadPct": 0.000013,
  "buyPressure": 89.8,
  "sellPressure": 10.2,
  "bids": [[75782.0, 5.06995], [75781.99, 0.14141]],
  "asks": [[75782.01, 0.37312], [75782.02, 0.0012]]
}
```

- `price` is the last traded price (from `aggTrade`), falling back to the mid price.
- `change24h` is recomputed on every trade from the rolling 24h open, so it moves in real time rather than once a second.
- `buyPressure` / `sellPressure` are the share of resting **notional** (price × qty) on each side of the visible book. They always sum to 100.
- Book levels are `[price, qty]` tuples, which are about 40% smaller on the wire than objects. Bids are sorted best-first (descending); asks best-first (ascending).

**Client → server**

```jsonc
{ "type": "configure", "intervalMs": 250, "adaptive": true, "compress": false } // all fields optional
{ "type": "ping", "id": 1, "clientTime": 1793940532000 }
```

Inbound frames are capped at 4 KB and validated. Invalid frames get an `error` reply and never crash the session.

### REST API

`GET /pairs/meta`:

```json
{
  "source": "binance",
  "updatedAt": 1793940532846,
  "pairs": [
    {
      "symbol": "BTCUSDT", "displayName": "BTC / USDT", "baseAsset": "BTC", "quoteAsset": "USDT",
      "status": "TRADING", "lastPrice": 75782, "change24h": -6.033,
      "high24h": 80794.01, "low24h": 75208.42, "volume24h": 26591.85, "marketCap": 1500483600000
    }
  ]
}
```

Data comes from Binance `ticker/24hr` + `exchangeInfo`. It is cached for 10 s and concurrent requests are coalesced into one upstream call. If Binance REST is unreachable, the endpoint serves values derived from the live stream with `"source": "mock"` and doesn't cache the failure. **Market cap is mocked** (last price × a hard-coded circulating supply).

`GET /health` returns upstream status, ready pairs, client count, frames sent/skipped, slow-consumer disconnects, uptime and RSS.

### Configuration

All settings are environment variables, validated at startup; the server fails fast on bad values. See [`backend/.env.example`](backend/.env.example). The main ones:

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | HTTP + WS |
| `PAIRS` | `BTCUSDT,ETHUSDT,SOLUSDT,DOGEUSDT,XRPUSDT` | any Binance spot symbols |
| `MARKET_SOURCE` | `binance` | `synthetic` for offline/stress |
| `BROADCAST_INTERVAL_MS` | `100` | default per-client interval |
| `MIN_INTERVAL_MS` / `MAX_INTERVAL_MS` | `10` / `1000` | range clients may request |
| `HIGH_WATER_MARK_BYTES` | `262144` | skip frames above this |
| `MAX_BUFFERED_BYTES` | `4194304` | hard disconnect above this |
| `SLOW_CONSUMER_TIMEOUT_MS` | `15000` | disconnect if congested this long |
| `DEPTH_LEVELS` | `20` | 5, 10 or 20 |

---

## Mobile app

Screens follow the supplied mockups and design system: Primary `#0B0E14`, Secondary `#00C57A`, Tertiary `#FF3B69`, Neutral `#1E2633`; Hanken Grotesk for headlines, Inter for body text, JetBrains Mono for labels and numbers.

| Tab | What it does |
|---|---|
| **Terminal** | Selected pair: last price (flashes green/red), 24h change, high/low, market cap, spread, buy/sell pressure bar, last-updated timestamp, live bids and asks with animated depth bars, Skia market-depth chart with liquidity-gap and pressure readouts. |
| **Markets** | Watchlist of every pair: price, 24h change, live indicator and favourite star. Search (case- and separator-insensitive: `btc`, `BTC/USDT`, `btc usdt`), an All / Favourites filter with favourites pinned first, and pull-to-refresh of `/pairs/meta` that doesn't touch the live socket. |
| **Telemetry** | Messages/s, KB/s, ticks/s, store commits/s, JS FPS, Hermes heap, RTT, requested vs effective interval, compression, reconnects, silence. |
| **Settings** | **Working** throttling controls: an update-interval slider (10–1000ms) sent to the gateway per client, a compression toggle (permessage-deflate) and an adaptive back-off toggle. All are persisted and re-applied after every reconnect. Below them, the performance dashboard (FPS ring, message rate, heap sparkline) and system info cards. |

The drawer (Pro Trader, API Keys…) is a presentational placeholder. Authentication is out of scope.

### How the UI stays smooth under bursts

1. **The server already conflates**, so the app receives at most one frame per interval.
2. **Client-side conflation per animation frame.** `TickBuffer` keeps the latest tick per pair and commits to the store at most **once per `requestAnimationFrame`**. React sees at most one state change per frame, however bursty the socket is.
3. **Narrow subscriptions.** The zustand store replaces only the changed pair's object. Each row is split into tiny subscribers (price, change, live dot) that select a single primitive, so an ETH update re-renders nothing for BTC, and a price change doesn't re-render the name or the star.
4. **Animations on the UI thread.** Price flashes, order-book depth bars, the pressure bar and the depth chart tween are Reanimated worklets or Skia paths derived on the UI thread. A busy JS thread can delay *data*, but it can't make an animation stutter.
5. **Hidden tabs do no work.** `freezeOnBlur` plus `FocusGate` unmount the live content of tabs that aren't visible, removing their subscriptions entirely.
6. **Cheap hot paths.** Hand-rolled number formatting (Hermes `Intl` is comparatively slow); stable order-book row slots keyed by depth index, so rows update in place; `FlashList` for the watchlist.
7. **Hot-path metrics are plain mutable counters, not state**, sampled once per second by the telemetry feature.

### Offline and reconnect behaviour

- One user-facing status combines both hops (device → gateway and gateway → Binance): **LIVE**, **DELAYED** (gateway up, exchange feed reconnecting), **CONNECTING**, **RECONNECTING** (with a retry countdown and a manual **RETRY** button), **OFFLINE** (no network, via NetInfo) and **PAUSED** (app in background).
- The last received data stays on screen, with a banner showing when data last arrived.
- Reconnect uses jittered exponential backoff (0.5 s → 15 s). It doesn't retry while the device is offline, and reconnects **immediately** when connectivity returns or the app comes to the foreground.
- An app-level ping every 5 s measures RTT and doubles as a watchdog: 12 s of silence means a half-open socket, so the app reconnects.
- Last ticks are written to AsyncStorage when the app goes to the background, so a cold start while offline still shows data. Pair metadata and favourites are persisted too.

---

## Testing and verification

**Automated tests: 68 in total.**

- Backend (Vitest, 38): order-book metrics, conflation and version semantics, JSON caching, Binance frame parsing including malformed input, reconnect with backoff against a fake upstream, synthetic feed, slow-consumer skip/disconnect/timeout, adaptive back-off and recovery, protocol validation, `/pairs/meta` mapping, caching, coalescing and mock fallback, plus an **end-to-end test** (synthetic feed → store → gateway → real `ws` client: hello, snapshot, updates, configure, ping, invalid input, 404 path).
- Mobile (Jest, 30): `MarketSocket` (connected only after hello, backoff and reset, offline pause and immediate resume, background pause, config re-applied after reconnect, stale-socket watchdog, malformed frames), `TickBuffer` conflation, watchlist search and filter, depth-curve maths, connection-state mapping, telemetry rate maths.

**Manual verification on the Android emulator** (Pixel 9 Pro AVD, Expo Go, live Binance data):

- All four tabs render as in the mockups with live data.
- Favourites persist across restarts.
- Search filters as you type.
- Stopping the backend shows **RECONNECTING** while keeping the last data on screen; restarting it returns the app to **LIVE** without user action.
- Moving the interval slider to 10ms changes the server's per-client interval end to end (the Telemetry tab shows *requested 10ms / effective 10ms*).
- Profiling the JS handlers on the emulator measured about **0.05ms per socket message** and **under 4ms per store commit**. Telemetry showed 45–59 JS FPS at the default 100ms with a production bundle. The emulator's own CPU and graphics overhead (qemu at ~450% host CPU) makes its FPS numbers noisy. **Measure on a physical device for representative figures.**

---

## Assumptions

- "Order book updates" are served from Binance's **partial book depth** stream (top 20 levels, every 100ms) rather than a locally maintained full book (see Trade-offs).
- The five required USDT pairs are the default set; any Binance spot symbols can be configured with `PAIRS`.
- Market cap isn't available from Binance's public API, so it is **mocked**. `/pairs/meta` falls back to stream-derived data when Binance REST is unreachable, as the brief allows mocking.
- The app is a viewer only: no authentication, orders or account data. The drawer is decorative.
- Some mockup cards show web-only concepts (WebGL, IndexedDB). They show real equivalents for this app instead (Skia rendering, AsyncStorage usage, measured ping).
- Local development uses plain `ws://` / `http://`. A deployment would sit behind TLS (`wss://`).

## Trade-offs

| Decision | Why | Cost / alternative |
|---|---|---|
| **Partial depth stream** (`depth20@100ms`) instead of diff-depth plus a REST snapshot | Always consistent and self-healing (every message is a full top-N snapshot); no sequence-gap handling | Limited to 20 levels and 100ms granularity. A full local book (diff stream with `lastUpdateId` sync) would give deeper books and exact deltas at the cost of considerably more complexity. |
| **Latest-value conflation** instead of queueing every update | Bounded memory, clients always see current state, slow clients can't hurt others | Intermediate states are intentionally dropped. That's fine for a market *viewer*, not for consumers that need every event (e.g. a trade tape), which would need a bounded ring buffer per client. |
| **Per-client timers** instead of one global broadcast tick | Enables per-client intervals and adaptive back-off | One timer per client. That is fine for thousands of clients; at much larger scale, group clients by interval into shared ticks. |
| **JSON** instead of a binary format | Debuggable, documented, works everywhere; permessage-deflate (level 1) shrinks frames considerably | More CPU per byte than MessagePack/Protobuf. The protocol is versioned (`protocolVersion`), so a binary encoding can be added later. |
| **Compression on by default** | Mobile bandwidth matters more than server CPU at these volumes | About 300 KB of zlib context per client; clients can turn it off. |
| **zustand + rAF batching** instead of Redux/Context | Minimal boilerplate, selector-level subscriptions, easy to reason about | Less structure and tooling than Redux Toolkit for very large teams. |
| **Expo / Expo Go** | Fast setup for reviewers, no native build needed; every native module used is in Expo Go | Production builds would use a development build or EAS; Expo Go is for evaluation. |
| **Mobile outside the npm workspace** | Avoids React Native's well-known hoisting issues in monorepos; contracts are consumed from source through a Metro resolver and a `tsconfig` path | Two installs (`npm install` + `npm run mobile:install`). |
| **Single gateway instance** | Matches the brief | Scaling out would put a pub/sub layer (e.g. Redis or NATS) between ingest and broadcast. The ingest → store → broadcast split already allows this. |

---

## How AI-assisted development tools were used

This project was built with **Claude Code** (Anthropic) as an agentic pair programmer, working in my local repository and Android emulator. How the work was split:

**What I did:** supplied the brief and the UI mockups; chose the architecture direction (feature-based structure for both apps, commits in small logical steps); reviewed the plan before any code was written; reviewed the output; made the decisions on the open questions.

**What the AI did:**

- **Planning.** It read the brief, proposed a plan for the monorepo, the buffering strategy and the protocol, then revised it once the mockups arrived (adding the Telemetry and Settings features and turning the mockup's throttling controls into real per-client server settings).
- **Implementation.** It wrote the backend, contracts and mobile code feature by feature, checking current docs where its knowledge could be stale (Expo SDK 58 Router, drawer and Reanimated setup; Skia 2.x's move to `PathBuilder`, found through type errors).
- **Verification.** It ran the test suites and type checks after each step; load-tested the gateway with stalled clients; ran the app on the Android emulator and inspected screenshots; profiled the JS handlers.
- **Bugs caught by running the app,** not by tests:
  - The 24h change number was clipped because JetBrains Mono has no ▲/▼ glyphs.
  - Market cap stayed empty until the Markets tab was opened.
  - Spreads rounded to `0.0000%`.
  - The offline banner showed connect time instead of last-data time.
  - Hidden tabs still rendered updates under `freezeOnBlur`.
  - Slow consumers lingered because their close frame queued behind the backlog.

Everything was reviewed before committing. The AI's role is stated here because the brief asks how these tools were used.
