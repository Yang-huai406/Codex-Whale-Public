// All coordinates are macOS logical points relative to the Codex window.
// The backing window follows the visible widget instead of covering the host.
const MAX_COORDINATE = 32768;
const PADDING = 8;
const EXPANDED_SIZE = 760;

function validRect(rect) {
  return rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key]) && Math.abs(rect[key]) <= MAX_COORDINATE)
    && rect.width > 0 && rect.height > 0;
}

function compactBounds(host, layout) {
  if (!validRect(host)) throw new TypeError('invalid host bounds');
  const h = { x: Math.round(host.x), y: Math.round(host.y), width: Math.round(host.width), height: Math.round(host.height) };
  if (!validRect(layout?.root)) {
    const width = Math.min(h.width, 720), height = Math.min(h.height, 720);
    return { x: h.x + h.width - width, y: h.y + h.height - height, width, height };
  }
  if (layout.dragging) return h;
  const root = layout.root;
  const width = Math.min(h.width, Math.max(Math.ceil(root.width) + PADDING * 2, layout.expanded ? EXPANDED_SIZE : 0));
  const height = Math.min(h.height, Math.max(Math.ceil(root.height) + PADDING * 2, layout.expanded ? EXPANDED_SIZE : 0));
  const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(value)));
  const onLeft = root.x + root.width / 2 < h.width / 2;
  const onTop = root.y + root.height / 2 < h.height / 2;
  const x = clamp(onLeft ? root.x - PADDING : root.x + root.width + PADDING - width, h.width - width);
  const y = clamp(onTop ? root.y - PADDING : root.y + root.height + PADDING - height, h.height - height);
  return { x: h.x + x, y: h.y + y, width, height };
}

function validLayout(layout) {
  return !!layout && typeof layout === 'object' && validRect(layout.root)
    && typeof layout.expanded === 'boolean' && typeof layout.dragging === 'boolean';
}

module.exports = { compactBounds, validLayout };
