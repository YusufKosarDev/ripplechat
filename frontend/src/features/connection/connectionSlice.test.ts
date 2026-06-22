import { describe, expect, it } from 'vitest'
import reducer, { setConnectionStatus } from './connectionSlice'

describe('connectionSlice', () => {
  it('updates the connection status', () => {
    const connected = reducer({ status: 'connecting' }, setConnectionStatus('connected'))
    expect(connected.status).toBe('connected')

    const dropped = reducer(connected, setConnectionStatus('disconnected'))
    expect(dropped.status).toBe('disconnected')
  })
})
