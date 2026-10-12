import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { compactBounds, validLayout } = createRequire(import.meta.url)('../desktop/macos/compact-window.cjs');
const host = { x: -760, y: 42, width: 1280, height: 820 };

test('normal macOS surface follows every supported whale size without covering the host', () => {
  for (const size of [122, 168, 250, 375, 500, 625]) {
    for (const [x, y] of [[12, 12], [1280 - size - 12, 820 - size - 12]]) {
      const root = { x, y, width: size, height: size };
      const bounds = compactBounds(host, { root, expanded: false, dragging: false });
      assert.equal(bounds.width, size + 16);
      assert.equal(bounds.height, size + 16);
      assert.ok(bounds.x <= host.x + x && bounds.x + bounds.width >= host.x + x + size);
      assert.ok(bounds.y <= host.y + y && bounds.y + bounds.height >= host.y + y + size);
      assert.ok(bounds.x >= host.x && bounds.x + bounds.width <= host.x + host.width);
      assert.ok(bounds.y >= host.y && bounds.y + bounds.height <= host.y + host.height);
      assert.ok(bounds.width < host.width && bounds.height < host.height);
    }
  }
});

test('menu and modal surfaces expand near the whale and return to its size', () => {
  const root = { x: 980, y: 560, width: 220, height: 220 };
  const normal = compactBounds(host, { root, expanded: false, dragging: false });
  const expanded = compactBounds(host, { root, expanded: true, dragging: false });
  assert.deepEqual([normal.width, normal.height], [236, 236]);
  assert.deepEqual([expanded.width, expanded.height], [760, 760]);
  assert.ok(expanded.x <= host.x + root.x && expanded.x + expanded.width >= host.x + root.x + root.width);
  assert.deepEqual(compactBounds(host, { root, expanded: false, dragging: false }), normal);
});

test('captured drag has the full host coordinate plane and malformed geometry is rejected', () => {
  const root = { x: 12, y: 12, width: 200, height: 200 };
  assert.deepEqual(compactBounds(host, { root, expanded: false, dragging: true }), host);
  assert.equal(validLayout({ root, expanded: false, dragging: false }), true);
  assert.equal(validLayout({ root: { ...root, width: NaN }, expanded: false, dragging: false }), false);
  assert.equal(validLayout({ root, expanded: 1, dragging: false }), false);
});
