import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { client } from '../../api/client'
import type { Channel, DirectChannel, MemberResponse, MembershipRole } from '../../api/types'

interface ChannelsState {
  items: Channel[]
  dms: DirectChannel[]
  selectedId: string | null
  status: 'idle' | 'loading'
  membersByChannel: Record<string, MemberResponse[]>
}

const initialState: ChannelsState = {
  items: [],
  dms: [],
  selectedId: null,
  status: 'idle',
  membersByChannel: {},
}

export const fetchChannels = createAsyncThunk('channels/fetch', async () => {
  const { data } = await client.get<Channel[]>('/api/channels')
  return data
})

export const createChannel = createAsyncThunk(
  'channels/create',
  async (body: { name: string; description?: string; isPrivate?: boolean }) => {
    const { data } = await client.post<Channel>('/api/channels', body)
    return data
  },
)

export const joinChannel = createAsyncThunk('channels/join', async (channelId: string) => {
  await client.post(`/api/channels/${channelId}/join`)
  const { data } = await client.get<Channel[]>('/api/channels')
  return { channelId, channels: data }
})

export const fetchMembers = createAsyncThunk('channels/members', async (channelId: string) => {
  const { data } = await client.get<MemberResponse[]>(`/api/channels/${channelId}/members`)
  return { channelId, members: data }
})

export const kickMember = createAsyncThunk(
  'channels/kick',
  async ({ channelId, userId }: { channelId: string; userId: string }) => {
    await client.delete(`/api/channels/${channelId}/members/${userId}`)
    const { data } = await client.get<MemberResponse[]>(`/api/channels/${channelId}/members`)
    return { channelId, members: data }
  },
)

export const setMemberRole = createAsyncThunk(
  'channels/setRole',
  async ({ channelId, userId, role }: { channelId: string; userId: string; role: MembershipRole }) => {
    await client.put(`/api/channels/${channelId}/members/${userId}/role`, { role })
    const { data } = await client.get<MemberResponse[]>(`/api/channels/${channelId}/members`)
    return { channelId, members: data }
  },
)

export const fetchDms = createAsyncThunk('channels/fetchDms', async () => {
  const { data } = await client.get<DirectChannel[]>('/api/dm')
  return data
})

// Opens (or creates) the DM with a user, then selects it.
export const openDm = createAsyncThunk('channels/openDm', async (userId: string) => {
  const { data } = await client.post<DirectChannel>(`/api/dm/${userId}`)
  return data
})

// Creates a multi-party group DM, then selects it.
export const createGroupDm = createAsyncThunk(
  'channels/createGroupDm',
  async (body: { userIds: string[]; name?: string }) => {
    const { data } = await client.post<DirectChannel>('/api/dm/group', body)
    return data
  },
)

export const updateChannel = createAsyncThunk(
  'channels/update',
  async ({ channelId, name, description }: { channelId: string; name: string; description?: string }) => {
    const { data } = await client.put<Channel>(`/api/channels/${channelId}`, { name, description })
    return data
  },
)

export const setDisappearing = createAsyncThunk(
  'channels/setDisappearing',
  async ({ channelId, ttlSeconds }: { channelId: string; ttlSeconds: number | null }) => {
    const { data } = await client.put<Channel>(`/api/channels/${channelId}/disappearing`, { ttlSeconds })
    return data
  },
)

export const deleteChannel = createAsyncThunk('channels/delete', async (channelId: string) => {
  await client.delete(`/api/channels/${channelId}`)
  return channelId
})

const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    selectChannel(state, action: PayloadAction<string>) {
      state.selectedId = action.payload
    },
    // Local removal (e.g. on a channel-deleted broadcast).
    channelRemoved(state, action: PayloadAction<string>) {
      state.items = state.items.filter((c) => c.id !== action.payload)
      if (state.selectedId === action.payload) {
        state.selectedId = null
      }
    },
  },
  extraReducers: (builder) => {
    const applyMembers = (
      state: ChannelsState,
      action: PayloadAction<{ channelId: string; members: MemberResponse[] }>,
    ) => {
      state.membersByChannel[action.payload.channelId] = action.payload.members
    }
    builder
      .addCase(fetchChannels.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.status = 'idle'
        state.items = action.payload
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.items.push(action.payload)
        state.selectedId = action.payload.id
      })
      .addCase(joinChannel.fulfilled, (state, action) => {
        state.items = action.payload.channels
        state.selectedId = action.payload.channelId
      })
      .addCase(fetchDms.fulfilled, (state, action) => {
        state.dms = action.payload
      })
      .addCase(openDm.fulfilled, (state, action) => {
        if (!state.dms.some((d) => d.id === action.payload.id)) {
          state.dms.unshift(action.payload)
        }
        state.selectedId = action.payload.id
      })
      .addCase(createGroupDm.fulfilled, (state, action) => {
        if (!state.dms.some((d) => d.id === action.payload.id)) {
          state.dms.unshift(action.payload)
        }
        state.selectedId = action.payload.id
      })
      .addCase(fetchMembers.fulfilled, applyMembers)
      .addCase(kickMember.fulfilled, applyMembers)
      .addCase(setMemberRole.fulfilled, applyMembers)
      .addCase(updateChannel.fulfilled, (state, action) => {
        const idx = state.items.findIndex((c) => c.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(setDisappearing.fulfilled, (state, action) => {
        const idx = state.items.findIndex((c) => c.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
      })
      .addCase(deleteChannel.fulfilled, (state, action) => {
        state.items = state.items.filter((c) => c.id !== action.payload)
        if (state.selectedId === action.payload) state.selectedId = null
      })
  },
})

export const TTL_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Kapalı', value: null },
  { label: '1 saat', value: 3600 },
  { label: '1 gün', value: 86400 },
  { label: '1 hafta', value: 604800 },
]

// Human-readable label for a disappearing-timer value in seconds.
export function ttlLabel(seconds: number | null | undefined): string | null {
  if (!seconds) return null
  if (seconds % 604800 === 0) return `${seconds / 604800} hafta`
  if (seconds % 86400 === 0) return `${seconds / 86400} gün`
  if (seconds % 3600 === 0) return `${seconds / 3600} saat`
  return `${seconds} sn`
}

export const { selectChannel, channelRemoved } = channelsSlice.actions
export default channelsSlice.reducer
