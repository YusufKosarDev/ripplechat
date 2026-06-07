// Exercises the exact network path the browser uses: requests go to the Vite
// dev server (5173) and are proxied to the backend (8081). Confirms the API
// layer (proxy, endpoints, JWT header, error shape) works without CORS.
// Run with the dev server AND backend running: node tools/frontend-proxy-check.js

const FRONT = process.env.FRONT || 'http://localhost:5173';

async function req(path, method, token, body) {
  const res = await fetch(FRONT + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, json };
}

async function main() {
  const uniq = Date.now().toString().slice(-6);
  const username = 'fe_user_' + uniq;

  // 1) register a fresh user through the proxy
  const reg = await req('/api/auth/register', 'POST', null,
    { username, email: username + '@ripplechat.io', displayName: 'FE ' + uniq, password: 'frontend123' });
  console.log('1) register ->', reg.status, '| token:', reg.json?.accessToken ? 'received' : 'none');

  // 2) login with the same credentials
  const login = await req('/api/auth/login', 'POST', null, { login: username, password: 'frontend123' });
  const token = login.json?.accessToken;
  console.log('2) login ->', login.status, '| token:', token ? 'received' : 'none');

  // 3) authenticated /me through the proxy with the token
  const me = await req('/api/users/me', 'GET', token);
  console.log('3) GET /me ->', me.status, '| user:', me.json?.username, '/', me.json?.displayName);

  // 4) wrong password -> 401 + consistent error message
  const bad = await req('/api/auth/login', 'POST', null, { login: username, password: 'wrong-pass' });
  console.log('4) login wrong password ->', bad.status, '| message:', bad.json?.message);

  const pass =
    reg.status === 201 && !!reg.json?.accessToken &&
    login.status === 200 && !!token &&
    me.status === 200 && me.json?.username === username &&
    bad.status === 401 && !!bad.json?.message;

  console.log('\nRESULT:', pass ? 'ALL PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
