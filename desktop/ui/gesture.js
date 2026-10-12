(() => {
  'use strict';
  const presets = Object.freeze({ crisp: { press: 65, release: 125, squash: .90 }, soft: { press: 85, release: 155, squash: .86 }, balanced: { press: 75, release: 140, squash: .88 } });
  // 参考上游 PR #243：记录每次按下的时间戳与该次实际使用的 squash，供同帧极短轻点补出按压反馈
  const pressed = new WeakMap();
  function apply(body, down, name = 'balanced') {
    const p = presets[name] || presets.balanced;
    if (down) {
      pressed.set(body, { at: performance.now(), squash: p.squash });
      body.style.transition = `transform ${p.press}ms cubic-bezier(.2,.8,.3,1.15)`;
      body.style.transform = `scaleY(${p.squash}) scaleX(1.05)`;
      return;
    }
    const rec = pressed.get(body);
    if (rec) {
      pressed.delete(body);
      // 按下到松开不足 32ms 时浏览器往往没来得及应用压扁，先无过渡落到该次压扁值并强制提交样式，再立即回弹，避免这帧看不到按压反馈
      if (performance.now() - rec.at < 32) {
        body.style.transition = 'none';
        body.style.transform = `scaleY(${rec.squash}) scaleX(1.05)`;
        void body.offsetWidth;
      }
    }
    body.style.transition = `transform ${p.release}ms cubic-bezier(.2,.8,.3,1.15)`;
    body.style.transform = 'scaleY(1) scaleX(1)';
  }
  window.WhaleGesture = Object.freeze({ presets, apply });
})();
