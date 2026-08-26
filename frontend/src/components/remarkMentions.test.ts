import { describe, expect, it } from 'vitest'
import remarkMentions from './remarkMentions'

interface Node {
  type: string
  value?: string
  children?: Node[]
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

const text = (value: string): Node => ({ type: 'text', value })
const paragraph = (...children: Node[]): Node => ({ type: 'root', children: [{ type: 'paragraph', children }] })

/** Runs the plugin and returns the transformed inline nodes of the paragraph. */
function transform(tree: Node): Node[] {
  remarkMentions()(tree)
  return tree.children![0].children!
}

const summarise = (nodes: Node[]) =>
  nodes.map((n) => (n.type === 'mention' ? `[${n.children![0].value}]` : n.value))

describe('remarkMentions', () => {
  it('wraps a standalone mention in a styled span', () => {
    const out = transform(paragraph(text('selam @elif')))
    expect(summarise(out)).toEqual(['selam ', '[@elif]'])
    const mention = out.find((n) => n.type === 'mention')!
    expect(mention.data).toEqual({ hName: 'span', hProperties: { className: 'mention' } })
  })

  it('keeps the text either side of a mention intact', () => {
    expect(summarise(transform(paragraph(text('cc @elif lütfen bak'))))).toEqual([
      'cc ',
      '[@elif]',
      ' lütfen bak',
    ])
  })

  it('marks several mentions in one line', () => {
    expect(summarise(transform(paragraph(text('@elif @kerem toplantı'))))).toEqual([
      '[@elif]',
      ' ',
      '[@kerem]',
      ' toplantı',
    ])
  })

  it('leaves an email address alone', () => {
    // The @ is glued to a word character, so it is not a mention.
    expect(summarise(transform(paragraph(text('yaz: elif@ornek.com'))))).toEqual([
      'yaz: elif@ornek.com',
    ])
  })

  it('ignores a bare @ and names shorter than two characters', () => {
    expect(summarise(transform(paragraph(text('@ ve @a'))))).toEqual(['@ ve @a'])
  })

  it('leaves text without an @ untouched', () => {
    expect(summarise(transform(paragraph(text('düz bir mesaj'))))).toEqual(['düz bir mesaj'])
  })

  it('descends into nested nodes such as emphasis', () => {
    const tree = paragraph({ type: 'emphasis', children: [text('bak @elif')] })
    remarkMentions()(tree)
    const emphasis = tree.children![0].children![0]
    expect(summarise(emphasis.children!)).toEqual(['bak ', '[@elif]'])
  })

  it('is reusable across trees — the shared regex is reset each run', () => {
    const plugin = remarkMentions()
    const first = paragraph(text('@elif'))
    const second = paragraph(text('@kerem'))
    plugin(first)
    plugin(second)
    expect(summarise(second.children![0].children!)).toEqual(['[@kerem]'])
  })
})
