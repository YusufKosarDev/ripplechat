// Verifies channel-membership enforcement over WebSocket/STOMP.
// A member can send (broadcast + persisted); a non-member's send is rejected
// (not broadcast, not persisted). Run: node tools/ws-membership-test.js

const BASE = process.env.BASE || 'http://localhost:8081';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';
const NUL = String.fromCharCode(0);

function frame(command, headers = {}, body = '') {
  const head = Object.entries(headers).map(([k, v]) => `${k}:${v}`).join('\n');
  return `${command}\n${head}\n\n${body}${NUL}`;
}

function parseFrames(data) {
  return data.split(NUL).filter((f) => f.trim().length > 0).map((raw) => {
    const [head, ...bodyParts] = raw.replace(/^\n+/, '').split('\n\n');
    const lines = head.split('\n');
    const command = lines.shift();
    const headers = {};
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx > -1) headers[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return { command, headers, body: bodyParts.join('\n\n') };
  });
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => ws.send(frame('CONNECT',
      { 'accept-version': '1.2', host: 'localhost', Authorization: `Bearer ${token}` }));
    ws.onmessage = (ev) => {
      for (const f of parseFrames(ev.data.toString())) {
        if (f.command === 'CONNECTED') resolve(ws);
        if (f.command === 'ERROR') reject(new Error(f.headers.message || 'STOMP ERROR'));
      }
    };
    ws.onerror = () => reject(new Error('WebSocket error'));
  });
}

async function api(path, method, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function login(loginName, password) {
  const r = await api('/api/auth/login', 'POST', null, { login: loginName, password });
  return r.json.accessToken;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const neo = await login('neo', 'matrix123');
  const trinity = await login('trinity', 'zion1234');

  const ch = await api('/api/channels', 'POST', neo, { name: 'ws-members-' + Date.now() });
  const channelId = ch.json.id;
  console.log('channel created by neo (owner):', channelId);

  // Subscriber (neo, a member) collects everything it receives.
  const inbox = [];
  const sub = await connect(neo);
  sub.send(frame('SUBSCRIBE', { id: 'sub-0', destination: `/topic/channels/${channelId}` }));
  sub.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') inbox.push(JSON.parse(f.body));
    }
  };
  await wait(300);

  // Member send.
  const neoSender = await connect(neo);
  neoSender.send(frame('SEND',
    { destination: `/app/channels/${channelId}/send`, 'content-type': 'application/json' },
    JSON.stringify({ content: 'member message' })));
  await wait(800);

  // Non-member send (trinity can connect with a valid token, but is not a member).
  const triSender = await connect(trinity);
  triSender.send(frame('SEND',
    { destination: `/app/channels/${channelId}/send`, 'content-type': 'application/json' },
    JSON.stringify({ content: 'intruder message' })));
  await wait(800);

  const memberReceived = inbox.some((m) => m.content === 'member message');
  const intruderBroadcast = inbox.some((m) => m.content === 'intruder message');

  // Persistence check (via neo, a member, over REST).
  const list = await api(`/api/channels/${channelId}/messages`, 'GET', neo);
  const contents = list.json.content.map((m) => m.content);
  const memberPersisted = contents.includes('member message');
  const intruderPersisted = contents.includes('intruder message');

  console.log('member message broadcast:', memberReceived);
  console.log('member message persisted:', memberPersisted);
  console.log('intruder broadcast (should be false):', intruderBroadcast);
  console.log('intruder persisted (should be false):', intruderPersisted);
  console.log('DB messages:', JSON.stringify(contents));

  const pass = memberReceived && memberPersisted && !intruderBroadcast && !intruderPersisted;
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
