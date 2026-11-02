/* 信息星图 · 星空电台：把今晚的大事件说给你听
   用浏览器自带的嘴巴（语音合成），零钥匙零联网。
   v2 抗疲劳三件套：
     1. 挑嗓：优先"自然神经音"（Xiaoxiao/Yunxi 等 Natural 嗓），退而求 Google 普通话，最差才用老合成音；
        有两把好嗓子就轮流上场，双主播搭档。
     2. 稿子：英文标题换中文译名，刮掉方括号/网址/表情这类念不出口的渣，标题过长掐断。
     3. 气口：句与句之间真歇 0.4 秒，语速稍缓；开场白和结束语轮着换，不天天一个腔。
   点「电台」开播，播报中再点一下跳过当前句，字幕条上的「停」收播。 */
(function () {
  "use strict";
  var S = window.__STAR;
  if (!S || !S.items || !S.items.length) return;
  if (!("speechSynthesis" in window)) return;   // 这浏览器没嘴巴，不装电台

  var fab = document.getElementById("fabRadio");
  var bar = document.getElementById("radioBar");
  var txt = document.getElementById("radioText");
  var stopBtn = document.getElementById("radioStop");
  if (!fab || !bar || !txt || !stopBtn) return;

  /* ---------- 挑嗓：只要普通话，把最像人的排前面 ----------
     zh-CN（大陆普通话）优先；zh-HK 粤语、外语嗓绝不入库，宁缺毋滥交给系统默认。 */
  var VOICE_BONUS = [
    [/natural/i, 100], [/xiaoxiao|xiaoyi/i, 80], [/yunxi|yunyang|yunjian|yunne|yunhong/i, 75],
    [/google/i, 60], [/online/i, 30], [/kangkang|yaoyao|huihui/i, -40]
  ];
  var voicePool = [];

  function scoreVoice(v) {
    var s = 0, name = v.name || "";
    for (var i = 0; i < VOICE_BONUS.length; i++)
      if (VOICE_BONUS[i][0].test(name)) s += VOICE_BONUS[i][1];
    return s;
  }

  function pickVoices() {
    var cn = [], otherZh = [];
    (window.speechSynthesis.getVoices() || []).forEach(function (v) {
      var L = (v.lang || "").replace("_", "-").toLowerCase();
      if (L.indexOf("zh-cn") === 0) cn.push(v);
      else if (L.indexOf("zh") === 0) otherZh.push(v);   // 粤语/台湾腔：只有走投无路才用
    });
    var pool = (cn.length ? cn : otherZh).map(function (v) {
      return { v: v, s: scoreVoice(v) };
    }).sort(function (a, b) { return b.s - a.s; });
    voicePool = pool.slice(0, 2).map(function (x) { return x.v; });
    window.__RADIOVOICES = voicePool.map(function (v) { return v.name + " | " + v.lang; });
    // 绝不拿外语嗓念中文——没有就说 lang="zh-CN" 让系统自己挑
  }
  pickVoices();
  window.speechSynthesis.onvoiceschanged = pickVoices;

  /* ---------- 洗稿：把标题洗成念得出口的人话 ---------- */
  var JUNK = /\[[^\]]*\]|【[^】]*】|\([^)]*\)|（[^）]*）|https?:\/\/\S+|[|│/].*$|\b(?:vr|ar)\b/gi;

  function cleanSpeak(t) {
    t = String(t || "");
    t = t.replace(JUNK, " ");
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ");  // 表情
    t = t.replace(/[-—–::、，,。]+/g, function (m) { return m[0]; });
    t = t.replace(/\s+/g, " ").trim();
    if (t.length > 36) {                           // 掐断退到最近的断点，不留半截词
      var cut = t.slice(0, 34);
      var at = Math.max(cut.lastIndexOf("，"), cut.lastIndexOf(","), cut.lastIndexOf("、"),
                        cut.lastIndexOf(" "), cut.lastIndexOf("。"));
      t = (at > 14 ? cut.slice(0, at) : cut) + "，等等";
    }
    return t;
  }

  function looksSame(a, b) {                        // 两条 headline 讲同一件事就只念一条
    if (!a || !b) return false;
    var x = a.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "").slice(0, 8).toLowerCase();
    var y = b.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "").slice(0, 8).toLowerCase();
    return x.length > 4 && y.length > 4 && (x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0);
  }

  function zhTitle(d) {
    // 电台只说中文：有译名一定用译名
    return cleanSpeak((d && d.t_cn) ? d.t_cn : (d ? d.t : ""));
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------- 写稿 ---------- */
  function script() {
    var lines = [];
    var n = S.items.length, m = (S.events && S.events.length) || 0;
    lines.push(pick([
      "晚上好，这里是信息星图电台。今晚天上挂着" + n + "颗星，聚成了" + m + "桩大事。挑几桩亮的，说给你听。",
      "夜深了，信息星图电台，陪你看看今晚的天。星图上有" + n + "颗星，汇成" + m + "桩事，捡最亮的聊。",
      "欢迎收听信息星图电台。今晚星况不错——" + n + "颗星，" + m + "桩大事，咱们挑要紧的说。"
    ]));

    var evs = (S.events || []).slice(0, 4);
    var trans = ["先看头一桩。", "接着说这一桩。", "再来一件。", "还有一桩，有点意思。", "重点来了。"];
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var heads = [];
      for (var k = 0; k < ev.i.length && heads.length < 2; k++) {
        var t = zhTitle(S.items[ev.i[k]]);
        if (t && !heads.some(function (h) { return looksSame(h, t); })) heads.push(t);
      }
      if (!heads.length) continue;
      var cnt = ev.i.length <= 2 ? "两颗星凑到一起" : (ev.i.length + "颗星连成一片");
      lines.push(trans[Math.min(i, trans.length - 1)] + "「" + ev.n + "」，" + cnt + "。" +
                 heads.join("。另外，") + "。");
    }

    lines.push(pick([
      "今晚就说到这儿。星星已归档，明晚同一时间，再会。晚安。",
      "天上的事先聊到这。剩下的，你自己去看星。晚安，好梦。",
      "电台收工。世界照旧转，星星照旧亮。晚安。"
    ]));
    return lines;
  }

  /* ---------- 开口 ---------- */
  var playing = false, stopFlag = false, watchdog = null;

  function finish() {
    playing = false; stopFlag = false;
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    bar.classList.remove("show");
    fab.textContent = "电台";
    window.__RADIO = { playing: false, line: "" };
  }

  function say(text, idx, next) {
    txt.textContent = text;
    window.__RADIO = { playing: true, line: text };
    var u = new SpeechSynthesisUtterance(text);
    if (voicePool.length) u.voice = voicePool[idx % voicePool.length];   // 双主播轮班
    u.lang = (u.voice && u.voice.lang) || "zh-CN";
    u.rate = 0.95; u.pitch = 1.0;
    var done = false;
    function advance(extra) {
      if (done) return;
      done = true;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      setTimeout(next, extra);
    }
    u.onend = function () { advance(420); };                           // 句间真歇口气
    u.onerror = function () { advance(150); };
    watchdog = setTimeout(function () { advance(420); },               // 保底推进：有的环境不回调
      Math.max(4500, text.length * 230) + 500);
    window.speechSynthesis.speak(u);
  }

  function play(i, lines) {
    if (stopFlag) return finish();
    if (i >= lines.length) return finish();
    say(lines[i], i, function () { play(i + 1, lines); });
  }

  fab.addEventListener("click", function () {
    if (playing) {                    // 播报中再点 = 跳过当前句
      window.speechSynthesis.cancel();
      return;
    }
    window.speechSynthesis.cancel();
    pickVoices();                     // 嗓子名单是异步到的，开播前再点一次名
    stopFlag = false; playing = true;
    fab.textContent = "播报中";
    bar.classList.add("show");
    play(0, script());
  });

  stopBtn.addEventListener("click", function () {
    stopFlag = true;
    window.speechSynthesis.cancel();
    finish();
  });

  window.__RADIO = { playing: false, line: "" };
})();
