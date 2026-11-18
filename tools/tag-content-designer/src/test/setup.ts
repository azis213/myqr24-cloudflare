/**
 * jsdom-Shims für ProseMirror/Tiptap: Layout-APIs fehlen in jsdom, der Editor braucht sie
 * für Auswahl- und Scroll-Operationen.
 */
if (typeof window !== "undefined") {
  const zeroRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };

  if (typeof Range !== "undefined") {
    Range.prototype.getBoundingClientRect = () => zeroRect as DOMRect;
    Range.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* empty() {},
      }) as unknown as DOMRectList;
  }

  if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => undefined;
  }

  if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
    document.elementFromPoint = () => null;
  }

  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
}
