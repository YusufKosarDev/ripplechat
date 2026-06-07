// Verifies channel typing indicators over WebSocket/STOMP: a member's typing
// true/false reaches other members on /topic/channels/{id}/typing, and a
// non-member's typing signal is rejected. Run: node tools/ws-typing-test.js

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

async function auth(username, email, password) {
  const reg = await api('/api/auth/register', 'POST', null,
    { username, email, displayName: username, password });
  if (reg.status === 201) return reg.json.accessToken;
  const login = await api('/api/auth/login', 'POST', null, { login: username, password });
  return login.json.accessToken;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function sendTyping(ws, channelId, typing) {
  ws.send(frame('SEND',
    { destination: `/app/channels/${channelId}/typing`, 'content-type': 'application/json' },
    JSON.stringify({ typing })));
}

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123');
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234');
  const cypher = await auth('cypher', 'cypher@ripplechat.io', 'redpill1');

  // neo creates a channel (owner); trinity joins; cypher stays out.
  const ch = await api('/api/channels', 'POST', neo, { name: 'typing-' + Date.now() });
  const channelId = ch.json.id;
  await api(`/api/channels/${channelId}/join`, 'POST', trinity);
  console.log('channel:', channelId, '(neo owner, trinity member, cypher not a member)');

  // Observer (trinity) listens to typing events.
  const events = [];
  const observer = await connect(trinity);
  observer.send(frame('SUBSCRIBE', { id: 't', destination: `/topic/channels/${channelId}/typing` }));
  observer.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') events.push(JSON.parse(f.body));
    }
  };
  await wait(400);

  // Member (neo) types, then stops.
  const neoWs = await connect(neo);
  sendTyping(neoWs, channelId, true);
  await wait(500);
  sendTyping(neoWs, channelId, false);
  await wait(500);

  // Non-member (cypher) tries to signal typing.
  const cypherWs = await connect(cypher);
  sendTyping(cypherWs, channelId, true);
  await wait(700);

  const typingTrue = events.some((e) => e.username === 'neo' && e.typing === true);
  const typingFalse = events.some((e) => e.username === 'neo' && e.typing === false);
  const nonMemberLeaked = events.some((e) => e.username === 'cypher');

  console.log('events received:', JSON.stringify(events));
  console.log('neo typing:true received:', typingTrue);
  console.log('neo typing:false received:', typingFalse);
  console.log('cypher (non-member) leaked (should be false):', nonMemberLeaked);

  observer.close();

  const pass = typingTrue && typingFalse && !nonMemberLeaked;
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
