// Verifies /poll over WebSocket/STOMP: poll creation broadcasts to members,
// votes update vote counts in realtime, and the REST rehydration endpoint
// returns active polls. Run: node tools/ws-poll-test.js
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

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')

  const ch = await api('/api/channels', 'POST', neo, { name: 'poll-' + Date.now() })
  const channelId = ch.json.id
  await api(`/api/channels/${channelId}/join`, 'POST', trinity)
  console.log('channel:', channelId)

  const updates = []
  const observer = await connect(trinity)
  observer.send(frame('SUBSCRIBE', { id: 'p', destination: `/topic/channels/${channelId}/polls` }))
  observer.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') updates.push(JSON.parse(f.body))
    }
  }
  await wait(300)

  const neoWs = await connect(neo)
  // create poll
  neoWs.send(frame('SEND',
    { destination: `/app/channels/${channelId}/poll`, 'content-type': 'application/json' },
    JSON.stringify({ question: 'En iyi içecek?', options: ['Çay', 'Kahve'] })))
  await wait(500)

  const created = updates[updates.length - 1]
  console.log('poll created broadcast:', created ? `"${created.question}" opts=${created.options.length} total=${created.totalVotes}` : 'NONE')
  const pollId = created?.id

  // neo votes option 0, trinity votes option 1
  neoWs.send(frame('SEND',
    { destination: `/app/channels/${channelId}/poll/${pollId}/vote`, 'content-type': 'application/json' },
    JSON.stringify({ optionId: '0' })))
  await wait(400)
  const trinityWs = await connect(trinity)
  trinityWs.send(frame('SEND',
    { destination: `/app/channels/${channelId}/poll/${pollId}/vote`, 'content-type': 'application/json' },
    JSON.stringify({ optionId: '1' })))
  await wait(500)

  const latest = updates[updates.length - 1]
  console.log('after votes:', JSON.stringify(latest?.options), 'total=', latest?.totalVotes)

  // REST rehydration
  const rest = await api(`/api/channels/${channelId}/polls`, 'GET', neo)
  console.log('GET /polls ->', rest.status, 'count=', rest.json?.length)

  observer.close()

  const pass =
    !!created && created.options.length === 2 &&
    latest && latest.totalVotes === 2 &&
    latest.options.find((o) => o.id === '0')?.votes === 1 &&
    latest.options.find((o) => o.id === '1')?.votes === 1 &&
    rest.status === 200 && rest.json.length === 1
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
