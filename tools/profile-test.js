// Verifies self profile editing: displayName + avatarColor update and persist
// and reflect in messages (UserSummary); email duplicate -> 409; password change
// (wrong current -> 400, short new -> 400, valid -> works: old login fails, new works).
// Run with backend + dev up: node tools/profile-test.js  (BASE=5173 for proxy)

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
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (label, cond) => { console.log(`${cond ? 'OK ' : 'FAIL'} ${label}`); return cond }

async function main() {
  const uniq = Date.now().toString().slice(-6)
  const uname = 'pf' + uniq
  const reg = await api('/api/auth/register', 'POST', null, { username: uname, email: uname + '@ripplechat.io', displayName: 'Before', password: 'initialpw1' })
  const token = reg.json.accessToken
  // ensure neo exists (for duplicate-email test target)
  await api('/api/auth/register', 'POST', null, { username: 'neo', email: 'neo@ripplechat.io', displayName: 'Neo', password: 'matrix123' })

  const results = []

  // update displayName + avatarColor
  let res = await api('/api/users/me', 'PUT', token, { displayName: 'After Name', avatarColor: 'emerald' })
  results.push(check('updateMe -> 200', res.status === 200))
  results.push(check('updateMe returns new displayName + color', res.json.displayName === 'After Name' && res.json.avatarColor === 'emerald'))

  // persists via GET /me
  res = await api('/api/users/me', 'GET', token)
  results.push(check('GET /me persisted', res.json.displayName === 'After Name' && res.json.avatarColor === 'emerald'))

  // reflects in messages (UserSummary): create channel, post, read back
  const ch = await api('/api/channels', 'POST', token, { name: 'pf-' + uniq })
  const channelId = ch.json.id
  const ws = await connect(token)
  ws.send(frame('SUBSCRIBE', { id: 'm', destination: `/topic/channels/${channelId}` }))
  await wait(200)
  ws.send(frame('SEND', { destination: `/app/channels/${channelId}/send`, 'content-type': 'application/json' }, JSON.stringify({ content: 'hi from new name' })))
  await wait(400)
  const hist = await api(`/api/channels/${channelId}/messages`, 'GET', token)
  const msg = hist.json.content[0]
  results.push(check('message sender reflects new displayName + color', msg.sender.displayName === 'After Name' && msg.sender.avatarColor === 'emerald'))

  // duplicate email -> 409
  res = await api('/api/users/me', 'PUT', token, { email: 'neo@ripplechat.io' })
  results.push(check('duplicate email -> 409', res.status === 409))

  // password: wrong current -> 400
  res = await api('/api/users/me/password', 'PUT', token, { currentPassword: 'wrongpw', newPassword: 'brandnew123' })
  results.push(check('wrong current password -> 400', res.status === 400))
  // short new -> 400
  res = await api('/api/users/me/password', 'PUT', token, { currentPassword: 'initialpw1', newPassword: 'short' })
  results.push(check('short new password -> 400', res.status === 400))
  // valid change -> 204
  res = await api('/api/users/me/password', 'PUT', token, { currentPassword: 'initialpw1', newPassword: 'brandnew123' })
  results.push(check('valid password change -> 204', res.status === 204))
  // old password no longer works
  res = await api('/api/auth/login', 'POST', null, { login: uname, password: 'initialpw1' })
  results.push(check('old password rejected (401)', res.status === 401))
  // new password works
  res = await api('/api/auth/login', 'POST', null, { login: uname, password: 'brandnew123' })
  results.push(check('new password works (200)', res.status === 200))

  console.log('\nRESULT:', results.every(Boolean) ? 'ALL PASS' : 'FAIL')
  process.exit(results.every(Boolean) ? 0 : 1)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
