import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

const KEY = 'ripplechat_channel_org'

interface OrgState {
  // Per-user organization of channels (client-side): a category label and an
  // archived flag, keyed by channel id.
  category: Record<string, string>
  archived: Record<string, boolean>
}

function load(): OrgState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { category: parsed.category ?? {}, archived: parsed.archived ?? {} }
  } catch {
    return { category: {}, archived: {} }
  }
}

const initialState: OrgState = load()

function persist(state: OrgState) {
  localStorage.setItem(KEY, JSON.stringify({ category: state.category, archived: state.archived }))
}

const channelOrgSlice = createSlice({
  name: 'channelOrg',
  initialState,
  reducers: {
    setCategory(state, action: PayloadAction<{ channelId: string; name: string }>) {
      const { channelId, name } = action.payload
      if (name) state.category[channelId] = name
      else delete state.category[channelId]
      persist(state)
    },
    toggleArchive(state, action: PayloadAction<string>) {
      const id = action.payload
      if (state.archived[id]) delete state.archived[id]
      else state.archived[id] = true
      persist(state)
    },
  },
})

export const { setCategory, toggleArchive } = channelOrgSlice.actions
export default channelOrgSlice.reducer
