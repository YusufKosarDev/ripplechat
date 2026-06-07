// Extensible slash-command system. Add a new command by appending to `commands`.
// Pure-frontend commands (shrug/giphy) turn into a normal message; commands that
// need realtime fan-out (poll) call into the WebSocket layer via the context.

export interface CommandContext {
  channelId: string
  args: string
  sendMessage: (content: string) => void
  createPoll: (question: string, options: string[]) => void
  showError: (message: string) => void
}

export interface Command {
  name: string
  description: string
  usage: string
  run: (ctx: CommandContext) => void
}

const GIPHY_PLACEHOLDERS = ['🪩', '✨', '🌈', '🦄', '🎬', '💫', '🐙', '🎇', '🕺', '🎆']

/** Extracts double-quoted segments: `"a" "b"` -> ['a', 'b']. */
function quotedArgs(input: string): string[] {
  const matches = input.match(/"([^"]+)"/g)
  return matches ? matches.map((s) => s.slice(1, -1)) : []
}

export const commands: Command[] = [
  {
    name: 'poll',
    description: 'Anket oluştur',
    usage: '/poll "Soru?" "Seçenek 1" "Seçenek 2"',
    run: (ctx) => {
      const parts = quotedArgs(ctx.args)
      if (parts.length < 3) {
        ctx.showError('Kullanım: /poll "Soru?" "Seçenek 1" "Seçenek 2" ...')
        return
      }
      const [question, ...options] = parts
      ctx.createPoll(question, options)
    },
  },
  {
    name: 'giphy',
    description: 'Eğlenceli bir görsel gönder (placeholder)',
    usage: '/giphy <arama>',
    run: (ctx) => {
      const query = ctx.args.trim()
      const emoji = GIPHY_PLACEHOLDERS[Math.floor(Math.random() * GIPHY_PLACEHOLDERS.length)]
      ctx.sendMessage(`${emoji} [gif: ${query || 'rastgele'}] ${emoji}`)
    },
  },
  {
    name: 'shrug',
    description: 'Mesaja ¯\\_(ツ)_/¯ ekle',
    usage: '/shrug [mesaj]',
    run: (ctx) => {
      const text = ctx.args.trim()
      ctx.sendMessage((text ? `${text} ` : '') + '¯\\_(ツ)_/¯')
    },
  },
]

export function findCommand(name: string): Command | undefined {
  return commands.find((c) => c.name === name.toLowerCase())
}

/** Parses `/name rest...` (returns null if not a slash command). */
export function parseCommand(input: string): { command: Command | null; name: string; args: string } | null {
  if (!input.startsWith('/')) return null
  const body = input.slice(1)
  const spaceIdx = body.search(/\s/)
  const name = spaceIdx === -1 ? body : body.slice(0, spaceIdx)
  const args = spaceIdx === -1 ? '' : body.slice(spaceIdx + 1).trim()
  return { command: findCommand(name) ?? null, name, args }
}

/** Commands whose name starts with the given prefix (for autocomplete hints). */
export function matchingCommands(prefix: string): Command[] {
  return commands.filter((c) => c.name.startsWith(prefix.toLowerCase()))
}
