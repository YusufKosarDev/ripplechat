import { describe, it, expect } from 'vitest'
import { buildQuickItems, filterQuickItems, dmLabel } from './quickSwitcherItems'
import type { Channel, DirectChannel, UserSummary } from '../api/types'

const channel = (id: string, name: string): Channel => ({ id, name }) as Channel
const user = (over: Partial<UserSummary>): UserSummary => ({ id: 'u', username: 'u', ...over }) as UserSummary
const dm = (id: string, over: Partial<DirectChannel> = {}): DirectChannel =>
  ({ id, group: false, name: null, otherUser: null, participants: [], ...over }) as DirectChannel

describe('quickSwitcherItems', () => {
  it('builds channels first, then DMs, with display labels', () => {
    const items = buildQuickItems(
      [channel('c1', 'genel'), channel('c2', 'tasarım')],
      [dm('d1', { otherUser: user({ username: 'elif', displayName: 'Elif' }) })],
    )
    expect(items).toEqual([
      { id: 'c1', label: 'genel', kind: 'channel' },
      { id: 'c2', label: 'tasarım', kind: 'channel' },
      { id: 'd1', label: 'Elif', kind: 'dm' },
    ])
  })

  it('labels group DMs by name and falls back to username when no display name', () => {
    expect(dmLabel(dm('g', { group: true, name: 'Ekip' }))).toBe('Ekip')
    expect(dmLabel(dm('d', { otherUser: user({ username: 'neo', displayName: null }) }))).toBe('neo')
  })

  it('filters case-insensitively by label substring; a blank query keeps all', () => {
    const items = buildQuickItems([channel('c1', 'Genel'), channel('c2', 'Yazılım')], [])
    expect(filterQuickItems(items, 'yaz')).toEqual([{ id: 'c2', label: 'Yazılım', kind: 'channel' }])
    expect(filterQuickItems(items, '   ')).toHaveLength(2)
    expect(filterQuickItems(items, 'zzz')).toHaveLength(0)
  })
})
