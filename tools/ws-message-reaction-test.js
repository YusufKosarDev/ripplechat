// Verifies persistent message reactions: toggle add/remove over WebSocket,
// realtime updates to other members, DB persistence via GET messages, and that
// non-members are rejected. Run: node tools/ws-message-reaction-test.js
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

function send(ws, dest, body) {
  ws.send(frame('SEND', { destination: dest, 'content-type': 'application/json' }, JSON.stringify(body)))
}

function lastFor(updates, messageId) {
  return [...updates].reverse().find((u) => u.messageId === messageId)
}

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')
  const cypher = await auth('cypher', 'cypher@ripplechat.io', 'redpill1')

  const ch = await api('/api/channels', 'POST', neo, { name: 'msgreact-' + Date.now() })
  const channelId = ch.json.id
  await api(`/api/channels/${channelId}/join`, 'POST', trinity)

  // neo posts a message; capture its id from the message broadcast.
  let messageId = null
  const neoWs = await connect(neo)
  neoWs.send(frame('SUBSCRIBE', { id: 'm', destination: `/topic/channels/${channelId}` }))
  const updates = []
  const observer = await connect(trinity)
  observer.send(frame('SUBSCRIBE', { id: 'mr', destination: `/topic/channels/${channelId}/message-reactions` }))
  observer.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') updates.push(JSON.parse(f.body))
    }
  }
  neoWs.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') { const m = JSON.parse(f.body); if (m.content === 'react to me') messageId = m.id }
    }
  }
  await wait(300)
  send(neoWs, `/app/channels/${channelId}/send`, { content: 'react to me' })
  await wait(500)
  console.log('messageId:', messageId)

  // neo adds 👍
  send(neoWs, `/app/channels/${channelId}/messages/${messageId}/reaction`, { emoji: '👍' })
  await wait(400)
  const afterNeo = lastFor(updates, messageId)
  console.log('after neo 👍:', JSON.stringify(afterNeo?.reactions))

  // trinity adds 👍 (count -> 2)
  const trinityWs = await connect(trinity)
  send(trinityWs, `/app/channels/${channelId}/messages/${messageId}/reaction`, { emoji: '👍' })
  await wait(400)
  const afterTrinity = lastFor(updates, messageId)
  console.log('after trinity 👍:', JSON.stringify(afterTrinity?.reactions))

  // neo toggles 👍 off (count -> 1, users [trinity])
  send(neoWs, `/app/channels/${channelId}/messages/${messageId}/reaction`, { emoji: '👍' })
  await wait(400)
  const afterToggleOff = lastFor(updates, messageId)
  console.log('after neo toggle off:', JSON.stringify(afterToggleOff?.reactions))

  // cypher (non-member) tries to react — should be rejected (no change)
  const cypherWs = await connect(cypher)
  send(cypherWs, `/app/channels/${channelId}/messages/${messageId}/reaction`, { emoji: '🔥' })
  await wait(500)
  const afterCypher = lastFor(updates, messageId)
  const cypherLeaked = afterCypher?.reactions.some((r) => r.emoji === '🔥')

  // persistence via REST
  const hist = await api(`/api/channels/${channelId}/messages`, 'GET', neo)
  const msg = hist.json.content.find((m) => m.id === messageId)
  const persisted = msg?.reactions?.find((r) => r.emoji === '👍')

  observer.close()

  const thumbs = (u) => u?.reactions.find((r) => r.emoji === '👍')
  const pass =
    !!messageId &&
    thumbs(afterNeo)?.count === 1 && thumbs(afterNeo).users.includes('neo') &&
    thumbs(afterTrinity)?.count === 2 &&
    thumbs(afterToggleOff)?.count === 1 && thumbs(afterToggleOff).users.includes('trinity') && !thumbs(afterToggleOff).users.includes('neo') &&
    !cypherLeaked &&
    persisted?.count === 1 && persisted.users.includes('trinity')

  console.log('persisted (REST):', JSON.stringify(persisted))
  console.log('cypher leaked (should be false):', cypherLeaked)
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
