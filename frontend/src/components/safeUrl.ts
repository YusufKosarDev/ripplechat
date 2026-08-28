/**
 * Whether a link is safe to put in an href.
 *
 * react-markdown 10 runs its own defaultUrlTransform first, so this is the
 * second line of defence rather than the only one — but it should hold on its
 * own, and as written it did not. It compared the *trimmed* string, while a
 * browser strips tabs and newlines from anywhere in a URL before deciding what
 * the scheme is: a tab in the middle of the scheme name walked straight past.
 */
export function isSafeUrl(url: string | undefined): boolean {
  if (!url) return false
  // Drop what the browser drops before parsing the scheme: everything at or
  // below the space, plus DEL.
  const collapsed = Array.from(url)
    .filter((ch) => ch.charCodeAt(0) > 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .toLowerCase()
  return !/^(javascript|data|vbscript):/.test(collapsed)
}
