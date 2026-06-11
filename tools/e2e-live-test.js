// End-to-end smoke test against the LIVE deployment.
//   node tools/e2e-live-test.js
//
// Verifies the deployed backend (Render) end to end: HTTPS reachability, auth
// (register/login/me), CORS for the Vercel origin, and — most importantly —
// live CROSS-ORIGIN WebSocket messaging (STOMP CONNECT with the Vercel Origin,
// create channel, subscribe, send, receive the broadcast). Tolerates Render
// free-tier cold starts with retries. Test data uses a unique "test-e2e-"
// prefix; the created channel is deleted at the end (no self-delete endpoint
// exists, so the throwaway user remains but is clearly labelled).
//
// `ws` is required for the WebSocket Origin header (Node's global WebSocket
// can't set it), which is exactly what exercises the WS origin allowlist.

const path = require('path')
const https = require('https')
// `ws` lets us set the handshake Origin header (Node's global WebSocket can't),
// which is what exercises the WS origin allowlist. Install once if missing:
//   (cd frontend && npm i ws --no-save)
let WebSocket
try { WebSocket = require(path.resolve(__dirname, '../frontend/node_modules/ws')) }
catch {
  try { WebSocket = require('ws') }
  catch { console.error('Missing "ws". Install it: (cd frontend && npm i ws --no-save)'); process.exit(1) }
}

const BACKEND = process.env.BACKEND || 'https://ripplechat-backend.onrender.com'
const ORIGIN = process.env.ORIGIN || 'https://ripplechat-app.vercel.app'
const WS_URL = BACKEND.replace(/^http/, 'ws') + '/ws' // raw STOMP-over-WebSocket endpoint

