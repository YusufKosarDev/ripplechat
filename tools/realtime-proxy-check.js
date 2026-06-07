// Verifies realtime messaging through the SAME path the frontend uses: the
// Vite dev server (5173) proxies both REST (/api) and WebSocket (/ws) to the
// backend. Two users join a channel; one subscribes, the other sends; the
// message must arrive in realtime. Run with backend + dev server up:
//   node tools/realtime-proxy-check.js

const FRONT = process.env.FRONT || 'http://localhost:5173';
const WS_URL = FRONT.replace(/^http/, 'ws') + '/ws';
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
    ws.onerror = () => reject(new Error('WebSocket error (proxy /ws)'));
  });
}

async function api(path, method, token, body) {
  const res = await fetch(FRONT + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function auth(username, email, password) {
  const reg = await api('/api/auth/register', 'POST', null, { username, email, displayName: username, password });
  if (reg.status === 201) return reg.json.accessToken;
  return (await api('/api/auth/login', 'POST', null, { login: username, password })).json.accessToken;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const neo = await auth('neo', 'neo@ripplechat.io', 'matrix123');
  const trinity = await auth('trinity', 'trinity@ripplechat.io', 'zion1234');

  const ch = await api('/api/channels', 'POST', neo, { name: 'fe-realtime-' + Date.now() });
  const channelId = ch.json.id;
  await api(`/api/channels/${channelId}/join`, 'POST', trinity);
  console.log('channel:', channelId, '(via proxy; neo owner, trinity joined)');

  // trinity subscribes (history would come from REST in the UI).
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no realtime message within 5s')), 5000);
    connect(trinity).then((sub) => {
      sub.send(frame('SUBSCRIBE', { id: 's', destination: `/topic/channels/${channelId}` }));
      sub.onmessage = (ev) => {
        for (const f of parseFrames(ev.data.toString())) {
          if (f.command === 'MESSAGE') { clearTimeout(timer); resolve(JSON.parse(f.body)); }
        }
      };
      setTimeout(async () => {
        const sender = await connect(neo);
        sender.send(frame('SEND',
          { destination: `/app/channels/${channelId}/send`, 'content-type': 'application/json' },
          JSON.stringify({ content: 'merhaba realtime' })));
      }, 300);
    }).catch(reject);
  });

  const msg = await received;
  console.log('REALTIME (through proxy) received:', JSON.stringify(msg));

  const history = await api(`/api/channels/${channelId}/messages`, 'GET', trinity);
  const persisted = history.json.content.some((m) => m.content === 'merhaba realtime');

  const pass = msg.content === 'merhaba realtime' && msg.sender.username === 'neo' && persisted;
  console.log('persisted (REST history):', persisted);
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
