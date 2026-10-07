(() => {
  'use strict';
  let ctx, idle;
  const buffers = new Map(), pending = new Map(), active = new Map(), epochs = new Map(), tails = new Set();
  // Only interaction audio is coalesced. Pointer/animation events and complete
  // notification/preview sequences are independent of this sound scheduler.
  const FADE = .008, PRESS_GAP = .09, MAX_GESTURE_AGE = .25;
  let gesture = {};
  const clock = () => (typeof performance === 'object' ? performance.now() : Date.now()) / 1000;
  function context() { if (!ctx || ctx.state === 'closed') ctx = new AudioContext(); return ctx; }
  function touch() { clearTimeout(idle); idle = setTimeout(() => { stop(); buffers.clear(); pending.clear(); const old = ctx; ctx = null; old?.close().catch(() => {}); }, 60000); }
  async function warm(url) {
    if (!url) return null;
    touch();
    if (buffers.has(url)) return buffers.get(url);
    if (pending.has(url)) return pending.get(url);
    const c = context();
    const job = fetch(url).then(r => { if (!r.ok) throw Error('音频读取失败'); return r.arrayBuffer(); }).then(b => c.decodeAudioData(b)).then(b => { if (c === ctx) buffers.set(url, b); return b; }).finally(() => { if (pending.get(url) === job) pending.delete(url); });
    pending.set(url, job); return job;
  }
  function finish(voice) {
    if (voice.finished) return;
    voice.finished = true;
    voice.gain.disconnect();
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
    tails.delete(voice);
    if (active.get(voice.channel) === voice) active.delete(voice.channel);
  }
  function silence(voice) {
    for (const node of voice.nodes) { try { node.stop(); } catch {} }
    finish(voice);
  }
  function levelAt(voice, at) {
    if (voice.fade) return voice.fade.level * Math.max(0, Math.min(1, (voice.fade.end - at) / FADE));
    const t = at - voice.start;
    if (t <= 0 || at >= voice.end) return 0;
    if (voice.original) return voice.volume * Math.max(0, Math.min(1, t / voice.edge, (voice.end - at) / voice.edge));
    if (t < .012) return voice.volume * .15 * t / .012;
    if (t < .18) return voice.volume * .15 * Math.pow(.0001 / (voice.volume * .15), (t - .012) / .168);
    return .0001;
  }
  function fadeGesture() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const voices = new Set([...tails, active.get('gesture')].filter(Boolean));
    for (const voice of voices) {
      if (voice.end <= now || voice.fade && voice.fade.end <= now) { finish(voice); continue; }
      // Evaluate our envelope instead of AudioParam.value (which can be the
      // target value of a ramp). Retargeting an unfinished fade stays continuous.
      const level = levelAt(voice, now);
      if (!(level > 0)) { silence(voice); continue; }
      if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') voice.gain.gain.cancelAndHoldAtTime(now);
      else voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(level, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + FADE);
      voice.fade = { level, end: now + FADE };
      for (const node of voice.nodes) { try { node.stop(now + FADE); } catch {} }
      tails.add(voice);
    }
    active.delete('gesture');
  }
  function coalesce(event, now) {
    if (event === 'press') {
      // A repeated down while already held is not another click. In particular
      // it must not mark the eventual real release as a disposable burst pair.
      if (gesture.event === 'press') return true;
      if (gesture.pressAt !== undefined && now - gesture.pressAt < PRESS_GAP) { gesture.skipRelease = true; return true; }
      gesture.pressAt = now; gesture.skipRelease = false;
    } else if (event === 'release') {
      if (gesture.skipRelease) { gesture.skipRelease = false; return true; }
      if (gesture.event !== 'press' && gesture.releaseAt !== undefined && now - gesture.releaseAt < PRESS_GAP) return true;
      gesture.releaseAt = now;
    } else {
      // Legacy direct gesture callers have no press/release contract. Keep their
      // restart rate bounded too, without guessing an event from a URL.
      if (gesture.pulseAt !== undefined && now - gesture.pulseAt < PRESS_GAP) return true;
      gesture.pulseAt = now;
    }
    gesture.event = event;
    return false;
  }
  function stop(channel) {
    for (const key of channel ? [channel] : [...new Set([...active.keys(), ...epochs.keys(), ...[...tails].map(v => v.channel)])]) {
      epochs.set(key, (epochs.get(key) || 0) + 1);
      for (const voice of new Set([active.get(key), ...[...tails].filter(v => v.channel === key)].filter(Boolean))) silence(voice);
      active.delete(key);
    }
    if (!channel || channel === 'gesture') gesture = {};
  }
  async function play({ channel = 'preview', event, url, urls, preset = 'original', volume = .9 } = {}) {
    if (!(Number(volume) > 0) || preset === 'silent') { stop(channel); return; }
    const interaction = channel === 'gesture', requestedAt = clock();
    if (interaction) {
      if (coalesce(event, requestedAt)) return;
      epochs.set(channel, (epochs.get(channel) || 0) + 1);
      fadeGesture();
    } else stop(channel);
    const epoch = epochs.get(channel);
    try {
      const c = context(); touch(); await c.resume();
      // Decode the complete group before scheduling so release follows the full press.
      // A missing slot must not prevent the remaining slots from playing.
      const sequence = preset === 'original' ? (await Promise.all((urls || [url]).filter(Boolean).map(src => warm(src).catch(() => null)))).filter(Boolean) : [];
      if (epochs.get(channel) !== epoch || c !== ctx || interaction && clock() - requestedAt > MAX_GESTURE_AGE) return;
      const gain = c.createGain(); gain.connect(c.destination);
      const now = c.currentTime, nodes = [];
      const voice = { channel, gain, nodes, start: now, volume: Math.min(1, Number(volume)), original: preset === 'original' };
      if (preset === 'original') {
        if (!sequence.length) { gain.disconnect(); return; }
        voice.end = now + sequence.reduce((length, buffer) => length + buffer.duration, 0);
        if (interaction) {
          const edge = Math.min(FADE, (voice.end - now) / 2);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(voice.volume, now + edge);
          gain.gain.setValueAtTime(voice.volume, voice.end - edge);
          gain.gain.linearRampToValueAtTime(0, voice.end);
          voice.edge = edge;
        } else gain.gain.value = voice.volume;
        let offset = now;
        for (const buffer of sequence) {
          const source = c.createBufferSource(); source.buffer = buffer; source.connect(gain);
          nodes.push(source); source.start(offset); offset += buffer.duration;
        }
      } else {
        // Original procedural tones: no third-party samples or network assets.
        const tones = { pearl: [660, 880], bubble: [260, 520], glass: [1046, 1318] }[preset] || [440, 660];
        voice.end = now + .19;
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(voice.volume * .15, now + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .18);
        for (let i = 0; i < tones.length; i++) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(tones[i], now); o.connect(gain); nodes.push(o); o.start(now + i * .035); o.stop(now + .19); }
      }
      active.set(channel, voice);
      let ended = 0;
      for (const node of nodes) node.onended = () => { if (++ended === nodes.length) finish(voice); };
    } catch { /* Missing or unsupported audio must never block interaction. */ }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); ctx?.suspend().catch(() => {}); } });
  window.addEventListener('beforeunload', () => { stop(); clearTimeout(idle); ctx?.close().catch(() => {}); });
  window.WhaleAudio = Object.freeze({ warm, play, stop });
})();
