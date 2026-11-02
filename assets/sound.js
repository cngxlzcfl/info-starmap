/* 信息星图 · 会唱歌的星空（点右上角「音效」开关）
   悬停星星 = 五声音阶琴音（越热的星音越低沉）；
   悬停星座成员 = 三音风铃荡开；音效开着时夜空底下有一层深夜低鸣。
   纯浏览器自带发声，零钥匙零文件。 */
(function () {
  "use strict";
  var S = window.__STAR;
  if (!S || !S.items || !S.items.length) return;

  var fab = document.getElementById("fabSound");
  if (!fab) return;

  var actx = null, master = null, drone = null, droneGain = null;
  var on = false, prev = -2;

  // C 宫五声音阶跨两个八度：随手乱弹都好听
  var SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.26, 784.0, 880.0];
  var hMax = 1;
  S.items.forEach(function (d) { if ((d.h || 0) > hMax) hMax = d.h || 0; });

  function ensureAudio() {
    if (actx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0.5;
    master.connect(actx.destination);
  }

  function startDrone() {          // 深夜低鸣：两只微微跑调的低音钟，慢慢呼吸
    droneGain = actx.createGain();
    droneGain.gain.value = 0.0001;
    var lp = actx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 240;
    droneGain.connect(lp); lp.connect(master);
    drone = [110.0, 110.7].map(function (f) {
      var o = actx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      o.connect(droneGain); o.start();
      return o;
    });
    var lfo = actx.createOscillator(), lg = actx.createGain();
    lfo.frequency.value = 0.06; lg.gain.value = 0.014;
    lfo.connect(lg); lg.connect(droneGain.gain); lfo.start();
    drone.push(lfo);
    droneGain.gain.linearRampToValueAtTime(0.032, actx.currentTime + 2.5);
  }

  function stopDrone() {
    if (!drone) return;
    droneGain.gain.linearRampToValueAtTime(0.0001, actx.currentTime + 0.8);
    var olds = drone, og = droneGain;
    drone = null; droneGain = null;
    setTimeout(function () {
      olds.forEach(function (o) { try { o.stop(); } catch (e) {} });
      try { og.disconnect(); } catch (e) {}
    }, 900);
  }

  function chime(freq, delay, vol, dur) {   // 一声琴音：正弦主音 + 一点点三角波亮头
    var t = actx.currentTime + (delay || 0);
    var g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 1.6));
    var o1 = actx.createOscillator(); o1.type = "sine"; o1.frequency.value = freq;
    var o2 = actx.createOscillator(); o2.type = "triangle"; o2.frequency.value = freq * 2.001;
    var g2 = actx.createGain(); g2.gain.value = 0.16;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    o1.start(t); o2.start(t);
    o1.stop(t + (dur || 1.6) + 0.05); o2.stop(t + (dur || 1.6) + 0.05);
  }

  function noteFor(d) {
    var hot = Math.min(1, (d.h || 0) / (hMax || 1));
    return SCALE[9 - Math.round(hot * 9)];   // 越热的星，落音越低越稳
  }

  function onHoverChange(idx) {
    if (!on || idx < 0) return;
    var d = S.items[idx];
    if (!d) return;
    var evIdx = -1;
    if (S.events && S.events.length) {
      for (var e = 0; e < S.events.length; e++)
        if (S.events[e].i.indexOf(idx) !== -1) { evIdx = e; break; }
    }
    chime(noteFor(d), 0, 0.15, 1.4);         // 这颗星自己的音
    if (evIdx >= 0) {                        // 所属星座：风铃荡两下
      var base = evIdx % 5;
      chime(SCALE[base + 2], 0.13, 0.07, 1.7);
      chime(SCALE[base + 4], 0.27, 0.05, 1.9);
    }
  }

  // 盯住星空的悬停变化（星空引擎把 hoverId 借给我们）
  (function tick() {
    var cur = S.hover ? S.hover() : -1;
    if (cur !== prev) { onHoverChange(cur); prev = cur; }
    requestAnimationFrame(tick);
  })();

  fab.addEventListener("click", function () {
    ensureAudio();
    if (actx.state === "suspended") actx.resume();
    on = !on;
    fab.textContent = on ? "音效·开着" : "音效·关着";
    if (on) startDrone(); else stopDrone();
    window.__SOUND = { on: on, state: function () { return actx ? actx.state : "off"; } };
  });
})();
