// Shared visible keyboard-focus ring. Pair with `outline-none`: removes the
// native outline but adds an accent ring on keyboard focus (focus-visible), so
// mouse clicks stay clean while Tab navigation is clearly visible. The offset
// gap (in the page surface color) keeps the ring readable even on filled
// buttons. Reused by the Button primitive and every custom interactive control.
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
