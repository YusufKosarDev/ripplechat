export interface User {
  id: string
  username: string
  email: string
  displayName: string | null
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: User
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
}

export interface Channel {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdBy: UserSummary
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
