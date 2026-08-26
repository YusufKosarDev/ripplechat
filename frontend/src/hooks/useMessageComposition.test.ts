import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessageComposition } from './useMessageComposition'
import { addPendingMessage } from '../db'
import { encryptTextAsymmetric, encryptTextV2 } from '../crypto/e2ee'
import { isStompConnected, sendChatMessage, sendPoll, sendTyping } from '../realtime/chatSocket'
import type { Channel, MemberResponse } from '../api/types'

vi.mock('../realtime/chatSocket', () => ({
  isStompConnected: vi.fn(() => true),
  sendChatMessage: vi.fn(),
  sendDeleteMessage: vi.fn(),
  sendEditMessage: vi.fn(),
  sendPoll: vi.fn(),
  sendTyping: vi.fn(),
}))
vi.mock('../db', () => ({ addPendingMessage: vi.fn(async () => undefined) }))
vi.mock('../api/client', () => ({ client: { post: vi.fn() } }))
vi.mock('../api/scheduled', () => ({ scheduleMessage: vi.fn(async () => undefined) }))
vi.mock('../crypto/e2ee', () => ({
  encryptText: vi.fn(async (_c: string, _p: string, payload: string) => `enc:group:${payload}`),
  encryptTextV2: vi.fn(async (_id: string, payload: string) => `enc:v2:${payload}`),
  encryptTextAsymmetric: vi.fn(async (_k: CryptoKey, payload: string) => `enc:${payload}`),
}))

const channel = { id: 'c1', name: 'genel' } as Channel
const currentUser = {
  id: 'u-me',
  username: 'demo',
  displayName: 'Demo',
  avatarColor: 'indigo',
  avatarUrl: null,
}
const partner = { id: 'u-other', username: 'elif' } as MemberResponse['user']

const dispatch = vi.fn()
const cachePlaintext = vi.fn()
const t = (key: string) => key

function mount(over: Partial<Parameters<typeof useMessageComposition>[0]> = {}) {
  const props: Parameters<typeof useMessageComposition>[0] = {
    channel,
    channelId: 'c1',
    currentUser,
    members: [],
    dmPartner: null,
    asymmetricKey: null,
    passphrase: undefined,
    isE2EE: false,
    cachePlaintext,
    dispatch: dispatch as never,
    t,
    ...over,
  }
  return renderHook(() => useMessageComposition(props))
}

/** The content argument of the last sendChatMessage call. */
const sentContent = () => vi.mocked(sendChatMessage).mock.calls.at(-1)![1]

