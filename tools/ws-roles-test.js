// Verifies roles/permissions: owner edits/deletes channel, manages members
// (kick, set role); moderators can delete others' messages; members cannot;
// editing stays owner-only; unauthorized actions are 403. Run with BASE set to
// the proxy: BASE=http://localhost:5173 node tools/ws-roles-test.js

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

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')
  const cypher = await auth('cypher', 'cypher@ripplechat.io', 'redpill1')

  const ch = await api('/api/channels', 'POST', neo, { name: 'roles-' + Date.now() })
  const channelId = ch.json.id
  await api(`/api/channels/${channelId}/join`, 'POST', trinity)
  await api(`/api/channels/${channelId}/join`, 'POST', cypher)
  const members0 = (await api(`/api/channels/${channelId}/members`, 'GET', neo)).json
  const cypherId = members0.find((m) => m.user.username === 'cypher').user.id
  const trinityId = members0.find((m) => m.user.username === 'trinity').user.id

  const results = []
  // REST permission checks
  results.push(check('member cannot edit channel (403)', (await api(`/api/channels/${channelId}`, 'PUT', trinity, { name: 'hack' })).status === 403))
  results.push(check('owner edits channel (200)', (await api(`/api/channels/${channelId}`, 'PUT', neo, { name: 'renamed', description: 'd' })).status === 200))
  results.push(check('member cannot kick (403)', (await api(`/api/channels/${channelId}/members/${cypherId}`, 'DELETE', trinity)).status === 403))
  results.push(check('member cannot set role (403)', (await api(`/api/channels/${channelId}/members/${cypherId}/role`, 'PUT', trinity, { role: 'MODERATOR' })).status === 403))
  results.push(check('owner promotes cypher to MODERATOR (200)', (await api(`/api/channels/${channelId}/members/${cypherId}/role`, 'PUT', neo, { role: 'MODERATOR' })).status === 200))

  // WS moderation delete on neo's message
  const updates = []
  const obs = await connect(neo)
  let msgId = null
  obs.onmessage = (ev) => { for (const f of parseFrames(ev.data.toString())) { if (f.command !== 'MESSAGE') continue; const d = f.headers.destination; const b = JSON.parse(f.body); if (d === `/topic/channels/${channelId}`) { if (b.content === 'neo msg') msgId = b.id } else if (d === `/topic/channels/${channelId}/message-updates`) updates.push(b) } }
  obs.send(frame('SUBSCRIBE', { id: 'f', destination: `/topic/channels/${channelId}` }))
  obs.send(frame('SUBSCRIBE', { id: 'u', destination: `/topic/channels/${channelId}/message-updates` }))
  await wait(300)
  send(obs, `/app/channels/${channelId}/send`, { content: 'neo msg' })
  await wait(500)

  // member edit of someone else's message -> rejected (content unchanged)
  const trinityWs = await connect(trinity)
  send(trinityWs, `/app/channels/${channelId}/messages/${msgId}/edit`, { content: 'hacked' })
  await wait(400)
  let cur = (await api(`/api/channels/${channelId}/messages`, 'GET', neo)).json.content.find((m) => m.id === msgId)
  results.push(check('member cannot edit others (content unchanged)', cur.content === 'neo msg' && !cur.editedAt))

  // member delete of others -> rejected (not deleted)
  send(trinityWs, `/app/channels/${channelId}/messages/${msgId}/delete`, {})
  await wait(400)
  cur = (await api(`/api/channels/${channelId}/messages`, 'GET', neo)).json.content.find((m) => m.id === msgId)
  results.push(check('member cannot delete others (not deleted)', cur.deleted === false))

  // moderator delete of others -> succeeds
  const cypherWs = await connect(cypher)
  send(cypherWs, `/app/channels/${channelId}/messages/${msgId}/delete`, {})
  await wait(500)
  cur = (await api(`/api/channels/${channelId}/messages`, 'GET', neo)).json.content.find((m) => m.id === msgId)
  results.push(check('moderator deletes others (deleted, realtime)', cur.deleted === true && updates.some((u) => u.id === msgId && u.deleted)))

  // moderator (not owner) cannot delete channel
  results.push(check('moderator cannot delete channel (403)', (await api(`/api/channels/${channelId}`, 'DELETE', cypher)).status === 403))

  // owner kicks trinity
  results.push(check('owner kicks member (204)', (await api(`/api/channels/${channelId}/members/${trinityId}`, 'DELETE', neo)).status === 204))
  const membersAfter = (await api(`/api/channels/${channelId}/members`, 'GET', neo)).json
  results.push(check('kicked member gone from list', !membersAfter.some((m) => m.user.username === 'trinity')))

  // owner deletes channel
  results.push(check('owner deletes channel (204)', (await api(`/api/channels/${channelId}`, 'DELETE', neo)).status === 204))
  const list = (await api('/api/channels', 'GET', neo)).json
  results.push(check('deleted channel not listed', !list.some((c) => c.id === channelId)))

  console.log('\nRESULT:', results.every(Boolean) ? 'ALL PASS' : 'FAIL')
  process.exit(results.every(Boolean) ? 0 : 1)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
