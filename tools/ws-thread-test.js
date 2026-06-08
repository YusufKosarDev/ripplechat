// Verifies message threads: replies go to the thread topic + bump the parent's
// thread summary (thread-updates), replies do NOT leak into the main feed, the
// main feed lists only top-level messages, the thread is persisted (REST), and
// non-members are rejected. Run: node tools/ws-thread-test.js
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

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123')
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234')
  const cypher = await auth('cypher', 'cypher@ripplechat.io', 'redpill1')

  const ch = await api('/api/channels', 'POST', neo, { name: 'thread-' + Date.now() })
  const channelId = ch.json.id
  await api(`/api/channels/${channelId}/join`, 'POST', trinity)

  const mainFeed = []
  const threadUpdates = []
  const threadReplies = []
  let parentId = null

  const neoWs = await connect(neo)
  neoWs.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command !== 'MESSAGE') continue
      const dest = f.headers.destination
      const body = JSON.parse(f.body)
      if (dest === `/topic/channels/${channelId}`) mainFeed.push(body)
      else if (dest === `/topic/channels/${channelId}/thread-updates`) threadUpdates.push(body)
      else if (dest === `/topic/channels/${channelId}/thread/${parentId}`) threadReplies.push(body)
    }
  }
  neoWs.send(frame('SUBSCRIBE', { id: 'feed', destination: `/topic/channels/${channelId}` }))
  neoWs.send(frame('SUBSCRIBE', { id: 'tu', destination: `/topic/channels/${channelId}/thread-updates` }))
  await wait(300)

  // post a top-level message and capture its id
  send(neoWs, `/app/channels/${channelId}/send`, { content: 'parent message' })
  await wait(500)
  parentId = mainFeed.find((m) => m.content === 'parent message')?.id
  console.log('parentId:', parentId)

  // subscribe to the thread topic, then post two replies
  neoWs.send(frame('SUBSCRIBE', { id: 'th', destination: `/topic/channels/${channelId}/thread/${parentId}` }))
  await wait(200)
  send(neoWs, `/app/channels/${channelId}/send`, { content: 'first reply', parentMessageId: parentId })
  await wait(400)
  const trinityWs = await connect(trinity)
  send(trinityWs, `/app/channels/${channelId}/send`, { content: 'second reply', parentMessageId: parentId })
  await wait(500)

  // non-member reply -> rejected
  const cypherWs = await connect(cypher)
  send(cypherWs, `/app/channels/${channelId}/send`, { content: 'intruder reply', parentMessageId: parentId })
  await wait(500)

  // REST: main feed only top-level; parent has replyCount; thread endpoint lists replies
  const feed = await api(`/api/channels/${channelId}/messages`, 'GET', neo)
  const parentInFeed = feed.json.content.find((m) => m.id === parentId)
  const repliesInFeed = feed.json.content.filter((m) => m.parentMessageId)
  const threadList = await api(`/api/channels/${channelId}/messages/${parentId}/thread`, 'GET', neo)

  const lastUpdate = threadUpdates[threadUpdates.length - 1]
  console.log('thread replies (WS):', threadReplies.map((r) => r.content))
  console.log('replies leaked into main feed (should be []):', mainFeed.filter((m) => m.parentMessageId).map((m) => m.content))
  console.log('last thread-update replyCount:', lastUpdate?.thread.replyCount)
  console.log('main feed reply rows (should be 0):', repliesInFeed.length)
  console.log('parent.thread.replyCount in feed:', parentInFeed?.thread.replyCount)
  console.log('GET thread count:', threadList.json.length, threadList.json.map((r) => r.content))

  const pass =
    !!parentId &&
    threadReplies.some((r) => r.content === 'first reply') &&
    threadReplies.some((r) => r.content === 'second reply') &&
    !threadReplies.some((r) => r.content === 'intruder reply') &&
    mainFeed.filter((m) => m.parentMessageId).length === 0 &&
    lastUpdate?.thread.replyCount === 2 &&
    repliesInFeed.length === 0 &&
    parentInFeed?.thread.replyCount === 2 &&
    threadList.json.length === 2

  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
