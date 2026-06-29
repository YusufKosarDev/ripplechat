import type { Channel, DirectChannel } from '../api/types'

/** A jump target in the quick switcher: a channel or an existing direct/group chat. */
export interface QuickItem {
  id: string
  label: string
  kind: 'channel' | 'dm'
}

/** Display name for a DM/group, matching how the sidebar renders it. */
export function dmLabel(d: DirectChannel): string {
  return d.group ? (d.name ?? 'Grup') : (d.otherUser?.displayName ?? d.otherUser?.username ?? 'DM')
}

/** Channels first, then DMs — the order the user scans them in the sidebar. */
export function buildQuickItems(channels: Channel[], dms: DirectChannel[]): QuickItem[] {
  return [
    ...channels.map((c) => ({ id: c.id, label: c.name, kind: 'channel' as const })),
    ...dms.map((d) => ({ id: d.id, label: dmLabel(d), kind: 'dm' as const })),
  ]
}

/** Case-insensitive substring match on the label; a blank query keeps everything. */
export function filterQuickItems(items: QuickItem[], query: string): QuickItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((i) => i.label.toLowerCase().includes(q))
}
