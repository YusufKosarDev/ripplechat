# Feasibility note — Group voice/video calls (SFU)

> **Status: design note, not shipped.** Group calling needs a media server that
> forwards RTP between participants. That is an external, always-on service with
> UDP media ports, TURN relays and TLS — it cannot be meaningfully stood up or
> exercised inside this repo's dev environment (Docker Compose with Postgres +
> Redis + Elasticsearch), so this step is delivered as a grounded architecture
> plan rather than code. The pieces that *can* live in this repo (signaling shape,
> token minting, room model, the React call surface) are described so the work is
> a drop-in when a media server is available.

## 1. What exists today (1:1 peer-to-peer)

The current calls are a clean **1:1 mesh of exactly one edge**:

- `frontend/src/hooks/useWebRTC.ts` holds a **single** `RTCPeerConnection`
  (`pcRef`), a **single** `remoteStream`, and a single `peerId`. Offer/answer/ICE
  and hang-up flow through `handleIncomingSignal`. Screen share swaps the outgoing
  video track with `replaceTrack` (no renegotiation).
- `frontend/src/components/CallModal.tsx` drives one call between the local user
  and one `peerId`.
- Backend signaling is already **channel-scoped, not pair-scoped**:
  `websocket/CallController.java` receives `/app/channels/{channelId}/call` and
  re-broadcasts a `CallSignal` (`websocket/dto/CallSignal.java`:
  `type, senderId, receiverId, payload`) to `/topic/channels/{channelId}/calls`
  via the Redis-backed broadcaster. The server is a **dumb relay** — it never
  touches media, only forwards SDP/ICE JSON.

The signaling transport is therefore *already* multi-party capable (a topic fan-out
with a `receiverId` for targeting). The 1:1 limitation lives entirely in the
**client** (one peer connection, one remote stream) and in the absence of a
**room/participant model**.

## 2. Why "just loop the mesh" doesn't scale

The cheapest path is a **full P2P mesh**: every participant opens an
`RTCPeerConnection` to every other participant. It needs **no media server** and
would reuse today's signaling almost verbatim.

The cost is uplink and CPU. With `N` participants each client:

- maintains `N-1` peer connections,
- **encodes and uploads its camera `N-1` times** (once per peer),
- decodes `N-1` incoming streams.

Upstream bandwidth and encode load grow **linearly per client** and the whole call
grows `O(N²)` in connections. In practice mesh is fine for **3–4 people** and
falls over beyond that (a 720p stream is ~1.5–2.5 Mbps; at N=5 that's ~10 Mbps
uplink per participant, which most home connections and laptop encoders can't
sustain). So mesh is a legitimate **small-group** feature, but not "group calls".

## 3. The real answer: an SFU

A **Selective Forwarding Unit** flips the topology. Each participant sends **one**
upstream to the server; the SFU **selectively forwards** that stream to the other
participants. Per client it's **1 upload + (N-1) downloads**, regardless of group
size — the server absorbs the fan-out. This is how Meet/Zoom/Discord/Slack scale.

| Topology | Media server | Client uplink | Scales to | In-repo feasible |
|----------|-------------|---------------|-----------|------------------|
| **Mesh (P2P)** | none | `N-1` copies | 3–4 | ✅ yes |
| **SFU** | forwards RTP | 1 copy | dozens | ❌ needs external server |
| **MCU** | decodes + mixes | 1 copy | dozens (heavy server CPU) | ❌ needs external server + GPU/CPU |

An SFU (not an MCU) is the right choice: forwarding is far cheaper than mixing, and
clients keep per-stream control (mute, active-speaker, simulcast layer selection).

### Candidate servers
- **LiveKit** — Go, open-source, first-class server SDKs incl. **Java**, room +
  token model, simulcast, recording. Best fit for a Spring backend.
- **mediasoup** — Node library; most control, but you build the room service.
- **Janus** / **Jitsi Videobridge** — mature C/Java SFUs, heavier to operate.
- **Pion** — Go WebRTC toolkit if we wanted to build a bespoke SFU (most work).

**Recommendation: LiveKit**, because it ships a Java server SDK (token minting and
room admin fit naturally in a Spring `@Service`) and moves the hard real-time media
problem out of our JVM.

## 4. Integration plan (when a media server is available)

The design deliberately keeps our backend as a **control plane** (auth, rooms,
tokens) and delegates the **media plane** to the SFU.

### Backend (`call` package, new)
1. **Config / graceful-disable** — `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
   `LIVEKIT_API_SECRET`. Absent ⇒ group calls report disabled and the endpoint
   returns 503, exactly like the AI/Cloudinary/VAPID/Giphy features already do.
   (Mirror `ai/AiSummaryService`'s null-client pattern.)
2. **Room model** — a call room keyed by `channelId` (or an ad-hoc DM room). A
   membership check reusing the existing `ChannelMembershipRepository` gates who
   may join — same authority model as messaging.
3. **`GET /api/channels/{id}/call/token`** — verify membership, then mint a
   short-lived LiveKit **access token** (identity = username, room = channelId,
   grants = join/publish/subscribe) with the LiveKit Java SDK. The browser never
   sees the API secret.
4. **Presence/roster** — reuse STOMP: broadcast `participant_joined/left` on a
   `/topic/channels/{id}/call-roster` topic so the UI shows who's in the call
   without polling the SFU.

### Frontend
1. **Generalize the call surface** from one `remoteStream` to a **map of
   participant → stream**. `useWebRTC`'s single-peer state becomes a roster; the
   grid renders one tile per participant. Screen-share (`replaceTrack`) and
   mute/video toggles carry over unchanged.
2. **Use the LiveKit client SDK** (`livekit-client`) instead of hand-rolling the
   `RTCPeerConnection` for group mode: fetch the token from step 3, `room.connect`,
   subscribe to tracks. Keep the current hand-rolled 1:1 path as the **mesh
   fallback** for 2-person calls (no server round-trip needed).
3. **Active-speaker + simulcast** — LiveKit exposes speaking events and layer
   selection; the grid highlights the speaker and requests lower layers for
   off-screen tiles.

### Infrastructure (the part this environment can't provide)
- An always-on **SFU deployment** with public UDP media ports (or a **TURN**
  server for restrictive NATs — `coturn`), plus TLS for the signaling/WS control.
- Capacity planning: an SFU is bandwidth-bound; a single node forwards many
  streams, so this is a real ops surface (autoscaling, region selection, recording
  storage) — precisely why it's out of scope for a Compose-based dev repo.

## 5. Suggested increments

1. **Mesh group calls (≤4), in-repo** — generalize `useWebRTC` to N peers over the
   *existing* signaling; ship a capped small-group call with **zero new infra**.
   This is the honest, immediately-buildable slice.
2. **SFU behind a feature flag** — add the LiveKit `call` package + token endpoint
   (graceful-disabled without credentials), swap the client to the LiveKit SDK for
   `N>2`, keep mesh for 1:1. Enable once a LiveKit instance exists.

Increment 1 is the only part exercisable here; increment 2 is specified above and
becomes a wiring task once a media server is provisioned.
