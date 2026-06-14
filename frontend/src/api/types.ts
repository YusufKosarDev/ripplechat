export interface User {
  id: string
  username: string
  email: string
  displayName: string | null
  avatarColor: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: User
}

// Returned by /api/auth/refresh (no user payload).
export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
}

export interface LoginRequest {
  login: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  displayName?: string
  password: string
}

// Matches the backend's consistent error body.
export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
  fieldErrors?: { field: string; message: string }[]
}

export interface UserSummary {
  id: string
  username: string
  displayName: string | null
  avatarColor: string | null
  avatarUrl: string | null
  lastSeenAt: string | null
}

export type MembershipRole = 'OWNER' | 'MODERATOR' | 'MEMBER'

export interface MemberResponse {
  user: UserSummary
  role: MembershipRole
  joinedAt: string
}

export interface Channel {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdBy: UserSummary
  createdAt: string
}

// One image attachment in a channel's media gallery.
export interface MediaItem {
  messageId: string
  url: string
  sender: UserSummary
  createdAt: string
}

// Open Graph / page metadata for a URL preview card.
export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

// A user's read position in a channel (powers read receipts).
export interface ReadReceipt {
  channelId: string
  userId: string
  lastReadAt: string
}

// A direct conversation: a one-to-one DM (otherUser set) or a group (group=true,
// name + participants). The id is the underlying channel id.
export interface DirectChannel {
  id: string
  group: boolean
  name: string | null
  otherUser: UserSummary | null
  participants: UserSummary[]
  createdAt: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  users: string[] // usernames who reacted (lets the client derive "reactedByMe")
}

export interface ThreadSummary {
  replyCount: number
  lastRepliers: UserSummary[]
}

export interface Message {
  id: string
  content: string
  channelId: string
  sender: UserSummary
  createdAt: string
  reactions: ReactionSummary[]
  parentMessageId: string | null
  thread: ThreadSummary
  editedAt: string | null
  deleted: boolean
  attachmentUrl: string | null
  quotedMessageId: string | null
  quotedSender: string | null
  quotedContent: string | null
  forwarded: boolean
  pinned: boolean
}

export interface MessageReactionUpdate {
  messageId: string
  reactions: ReactionSummary[]
}

export interface ThreadUpdate {
  parentMessageId: string
  thread: ThreadSummary
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface PresenceEvent {
  userId: string
  username: string
  displayName: string | null
  status: 'ONLINE' | 'OFFLINE'
}

export interface TypingEvent {
  userId: string
  username: string
  displayName: string | null
  typing: boolean
}

export interface ReactionEvent {
  userId: string
  username: string
  emoji: string
}

export interface SearchResult {
  id: string
  content: string
  channelId: string
  channelName: string
  sender: UserSummary
  createdAt: string
}

export interface PollOption {
  id: string
  text: string
  votes: number
}

export interface Poll {
  id: string
  channelId: string
  question: string
  options: PollOption[]
  createdBy: string
  createdAt: string
  totalVotes: number
}