describe('useMessageComposition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isStompConnected).mockReturnValue(true)
  })

  describe('sending', () => {
    it('sends the draft and clears the composer', async () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('merhaba'))
      await act(async () => await result.current.submit())

      expect(sentContent()).toBe('merhaba')
      expect(result.current.draft).toBe('')
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'messages/addOptimisticMessage' }),
      )
    })

    it('ignores an empty draft with no attachment', async () => {
      const { result } = mount()
      await act(async () => await result.current.submit())
      expect(sendChatMessage).not.toHaveBeenCalled()
    })

    it('refuses a draft over the length limit', async () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('x'.repeat(4001)))
      await act(async () => await result.current.submit())

      expect(sendChatMessage).not.toHaveBeenCalled()
      expect(result.current.cmdError).toBe('composer.tooLong')
      // The draft survives so the text is not lost.
      expect(result.current.draft).toHaveLength(4001)
    })

    it('queues the message locally when the socket is down', async () => {
      vi.mocked(isStompConnected).mockReturnValue(false)
      const { result } = mount()
      act(() => result.current.onDraftChange('offline'))
      await act(async () => await result.current.submit())

      expect(sendChatMessage).not.toHaveBeenCalled()
      expect(addPendingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'offline', tempId: expect.any(String) }),
      )
    })
  })

  describe('slash commands', () => {
    it('runs a command instead of posting it as a message', async () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('/poll "Hangi gün?" "Salı" "Perşembe"'))
      await act(async () => await result.current.submit())

      expect(sendPoll).toHaveBeenCalledWith('c1', 'Hangi gün?', ['Salı', 'Perşembe'])
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'messages/addOptimisticMessage' }),
      )
      expect(result.current.draft).toBe('')
    })

    it('reports an unknown command and keeps the draft', async () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('/nope'))
      await act(async () => await result.current.submit())

      expect(result.current.cmdError).toBe('panel.unknownCommand')
      expect(result.current.draft).toBe('/nope')
    })

    it('does not interpret a slash in an encrypted conversation', async () => {
      // The command would leak in cleartext, so it goes out as a message.
      const { result } = mount({ passphrase: 'gizli', isE2EE: true })
      act(() => result.current.onDraftChange('/shrug'))
      await act(async () => await result.current.submit())

      expect(sendPoll).not.toHaveBeenCalled()
      expect(sendChatMessage).toHaveBeenCalled()
    })
  })

  describe('encryption', () => {
    it('encrypts through the Double Ratchet in a DM and caches our own plaintext', async () => {
      const { result } = mount({ dmPartner: partner, isE2EE: true })
      act(() => result.current.onDraftChange('gizli mesaj'))
      await act(async () => await result.current.submit())

      expect(encryptTextV2).toHaveBeenCalledWith('u-other', expect.stringContaining('gizli mesaj'))
      expect(sentContent()).toContain('enc:v2:')
      // Without the cache our own message would be unreadable to us.
      expect(cachePlaintext).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('gizli mesaj'),
      )
    })

    it('falls back to static ECDH when the ratchet cannot start', async () => {
      vi.mocked(encryptTextV2).mockRejectedValueOnce(new Error('no prekeys'))
      const key = {} as CryptoKey
      const { result } = mount({ dmPartner: partner, asymmetricKey: key, isE2EE: true })
      act(() => result.current.onDraftChange('gizli'))
      await act(async () => await result.current.submit())

      expect(encryptTextAsymmetric).toHaveBeenCalled()
      expect(sentContent()).toContain('enc:')
    })

    it('sends the plain text, never the envelope, when no key material works', async () => {
      // Regression guard: leaking the JSON envelope would render as raw JSON.
      vi.mocked(encryptTextV2).mockRejectedValueOnce(new Error('no prekeys'))
      const { result } = mount({ dmPartner: partner, isE2EE: true })
      act(() => result.current.onDraftChange('merhaba'))
      await act(async () => await result.current.submit())

      expect(sentContent()).toBe('merhaba')
      expect(sentContent()).not.toContain('_e2ee')
    })

    it('keeps the attachment out of the plaintext columns when encrypted', async () => {
      const { result } = mount({ dmPartner: partner, isE2EE: true })
      act(() =>
        result.current.setAttachment({
          url: 'https://cdn/x.bin',
          name: 'x.png',
          type: 'image',
          e2ee: { key: 'k', iv: 'i' },
        }),
      )
      await act(async () => await result.current.submit())

      const [, , , attachmentUrl] = vi.mocked(sendChatMessage).mock.calls.at(-1)!
      expect(attachmentUrl).toBeUndefined()
      expect(encryptTextV2).toHaveBeenCalledWith('u-other', expect.stringContaining('https://cdn/x.bin'))
    })
  })

  describe('typing indicator', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('announces typing once, then stops after the idle delay', () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('me'))
      act(() => result.current.onDraftChange('mer'))
      expect(vi.mocked(sendTyping).mock.calls).toEqual([['c1', true]])

      act(() => vi.advanceTimersByTime(2000))
      expect(vi.mocked(sendTyping).mock.calls.at(-1)).toEqual(['c1', false])
    })

    it('stays quiet while a slash command is being typed', () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('/po'))
      expect(sendTyping).not.toHaveBeenCalled()
    })

    it('tells the channel you left that you stopped typing', () => {
      const { result } = mount()
      act(() => result.current.onDraftChange('yazıyorum'))
      act(() => result.current.resetOnChannelChange('c1'))
      expect(vi.mocked(sendTyping).mock.calls.at(-1)).toEqual(['c1', false])
    })
  })

  describe('inline editing', () => {
    it('loads the message into the edit draft and clears on cancel', () => {
      const { result } = mount()
      const msg = { id: 'm1', content: 'eski' } as never
      act(() => result.current.startEdit(msg))
      expect(result.current.editingId).toBe('m1')
      expect(result.current.editDraft).toBe('eski')

      act(() => result.current.cancelEdit())
      expect(result.current.editingId).toBeNull()
      expect(result.current.editDraft).toBe('')
    })
  })
})