const NUL = String.fromCharCode(0)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function check(label, ok, detail) {
  results.push(ok)
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`)
  return ok
}
function safeJson(t) { try { return JSON.parse(t) } catch { return null } }

// ── STOMP framing ─────────────────────────────────────────────────────────────
function frame(command, headers = {}, body = '') {
  return `${command}\n${Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${body}${NUL}`
}
function parseFrames(data) {
  return data.split(NUL).filter((f) => f.trim().length > 0).map((raw) => {
    const [head, ...bodyParts] = raw.replace(/^\n+/, '').split('\n\n')
    const lines = head.split('\n')
    const command = lines.shift()
    const headers = {}
    for (const line of lines) { const i = line.indexOf(':'); if (i > -1) headers[line.slice(0, i)] = line.slice(i + 1) }
    return { command, headers, body: bodyParts.join('\n\n') }
  })
}

// ── REST (global fetch) ───────────────────────────────────────────────────────
async function api(method, p, { token, body } = {}) {
  const res = await fetch(BACKEND + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const text = await res.text()
  return { status: res.status, json: text ? safeJson(text) : null }
}

// Retry the first hit so a cold Render instance (sleeping) gets time to wake.
async function waitForBackend() {
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(BACKEND + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: '', password: '' }), signal: AbortSignal.timeout(25000),
      })
      return res.status
    } catch (e) {
      console.log(`  …backend not ready (attempt ${i + 1}): ${e.message} — waiting 15s for cold start`)
      await wait(15000)
    }
  }
  throw new Error('backend unreachable after retries')
}

// CORS preflight via raw https so we control the (browser-forbidden) Origin header.
function corsPreflight() {
  return new Promise((resolve) => {
    const u = new URL(BACKEND + '/api/users/me')
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'OPTIONS', timeout: 30000,
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
    }, (res) => { res.resume(); resolve({ status: res.statusCode, acao: res.headers['access-control-allow-origin'] }) })
    req.on('error', (e) => resolve({ error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }) })
    req.end()
  })
}

// ── WebSocket connect with a chosen Origin ──────────────────────────────────────
function wsConnect(token, origin) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { origin, handshakeTimeout: 30000 })
    let settled = false
    const done = (fn, arg) => { if (!settled) { settled = true; clearTimeout(timer); fn(arg) } }
    const timer = setTimeout(() => done(reject, new Error('WS connect timeout')), 40000)
    ws.on('open', () => ws.send(frame('CONNECT', { 'accept-version': '1.2', host: 'localhost', Authorization: `Bearer ${token}` })))
    ws.on('message', (data) => {
      for (const f of parseFrames(data.toString())) {
        if (f.command === 'CONNECTED') done(resolve, ws)
        if (f.command === 'ERROR') { ws.terminate(); done(reject, new Error('STOMP ERROR: ' + (f.headers.message || ''))) }
      }
    })
    ws.on('unexpected-response', (_req, res) => { done(reject, new Error('handshake HTTP ' + res.statusCode)) })
    ws.on('error', (e) => done(reject, e))
  })
}

async function main() {
  console.log(`\nLive E2E — backend ${BACKEND}\n              origin  ${ORIGIN}\n`)
  const uniq = `test-e2e-${Date.now()}`
  const creds = { username: uniq, email: `${uniq}@example.com`, displayName: 'E2E Test', password: 'Test12345!' }
  let token = null
  let channelId = null

  // 1. Reachability / HTTPS
  console.log('1) Reachability')
  let status
  try { status = await waitForBackend() } catch (e) { check('backend reachable over HTTPS', false, e.message); return finish() }
  check('backend reachable over HTTPS', true, `login probe returned ${status}`)

  // 2. Auth
  console.log('2) Auth')
  const reg = await api('POST', '/api/auth/register', { body: creds })
  check('register -> 201 + accessToken', reg.status === 201 && !!reg.json?.accessToken, `status ${reg.status}`)
  token = reg.json?.accessToken
  const login = await api('POST', '/api/auth/login', { body: { login: creds.username, password: creds.password } })
  check('login -> 200 + accessToken', login.status === 200 && !!login.json?.accessToken, `status ${login.status}`)
  token = login.json?.accessToken || token
  const me = await api('GET', '/api/users/me', { token })
  check('/api/users/me -> correct user', me.status === 200 && me.json?.username === creds.username, `got ${me.json?.username}`)

  // 3. CORS for the Vercel origin
  console.log('3) CORS (Vercel origin)')
  const cors = await corsPreflight()
  if (cors.error) check('CORS preflight allows Vercel origin', false, cors.error)
  else check('CORS preflight allows Vercel origin', cors.acao === ORIGIN, `status ${cors.status}, Allow-Origin: ${cors.acao ?? '(none)'}`)

  // 4. Live cross-origin WebSocket
  console.log('4) WebSocket (cross-origin, Vercel Origin)')
  if (!token) { check('WS connect (skipped: no token)', false); return finish() }
  let ws
  try {
    ws = await wsConnect(token, ORIGIN)
    check('WS CONNECT accepted for Vercel origin', true)
  } catch (e) {
    check('WS CONNECT accepted for Vercel origin', false, e.message + ' (check APP_ALLOWED_ORIGINS on Render)')
    return finish()
  }

  // create a channel, subscribe, send, receive the broadcast
  const ch = await api('POST', '/api/channels', { token, body: { name: uniq } })
  channelId = ch.json?.id
  check('create channel -> 201 + id', ch.status === 201 && !!channelId, `status ${ch.status}`)

  if (channelId) {
    const marker = `live-e2e ping ${Date.now()}`
    const received = new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 15000)
      ws.on('message', (data) => {
        for (const f of parseFrames(data.toString())) {
          if (f.command === 'MESSAGE') {
            const m = safeJson(f.body)
            if (m && m.content === marker) { clearTimeout(t); resolve(m) }
          }
        }
      })
    })
    ws.send(frame('SUBSCRIBE', { id: 'sub-0', destination: `/topic/channels/${channelId}` }))
    await wait(500)
    ws.send(frame('SEND', { destination: `/app/channels/${channelId}/send`, 'content-type': 'application/json' }, JSON.stringify({ content: marker })))
    const msg = await received
    check('live message round-trip over WS', !!msg, msg ? 'received broadcast' : 'no broadcast within 15s')
  }

  try { ws.close() } catch {}

  // 4b. Negative origin — the allowlist should reject a foreign origin
  console.log('4b) WebSocket negative origin (should be rejected)')
  try {
    const badWs = await wsConnect(token, 'https://evil.invalid.example')
    try { badWs.close() } catch {}
    check('foreign origin rejected', false, 'CONNECTED with a foreign origin — APP_ALLOWED_ORIGINS may be too permissive')
  } catch (e) {
    check('foreign origin rejected', true, e.message)
  }

  // Cleanup: delete the test channel (no self-delete endpoint for the user).
  console.log('5) Cleanup')
  if (channelId) {
    const del = await api('DELETE', `/api/channels/${channelId}`, { token })
    check('test channel deleted', del.status === 204 || del.status === 200, `status ${del.status}`)
  }
  console.log(`   note: throwaway user "${creds.username}" remains (no user self-delete endpoint).`)

  finish()
}

function finish() {
  const passed = results.filter(Boolean).length
  const ok = results.length > 0 && results.every(Boolean)
  console.log(`\nRESULT: ${passed}/${results.length} checks passed — ${ok ? 'ALL PASS ✅' : 'FAIL ❌'}`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
