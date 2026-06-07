// Verifies presence over WebSocket/STOMP: ONLINE/OFFLINE broadcasts on
// /topic/presence, the GET /api/presence/online list, and correct multi-tab
// counting (still online while any connection remains).
// Run: node tools/ws-presence-test.js

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

async function login(loginName, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginName, password }),
  });
  return (await res.json()).accessToken;
}

async function onlineUsernames(token) {
  const res = await fetch(BASE + '/api/presence/online', { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()).map((u) => u.username).sort();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const neo = await login('neo', 'matrix123');
  const trinity = await login('trinity', 'zion1234');

  // Observer (neo) subscribes to presence and records ONLINE/OFFLINE for trinity.
  const events = [];
  const observer = await connect(neo);
  observer.send(frame('SUBSCRIBE', { id: 'p', destination: '/topic/presence' }));
  observer.onmessage = (ev) => {
    for (const f of parseFrames(ev.data.toString())) {
      if (f.command === 'MESSAGE') events.push(JSON.parse(f.body));
    }
  };
  await wait(400);

  // trinity opens first connection -> expect ONLINE broadcast.
  const tri1 = await connect(trinity);
  await wait(700);
  console.log('after trinity conn#1 -> online list:', JSON.stringify(await onlineUsernames(neo)));

  // trinity opens a second connection -> should NOT trigger another ONLINE.
  const tri2 = await connect(trinity);
  await wait(700);

  // close first trinity connection -> still online, no OFFLINE.
  tri1.close();
  await wait(900);
  const stillOnline = await onlineUsernames(neo);
  console.log('after closing trinity conn#1 -> online list:', JSON.stringify(stillOnline));

  // close second trinity connection -> now OFFLINE.
  tri2.close();
  await wait(900);
  const afterAllClosed = await onlineUsernames(neo);
  console.log('after closing trinity conn#2 -> online list:', JSON.stringify(afterAllClosed));

  const triOnline = events.filter((e) => e.username === 'trinity' && e.status === 'ONLINE').length;
  const triOffline = events.filter((e) => e.username === 'trinity' && e.status === 'OFFLINE').length;
  console.log('\ntrinity ONLINE events:', triOnline, '(expected 1)');
  console.log('trinity OFFLINE events:', triOffline, '(expected 1)');

  observer.close();

  const pass =
    triOnline === 1 &&
    triOffline === 1 &&
    stillOnline.includes('trinity') &&
    !afterAllClosed.includes('trinity');
  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
