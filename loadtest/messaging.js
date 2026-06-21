// k6 load test for RippleChat's read-heavy API path.
//
// Run against a LOCAL instance (do not point this at the shared free-tier demo):
//   k6 run loadtest/messaging.js
//   k6 run -e BASE_URL=http://localhost:8081 -e VUS=50 -e DURATION=1m loadtest/messaging.js
//
// setup() registers a throwaway user, creates a channel and seeds a few
// messages, then each virtual user exercises the authenticated read endpoints
// (channel list, message history, search) — the realistic high-volume path.
// Message sends are deliberately rate-limited server-side, so they are not the
// target of this throughput test.

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081'
const VUS = Number(__ENV.VUS || 20)
const DURATION = __ENV.DURATION || '30s'

const historyLatency = new Trend('history_latency', true)

export const options = {
  scenarios: {
    ramping: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<800'], // 95% of requests under 800ms
    history_latency: ['p(95)<800'],
  },
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
}

export function setup() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const username = `load-${suffix}`
  const register = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ username, email: `${username}@load.test`, password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  check(register, { 'registered (201)': (r) => r.status === 201 })
  const token = register.json('accessToken')

  const channel = http.post(
    `${BASE_URL}/api/channels`,
    JSON.stringify({ name: `load-${suffix}`, description: 'load test', isPrivate: false }),
    authHeaders(token),
  )
  const channelId = channel.json('id')

  // Seed a little history (kept under the send rate limit).
  for (let i = 0; i < 5; i++) {
    http.post(
      `${BASE_URL}/api/channels/${channelId}/messages`,
      JSON.stringify({ content: `seed message ${i}` }),
      authHeaders(token),
    )
  }
  return { token, channelId }
}

export default function (data) {
  const opts = authHeaders(data.token)

  const channels = http.get(`${BASE_URL}/api/channels`, opts)
  check(channels, { 'channels 200': (r) => r.status === 200 })

  const history = http.get(`${BASE_URL}/api/channels/${data.channelId}/messages?page=0&size=20`, opts)
  check(history, { 'history 200': (r) => r.status === 200 })
  historyLatency.add(history.timings.duration)

  const search = http.get(`${BASE_URL}/api/search/messages?q=seed`, opts)
  check(search, { 'search 200': (r) => r.status === 200 })

  sleep(1)
}
