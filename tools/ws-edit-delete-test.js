// Verifies message edit/delete: owner can edit (content + editedAt, realtime),
// non-owner is rejected, owner can soft-delete (content cleared, deleted=true,
// reactions removed), and changes persist via GET. Run: node tools/ws-edit-delete-test.js
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
    ws.onopen = () => ws.send(frame('CONNECT', { 'accept-version': '1.2', host: 'localhost', Authorization: `Bearer ${token}` }))
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
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}
async function auth(u, e, p) {
  const reg = await api('/api/auth/register', 'POST', null, { username: u, email: e, displayName: u, password: p })
  if (reg.status === 201) return reg.json.accessToken
  return (await api('/api/auth/login', 'POST', null, { login: u, password: p })).json.accessToken
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
function send(ws, dest, body) { ws.send(frame('SEND', { destination: dest, 'content-type': 'application/json' }, JSON.stringify(body))) }

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')
  const ch = await api('/api/channels', 'POST', neo, { name: 'editdel-' + Date.now() })
  const channelId = ch.json.id
  await api(`/api/channels/${channelId}/join`, 'POST', trinity)

  const feed = []
  const updates = []
  let msgId = null
  const neoWs = await connect(neo)
  neoWs.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command !== 'MESSAGE') continue
      const dest = f.headers.destination
      const b = JSON.parse(f.body)
      if (dest === `/topic/channels/${channelId}`) feed.push(b)
      else if (dest === `/topic/channels/${channelId}/message-updates`) updates.push(b)
    }
  }
  neoWs.send(frame('SUBSCRIBE', { id: 'f', destination: `/topic/channels/${channelId}` }))
  neoWs.send(frame('SUBSCRIBE', { id: 'u', destination: `/topic/channels/${channelId}/message-updates` }))
  await wait(300)

  send(neoWs, `/app/channels/${channelId}/send`, { content: 'original' })
  await wait(500)
  msgId = feed.find((m) => m.content === 'original')?.id

  // owner edits
  send(neoWs, `/app/channels/${channelId}/messages/${msgId}/edit`, { content: 'edited content' })
  await wait(400)
  const afterEdit = updates[updates.length - 1]
  console.log('after edit:', afterEdit?.content, '| editedAt set:', !!afterEdit?.editedAt)

  // non-owner edit attempt -> rejected (no new update)
  const updatesBefore = updates.length
  const trinityWs = await connect(trinity)
  send(trinityWs, `/app/channels/${channelId}/messages/${msgId}/edit`, { content: 'hacked' })
  await wait(500)
  const trinityRejected = updates.length === updatesBefore && updates[updates.length - 1]?.content === 'edited content'

  // add a reaction, then owner deletes -> content cleared, deleted true, reactions gone
  send(neoWs, `/app/channels/${channelId}/messages/${msgId}/reaction`, { emoji: '👍' })
  await wait(300)
  send(neoWs, `/app/channels/${channelId}/messages/${msgId}/delete`, {})
  await wait(400)
  const afterDelete = updates[updates.length - 1]
  console.log('after delete -> deleted:', afterDelete?.deleted, '| content:', JSON.stringify(afterDelete?.content), '| reactions:', afterDelete?.reactions.length)

  // persistence
  const hist = await api(`/api/channels/${channelId}/messages`, 'GET', neo)
  const persisted = hist.json.content.find((m) => m.id === msgId)
  console.log('persisted -> deleted:', persisted?.deleted, '| content:', JSON.stringify(persisted?.content), '| editedAt set:', !!persisted?.editedAt, '| reactions:', persisted?.reactions.length)

  console.log('non-owner edit rejected:', trinityRejected)

  const pass =
    !!msgId &&
    afterEdit?.content === 'edited content' && !!afterEdit?.editedAt && afterEdit?.deleted === false &&
    trinityRejected &&
    afterDelete?.deleted === true && afterDelete?.content === '' && afterDelete?.reactions.length === 0 &&
    persisted?.deleted === true && persisted?.content === '' && persisted?.reactions.length === 0

  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL')
  process.exit(pass ? 0 : 1)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
