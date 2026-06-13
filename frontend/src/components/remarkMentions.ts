// remark plugin: wrap @mentions (e.g. @neo) in a <span class="mention"> so they
// can be styled, while leaving the rest of the markdown intact. No extra deps —
// it walks the mdast tree and splits text nodes itself.

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

const MENTION = /@\w{2,32}/g

function splitText(value: string): MdNode[] | null {
  const parts: MdNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  MENTION.lastIndex = 0
  while ((match = MENTION.exec(value))) {
    const start = match.index
    const before = start === 0 ? '' : value[start - 1]
    // Skip when glued to a word/@ (e.g. inside an email) — only standalone mentions.
    if (before && /[\w@]/.test(before)) continue
    if (start > last) parts.push({ type: 'text', value: value.slice(last, start) })
    parts.push({
      type: 'mention',
      data: { hName: 'span', hProperties: { className: 'mention' } },
      children: [{ type: 'text', value: match[0] }],
    })
    last = start + match[0].length
  }
  if (!parts.length) return null
  if (last < value.length) parts.push({ type: 'text', value: value.slice(last) })
  return parts
}

function walk(node: MdNode): void {
  if (!node.children) return
  const out: MdNode[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('@')) {
      const replaced = splitText(child.value)
      if (replaced) {
        out.push(...replaced)
        continue
      }
    }
    walk(child)
    out.push(child)
  }
  node.children = out
}

export default function remarkMentions() {
  return (tree: MdNode) => walk(tree)
}
