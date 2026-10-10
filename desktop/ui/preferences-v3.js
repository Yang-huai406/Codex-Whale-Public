(() => {
  'use strict';
  const key = 'dshw-v3-feedback', events = { press: '按下', release: '松开', success: '完成提示', cancelled: '取消提示', failed: '拥挤失败提示' };
  const defaults = () => ({ feel: 'balanced', minPlayMs: 180, events: Object.fromEntries(Object.keys(events).map(k => [k, { preset: k === 'press' || k === 'release' || k === 'success' ? 'original' : 'silent', volume: .8 }])) });
  const clampMinPlayMs = value => { const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN; return Number.isFinite(n) ? Math.min(600, Math.max(0, Math.round(n))) : 180; };
  let settings = defaults();
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved) { settings.feel = saved.feel || settings.feel; settings.minPlayMs = clampMinPlayMs(saved.minPlayMs); for (const k of Object.keys(events)) if (saved.events?.[k]) settings.events[k] = saved.events[k]; } } catch {}
  function play(event, url, master = 1, override, preview = false) {
    const source = override || settings, cfg = source.events[event];
    if (!cfg) return false;
    const channel = preview ? 'preview' : event === 'press' || event === 'release' ? 'gesture' : 'notice';
    window.WhaleAudio.play({ channel, event: channel === 'gesture' ? event : undefined, url: Array.isArray(url) ? undefined : url, urls: Array.isArray(url) ? url : undefined, preset: cfg.preset, volume: cfg.preset === 'silent' ? 0 : cfg.volume * master, minPlayMs: source.minPlayMs });
    return true;
  }
  function open() {
    const draft = JSON.parse(JSON.stringify(settings)), dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    let clickPreviewTimer;
    const title = document.createElement('h2'); title.textContent = '音效、提示与手感'; dialog.append(title);
    const help = document.createElement('p'); help.textContent = '保存后生效；取消或 Esc 放弃本次修改。总音量仍控制所有事件。原音效使用现有音效组，新增预设为原创合成短音。'; dialog.append(help);
    const feelLabel = document.createElement('label'); feelLabel.textContent = '按压手感'; const feel = document.createElement('select');
    for (const [value, text] of Object.entries({ balanced: '均衡 · 75/140ms', crisp: '清脆 · 65/125ms', soft: '柔和 · 85/155ms' })) feel.add(new Option(text, value));
    feel.value = draft.feel; feel.onchange = () => { draft.feel = feel.value; }; feelLabel.append(feel); dialog.append(feelLabel);
    const minRow = document.createElement('fieldset'), minLegend = document.createElement('legend'); minLegend.textContent = '点击音效最短播放时间'; minRow.append(minLegend);
    const minPlay = document.createElement('input'); minPlay.type = 'range'; minPlay.min = '0'; minPlay.max = '600'; minPlay.step = '20'; minPlay.value = draft.minPlayMs; minPlay.setAttribute('aria-label', '点击音效最短播放时间');
    const minValue = document.createElement('output'); minValue.textContent = draft.minPlayMs + ' 毫秒';
    minPlay.oninput = () => { draft.minPlayMs = Number(minPlay.value); minValue.textContent = minPlay.value + ' 毫秒'; };
    const clickPreview = document.createElement('button'); clickPreview.type = 'button'; clickPreview.textContent = '试听点按';
    clickPreview.onclick = () => {
      clearTimeout(clickPreviewTimer); window.WhaleAudio.stop('gesture');
      const sources = window.WhaleFeedbackSources || {};
      play('press', sources.press ?? '/dsh-whale/sound/press.mp3?set=duck', 1, draft);
      clickPreviewTimer = setTimeout(() => {
        if (dialog.isConnected) play('release', sources.release ?? '/dsh-whale/sound/release.mp3?set=duck', 1, draft);
      }, 100);
    };
    const minHelp = document.createElement('p'); minHelp.textContent = '默认 180 毫秒。切换到下一段音效前，当前音效至少播放这段时间；短音效自然结束，快速连点只保留最新反馈。0 毫秒立即切换。';
    minRow.append(minPlay, minValue, clickPreview, minHelp); dialog.append(minRow);
    for (const [event, label] of Object.entries(events)) {
      const row = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = label; row.append(legend);
      const select = document.createElement('select');
      for (const [value, text] of Object.entries({ original: '现有音效', pearl: '珍珠', bubble: '水泡', glass: '风铃', silent: '静音' })) { if (value === 'original' && !['press','release','success'].includes(event)) continue; select.add(new Option(text, value)); }
      select.value = draft.events[event].preset; select.onchange = () => { draft.events[event].preset = select.value; };
      const volume = document.createElement('input'); volume.type = 'range'; volume.min = '0'; volume.max = '1'; volume.step = '.01'; volume.value = draft.events[event].volume; volume.setAttribute('aria-label', label + '音量');
      const number = document.createElement('output'); number.textContent = Math.round(volume.value * 100) + '%';
      volume.oninput = () => { draft.events[event].volume = Number(volume.value); number.textContent = Math.round(volume.value * 100) + '%'; };
      const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = '试听'; preview.onclick = () => play(event, window.WhaleFeedbackSources?.[event] || '/dsh-whale/sound/press.mp3?set=duck', 1, draft, true);
      row.append(select, volume, number, preview); dialog.append(row);
    }
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.onclick = () => dialog.close();
    const save = document.createElement('button'); save.textContent = '保存'; save.className = 'primary'; save.onclick = () => { try { localStorage.setItem(key, JSON.stringify(draft)); settings = draft; dialog.close(); } catch { window.whaleToast?.('设置未能保存，请检查存储空间。'); } };
    actions.append(cancel, save); dialog.append(actions); dialog.addEventListener('close', () => { clearTimeout(clickPreviewTimer); window.WhaleAudio.stop(); dialog.remove(); }); document.body.append(dialog); dialog.showModal();
  }
  window.WhaleFeedback = { play, open, get feel() { return settings.feel; } };
})();
