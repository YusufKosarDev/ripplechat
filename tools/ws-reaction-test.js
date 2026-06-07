// Verifies live emoji reactions over WebSocket/STOMP: a member's reaction
// reaches other members on /topic/channels/{id}/reactions, and a non-member's
// reaction is rejected. Run: node tools/ws-reaction-test.js
// Set BASE=http://localhost:5173 to exercise the frontend's Vite proxy path.

const BASE = process.env.BASE || 'http://localhost:8081'
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws'
const NUL = String.fromCharCode(0)

function frame(command, headers = {}, body = '') {
  const head = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n')
  return `${command}\n${head}\n\n${body}${NUL}`
}

function parseFrames(data) {
  return data.split(NUL).filter((f) => f.trim().length > 0).map((raw) => {
    const [head, ...bodyParts] = raw.replace(/^\n+/, '').split('\n\n')
    const lines = head.split('\n')
    const command = lines.shift()
    const headers = {}
    for (const line of lines) {
      const idx = line.indexOf(':')
      if (idx > -1) headers[line.slice(0, idx)] = line.slice(idx + 1)
    }
    return { command, headers, body: bodyParts.join('\n\n') }
  })
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => ws.send(frame('CONNECT',
      { 'accept-version': '1.2', host: 'localhost', Authorization: `Bearer ${token}` }))
    ws.onmessage = (ev) => {
      for (const f of parseFrames(ev.data.toString())) {
        if (f.command === 'CONNECTED') resolve(ws)
        if (f.command === 'ERROR') reject(new Error(f.headers.message || 'STOMP ERROR'))
      }
    }
    ws.onerror = () => reject(new Error('WebSocket error'))
  })
}

async function api(path, method, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}

async function auth(username, email, password) {
  const reg = await api('/api/auth/register', 'POST', null, { username, email, displayName: username, password })
  if (reg.status === 201) return reg.json.accessToken
  return (await api('/api/auth/login', 'POST', null, { login: username, password })).json.accessToken
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function sendReaction(ws, channelId, emoji) {
  ws.send(frame('SEND',
    { destination: `/app/channels/${channelId}/reaction`, 'content-type': 'application/json' },
    JSON.stringify({ emoji })))
}

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')
  const cypher = await auth('cypher', 'cypher@ripplechat.io', 'redpill1')

  const ch = await api('/api/channels', 'POST', neo, { name: 'reactions-' + Date.now() })
  const channelId = ch.json.id
  await api(`/api/channels/${channelId}/join`, 'POST', trinity)
  console.log('channel:', channelId, '(neo owner, trinity member, cypher not a member)')

  const events = []
  const observer = await connect(trinity)
  observer.send(frame('SUBSCRIBE', { id: 'r', destination: `/topic/channels/${channelId}/reactions` }))
  observer.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') events.push(JSON.parse(f.body))
    }
  }
  await wait(400)

  const neoWs = await connect(neo)
  sendReaction(neoWs, channelId, '🌊')
  sendReaction(neoWs, channelId, '🔥')
  await wait(700)

  const cypherWs = await connect(cypher)
  sendReaction(cypherWs, channelId, '💀')
  await wait(700)

  const gotWave = events.some((e) => e.username === 'neo' && e.emoji === '🌊')
  const gotFire = events.some((e) => e.username === 'neo' && e.emoji === '🔥')
  const intruderLeaked = events.some((e) => e.username === 'cypher')

  console.log('events:', JSON.stringify(events))
  console.log('member reaction 🌊 received:', gotWave)
  console.log('member reaction 🔥 received:', gotFire)
  console.log('cypher (non-member) leaked (should be false):', intruderLeaked)

  observer.close()
  const pass = gotWave && gotFire && !intruderLeaked
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
