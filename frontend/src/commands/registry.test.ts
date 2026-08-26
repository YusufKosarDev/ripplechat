import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findCommand, matchingCommands, parseCommand } from './registry'
import type { CommandContext } from './registry'

function context(args: string) {
  return {
    channelId: 'c1',
    args,
    sendMessage: vi.fn<CommandContext['sendMessage']>(),
    createPoll: vi.fn<CommandContext['createPoll']>(),
    scheduleMessage: vi.fn<CommandContext['scheduleMessage']>(),
    showError: vi.fn<CommandContext['showError']>(),
  }
}

function run(name: string, args: string) {
  const ctx = context(args)
  findCommand(name)!.run(ctx)
  return ctx
}

describe('slash commands', () => {
  describe('parsing', () => {
    it('ignores anything that is not a slash command', () => {
      expect(parseCommand('merhaba')).toBeNull()
    })

    it('splits the name from its arguments', () => {
      expect(parseCommand('/shrug ne olacak')).toMatchObject({ name: 'shrug', args: 'ne olacak' })
    })

    it('handles a bare command with no arguments', () => {
      expect(parseCommand('/shrug')).toMatchObject({ name: 'shrug', args: '' })
    })

    it('reports an unknown command by name so the composer can explain', () => {
      const parsed = parseCommand('/nope arg')
      expect(parsed).toMatchObject({ command: null, name: 'nope' })
    })

    it('is case-insensitive on the command name', () => {
      expect(parseCommand('/SHRUG')?.command?.name).toBe('shrug')
    })

    it('offers autocomplete candidates by prefix', () => {
      expect(matchingCommands('p').map((c) => c.name)).toEqual(['poll'])
      expect(matchingCommands('').length).toBeGreaterThan(1)
      expect(matchingCommands('zzz')).toEqual([])
    })
  })

  describe('/shrug', () => {
    it('appends the shrug to the text', () => {
      expect(run('shrug', 'ne yapalım').sendMessage).toHaveBeenCalledWith('ne yapalım ¯\\_(ツ)_/¯')
    })

    it('sends just the shrug when there is no text', () => {
      expect(run('shrug', '').sendMessage).toHaveBeenCalledWith('¯\\_(ツ)_/¯')
    })
  })

  describe('/poll', () => {
    it('creates a poll from a quoted question and options', () => {
      const ctx = run('poll', '"Hangi gün?" "Salı" "Perşembe"')
      expect(ctx.createPoll).toHaveBeenCalledWith('Hangi gün?', ['Salı', 'Perşembe'])
      expect(ctx.showError).not.toHaveBeenCalled()
    })

    it('refuses a poll with fewer than two options', () => {
      const ctx = run('poll', '"Hangi gün?" "Salı"')
      expect(ctx.createPoll).not.toHaveBeenCalled()
      expect(ctx.showError).toHaveBeenCalledWith('cmd.poll.error')
    })

    it('refuses unquoted arguments rather than guessing where the question ends', () => {
      const ctx = run('poll', 'Hangi gün? Salı Perşembe')
      expect(ctx.showError).toHaveBeenCalledWith('cmd.poll.error')
    })
  })

  describe('/remind', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('schedules minutes ahead by default', () => {
      const ctx = run('remind', '10 toplantı')
      expect(ctx.scheduleMessage).toHaveBeenCalledWith(
        '⏰ toplantı',
        new Date('2026-01-01T12:10:00Z'),
      )
    })

    it('understands hour units in both languages', () => {
      expect(run('remind', '2 saat mola').scheduleMessage).toHaveBeenCalledWith(
        '⏰ mola',
        new Date('2026-01-01T14:00:00Z'),
      )
      expect(run('remind', '2h break').scheduleMessage).toHaveBeenCalledWith(
        '⏰ break',
        new Date('2026-01-01T14:00:00Z'),
      )
    })

    it('rejects a reminder with no delay, no text, or a zero duration', () => {
      for (const args of ['toplantı', '10', '0 toplantı']) {
        const ctx = run('remind', args)
        expect(ctx.scheduleMessage, args).not.toHaveBeenCalled()
        expect(ctx.showError, args).toHaveBeenCalledWith('cmd.remind.error')
      }
    })
  })

  describe('/giphy', () => {
    it('echoes the query into a placeholder message', () => {
      const ctx = run('giphy', 'kedi')
      expect(ctx.sendMessage.mock.calls[0][0]).toContain('[gif: kedi]')
    })

    it('falls back to a random pick when no query is given', () => {
      const ctx = run('giphy', '')
      expect(ctx.sendMessage.mock.calls[0][0]).toContain('[gif: rastgele]')
    })
  })
})
