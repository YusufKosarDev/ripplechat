// Verifies message search: only the user's member channels are searched,
// non-member channel results don't leak, deleted messages are excluded.
// Run with backend + dev up: node tools/search-test.js  (BASE=5173 for proxy)

const BASE = process.env.BASE || 'http://localhost:8081'
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws'
const NUL = String.fromCharCode(0)

function frame(c, h = {}, b = '') {
  return `${c}\n${Object.entries(h).map(([k, v]) => `${k}:${v}`).join('\n')}\n\n${b}${NUL}`
}
function parseFrames(data) {
  return data.split(NUL).filter((f) => f.trim().length > 0).map((raw) => {
    const [head, ...bodyParts] = raw.replace(/^\n+/, '').split('\n\n')
    const lines = head.split('\n'); const command = lines.shift(); const headers = {}
    for (const line of lines) { const i = line.indexOf(':'); if (i > -1) headers[line.slice(0, i)] = line.slice(i + 1) }
    return { command, headers, body: bodyParts.join('\n\n') }
  })
}
function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => ws.send(frame('CONNECT', { 'accept-version': '1.2', host: 'localhost', Authorization: `Bearer ${token}` }))
    ws.onmessage = (ev) => { for (const f of parseFrames(ev.data.toString())) { if (f.command === 'CONNECTED') resolve(ws); if (f.command === 'ERROR') reject(new Error(f.headers.message)) } }
    ws.onerror = () => reject(new Error('WS error'))
  })
}
async function api(path, method, token, body) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const t = await res.text(); return { status: res.status, json: t ? JSON.parse(t) : null }
}
async function auth(u, e, p) {
  const r = await api('/api/auth/register', 'POST', null, { username: u, email: e, displayName: u, password: p })
  if (r.status === 201) return r.json.accessToken
  return (await api('/api/auth/login', 'POST', null, { login: u, password: p })).json.accessToken
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function send(ws, dest, body) { ws.send(frame('SEND', { destination: dest, 'content-type': 'application/json' }, JSON.stringify(body))) }
const check = (label, cond) => { console.log(`${cond ? 'OK ' : 'FAIL'} ${label}`); return cond }

async function postAndId(ws, sub, channelId, content) {
  // sub is the subscription receiving /topic/channels/{id}; returns the new message id
  return new Promise((resolve) => {
    const handler = (ev) => {
      for (const f of parseFrames(ev.data.toString())) {
        if (f.command === 'MESSAGE') { const m = JSON.parse(f.body); if (m.content === content) { ws.removeEventListener?.('message', handler); resolve(m.id) } }
      }
    }
    ws.onmessage = handler
    send(ws, `/app/channels/${channelId}/send`, { content })
  })
}

async function main() {
  const uniq = Date.now().toString().slice(-5)
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')

  // Channel A: neo only. Channel B: trinity only.
  const term = 'zebra' + uniq
  const a = (await api('/api/channels', 'POST', neo, { name: 'A-' + uniq })).json.id
  const b = (await api('/api/channels', 'POST', trinity, { name: 'B-' + uniq })).json.id

  const neoWs = await connect(neo)
  neoWs.send(frame('SUBSCRIBE', { id: 'a', destination: `/topic/channels/${a}` }))
  await wait(200)
  await postAndId(neoWs, 'a', a, `hello ${term} world`)
  const delId = await postAndId(neoWs, 'a', a, `${term} to be deleted`)
  await wait(200)

  const trinityWs = await connect(trinity)
  trinityWs.send(frame('SUBSCRIBE', { id: 'b', destination: `/topic/channels/${b}` }))
  await wait(200)
  await postAndId(trinityWs, 'b', b, `secret ${term} in B`)
  await wait(300)

  const results = []
  // neo searches the term -> should find his A message(s), NOT trinity's B message
  let res = await api(`/api/search/messages?q=${term}`, 'GET', neo)
  results.push(check('search returns member-channel match', res.json.some((r) => r.content.includes('hello'))))
  results.push(check('non-member channel result excluded', !res.json.some((r) => r.channelId === b)))
  results.push(check('result has channel + sender + time', res.json[0]?.channelName && res.json[0]?.sender?.username && res.json[0]?.createdAt))

  // delete one message, then it should disappear from search
  send(neoWs, `/app/channels/${a}/messages/${delId}/delete`, {})
  await wait(400)
  res = await api(`/api/search/messages?q=${term}`, 'GET', neo)
  results.push(check('deleted message excluded from search', !res.json.some((r) => r.id === delId)))

  // empty query -> empty
  const empty = await api('/api/search/messages?q=', 'GET', neo)
  results.push(check('empty query returns []', Array.isArray(empty.json) && empty.json.length === 0))

  console.log('\nRESULT:', results.every(Boolean) ? 'ALL PASS' : 'FAIL')
  process.exit(results.every(Boolean) ? 0 : 1)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
