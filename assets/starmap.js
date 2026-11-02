/* 信息星图 · 夜空引擎
   把新闻渲染成星星：热度定大小亮度，标题相似度定星宿连线，
   力导向布局让同类新闻自然聚成星座。 */
(function () {
  "use strict";

  var DATA = window.STARDATA || { date: "", items: [], errors: [] };
  var items = DATA.items || [];
  var canvas = document.getElementById("sky");
  var ctx = canvas.getContext("2d");
  var card = document.getElementById("card");
  var subEl = document.getElementById("sub");
  var legendEl = document.getElementById("legend");

  /* ---------- 信息源配色 ---------- */
  var SRC_META = [
    { match: "V2EX", c: "#7d9bff" },
    { match: "HackerNews", c: "#ff8a5c" },
    { match: "SideProject", c: "#ffd166" },
    { match: "Reddit独立项目", c: "#ffd166" },
    { match: "SaaS", c: "#6ee7b7" },
    { match: "愿望雷达", c: "#f472b6" },
    { match: "小众软件", c: "#38bdf8" },
    { match: "少数派", c: "#c084fc" },
    { match: "阮一峰", c: "#4ade80" },
    { match: "36氪", c: "#fb7185" }
  ];
  function srcColor(name) {
    for (var i = 0; i < SRC_META.length; i++)
      if (name.indexOf(SRC_META[i].match) !== -1) return SRC_META[i].c;
    return "#9aa7c7";
  }

  var W = 0, H = 0, DPR = 1;
  var view = { x: 0, y: 0, k: 1 };
  var hoverId = -1, mouse = { x: -1, y: -1 };
  var soloSrc = null, isCN = false;
  var edges = [];
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 分词（中文双字 + 英文词）---------- */
  var STOP = {};
  ("the,and,for,with,this,that,you,are,was,from,not,have,has,will,your,what,when,how,why," +
   "who,its,into,can,all,get,got,out,one,two,new,now,use,using,used,make,made,just,like," +
   "about,would,could,should,than,then,them,they,there,here,been,being,were,more,most,some," +
   "any,but,our,his,her,she,him,did,does,done,had,com,http,https,www,html,amp," +
   "什么,怎么,如何,一个,没有,可以,就是,还是,这个,那个,是不是,为什么,大家,你们,我们,他们," +
   "自己,现在,时候,问题,感觉,觉得,真的,知道,出来,起来,过来,一下,一些,以后,因为,所以,但是,如果")
    .split(",").forEach(function (w) { STOP[w] = 1; });

  function tokenize(s) {
    s = (s || "").toLowerCase();
    var set = new Set(), m, re;
    re = /[a-z0-9][a-z0-9'+.#-]{1,}/g;
    while ((m = re.exec(s))) if (!STOP[m[0]]) set.add(m[0]);
    var zh = s.match(/[\u4e00-\u9fff]+/g) || [];
    zh.forEach(function (seg) {
      for (var i = 0; i < seg.length - 1; i++) {
        var bg = seg.slice(i, i + 2);
        if (!STOP[bg]) set.add(bg);
      }
    });
    return set;
  }

  /* ---------- 准备星星 ---------- */
  var rng = mulberry32(20261022);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var heats = items.map(function (d) { return d.h || 0; }).sort(function (a, b) { return a - b; });
  var hMax = heats.length ? heats[Math.floor(heats.length * 0.95)] || heats[heats.length - 1] : 1;
  if (hMax < 1) hMax = 1;

  items.forEach(function (d, i) {
    d._c = srcColor(d.s);
    d._tok = tokenize(d.t + " " + d.m);
    d._r = 2.1 + 6.2 * Math.sqrt(Math.min(1, (d.h || 0) / hMax));
    d._phase = rng() * Math.PI * 2;
    d._speed = 0.6 + rng() * 0.9;
  });

  /* ---------- 相似度连线 ---------- */
  (function buildEdges() {
    var pairs = [];
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var a = items[i]._tok, b = items[j]._tok;
        if (!a.size || !b.size) continue;
        var inter = 0;
        a.forEach(function (t) { if (b.has(t)) inter++; });
        var sim = inter / Math.sqrt(a.size * b.size);
        if (sim >= 0.15) pairs.push([i, j, sim]);
      }
    }
    pairs.sort(function (p, q) { return q[2] - p[2]; });
    var deg = new Array(items.length).fill(0);
    for (var k = 0; k < pairs.length && edges.length < 200; k++) {
      var e = pairs[k];
      if (deg[e[0]] < 4 && deg[e[1]] < 4) {
        edges.push(e);
        deg[e[0]]++; deg[e[1]]++;
      }
    }
  })();

  /* ---------- 大事件聚类（可选叠加层：日期对不上或缺文件就整体退回旧行为）---------- */
  var EV_COLORS = ["#7d9bff", "#ff8a5c", "#6ee7b7", "#ffd166", "#f472b6", "#38bdf8",
    "#c084fc", "#4ade80", "#fb7185", "#f59e0b", "#22d3ee", "#a3e635", "#e879f9",
    "#fca5a5", "#93c5fd", "#fdba74", "#5eead4", "#d8b4fe", "#fde047", "#86efac"];
  var EVENTS = [], evOf = {}, evEdges = [];
  (function buildEvents() {
    var raw = window.STAREVENTS;
    if (!raw || !raw.list || !raw.list.length) return;
    if (String(raw.date || "") !== String(DATA.date || "").slice(0, 10)) return; // 只比年月日
    raw.list.forEach(function (ev, ei) {
      if (!ev || !ev.n) return;
      var mem = (ev.i || []).filter(function (ix) { return ix >= 0 && ix < items.length; });
      if (mem.length < 2) return;
      mem.sort(function (a, b) { return (items[b].h || 0) - (items[a].h || 0) || a - b; });
      ev.i = mem;
      ev.c = EV_COLORS[ei % EV_COLORS.length];
      EVENTS.push(ev);
    });
    EVENTS.forEach(function (ev, ei) {
      for (var k = 0; k < ev.i.length; k++) {
        evOf[ev.i[k]] = ei;
        if (k > 0) evEdges.push([ev.i[k - 1], ev.i[k], ei]); // 按热度串成星座链
      }
    });
  })();

  /* ---------- 星宿聚类 + 力导向布局 ---------- */
  var parent = items.map(function (_, i) { return i; });
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  edges.forEach(function (e) {
    var a = find(e[0]), b = find(e[1]);
    if (a !== b) parent[b] = a;
  });

  (function layout() {
    var n = items.length;
    var px = new Array(n), py = new Array(n), vx = new Array(n), vy = new Array(n);
    var R = 300;
    for (var i = 0; i < n; i++) {
      var root = EVENTS.length
        ? (evOf[i] !== undefined ? evOf[i] : EVENTS.length + (i % 41)) // 有事件按事件撒种子，散星另给方位
        : find(i);                                                     // 没有则退回星宿根
      var ang = (root * 2.399) % (Math.PI * 2); // 黄金角散开各星座
      px[i] = Math.cos(ang) * R + (rng() - 0.5) * 120;
      py[i] = Math.sin(ang) * R + (rng() - 0.5) * 120;
      vx[i] = 0; vy[i] = 0;
    }
    var ITER = reduced ? 120 : 320;
    for (var it = 0; it < ITER; it++) {
      var cool = 1 - it / ITER;
      for (var a = 0; a < n; a++) {
        for (var b = a + 1; b < n; b++) {
          var dx = px[a] - px[b], dy = py[a] - py[b];
          var d2 = dx * dx + dy * dy + 0.01;
          if (d2 < 360000) {
            var f = 1900 / d2;
            var fx = dx * f, fy = dy * f;
            vx[a] += fx; vy[a] += fy;
            vx[b] -= fx; vy[b] -= fy;
          }
        }
      }
      for (var e = 0; e < edges.length; e++) {
        var i0 = edges[e][0], i1 = edges[e][1];
        var ddx = px[i1] - px[i0], ddy = py[i1] - py[i0];
        var dist = Math.sqrt(ddx * ddx + ddy * ddy) + 0.01;
        var want = 64 - edges[e][2] * 26;
        var fs = (dist - want) * 0.018;
        var fsx = (ddx / dist) * fs, fsy = (ddy / dist) * fs;
        vx[i0] += fsx; vy[i0] += fsy;
        vx[i1] -= fsx; vy[i1] -= fsy;
      }
      for (var e2 = 0; e2 < evEdges.length; e2++) { // 事件链弹簧：同事件抱团成串
        var j0 = evEdges[e2][0], j1 = evEdges[e2][1];
        var ddx2 = px[j1] - px[j0], ddy2 = py[j1] - py[j0];
        var dist2 = Math.sqrt(ddx2 * ddx2 + ddy2 * ddy2) + 0.01;
        var fs2 = (dist2 - 78) * 0.024;
        var fx2 = (ddx2 / dist2) * fs2, fy2 = (ddy2 / dist2) * fs2;
        vx[j0] += fx2; vy[j0] += fy2;
        vx[j1] -= fx2; vy[j1] -= fy2;
      }
      for (var s = 0; s < n; s++) {
        vx[s] -= px[s] * 0.0016; vy[s] -= py[s] * 0.0016; // 轻轻往圆心拢
        vx[s] *= 0.82; vy[s] *= 0.82;
        px[s] += vx[s] * (0.35 + cool * 0.65);
        py[s] += vy[s] * (0.35 + cool * 0.65);
      }
    }
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var p = 0; p < n; p++) {
      items[p]._x = px[p]; items[p]._y = py[p];
      if (px[p] < minX) minX = px[p]; if (px[p] > maxX) maxX = px[p];
      if (py[p] < minY) minY = py[p]; if (py[p] > maxY) maxY = py[p];
    }
    items._bounds = { x0: minX, y0: minY, x1: maxX, y1: maxY };
  })();

  EVENTS.forEach(function (ev) { // 事件名标签锚点 = 成员重心
    var cx = 0, cy = 0;
    ev.i.forEach(function (ix) { cx += items[ix]._x; cy += items[ix]._y; });
    ev._cx = cx / ev.i.length; ev._cy = cy / ev.i.length;
  });

  /* ---------- 背景星空 ---------- */
  var bg = document.createElement("canvas");
  var bctx = bg.getContext("2d");
  var twinkles = [];
  function paintBg() {
    if (!W || !H) return;
    bg.width = W; bg.height = H;
    bctx.fillStyle = "#060913";
    bctx.fillRect(0, 0, W, H);
    var nebulas = [
      [W * 0.22, H * 0.3, W * 0.42, "123,155,255", 0.05],
      [W * 0.75, H * 0.62, W * 0.38, "244,114,182", 0.04],
      [W * 0.55, H * 0.12, W * 0.3, "56,189,248", 0.035]
    ];
    nebulas.forEach(function (nb) {
      var g = bctx.createRadialGradient(nb[0], nb[1], 0, nb[0], nb[1], nb[2]);
      g.addColorStop(0, "rgba(" + nb[3] + "," + nb[4] + ")");
      g.addColorStop(1, "rgba(" + nb[3] + ",0)");
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, W, H);
    });
    var brrng = mulberry32(7);
    var count = Math.floor(W * H / 5200);
    twinkles = [];
    for (var i = 0; i < count; i++) {
      var x = brrng() * W, y = brrng() * H, r = 0.35 + brrng() * 1.0;
      var al = 0.12 + brrng() * 0.5;
      bctx.fillStyle = "rgba(220,228,255," + al + ")";
      bctx.beginPath(); bctx.arc(x, y, r, 0, 6.284); bctx.fill();
      if (i % 12 === 0 && twinkles.length < 140)
        twinkles.push({ x: x, y: y, r: r + 0.4, ph: brrng() * 6.28, sp: 0.5 + brrng() });
    }
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    paintBg();
    fitView();
  }

  function fitView() {
    var bd = items._bounds;
    var bw = Math.max(60, bd.x1 - bd.x0), bh = Math.max(60, bd.y1 - bd.y0);
    var k = Math.min((W - 120) / bw, (H - 210) / bh, 1.7);
    k = Math.max(k, 0.3);
    view.k = k;
    view.x = (bd.x0 + bd.x1) / 2;
    view.y = (bd.y0 + bd.y1) / 2;
  }

  function toScreen(wx, wy) {
    return [(wx - view.x) * view.k + W / 2, (wy - view.y) * view.k + H / 2];
  }
  function toWorld(sx, sy) {
    return [(sx - W / 2) / view.k + view.x, (sy - H / 2) / view.k + view.y];
  }

  /* ---------- 渲染循环 ---------- */
  var top6 = items.map(function (d, i) { return [i, d._r]; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6).map(function (p) { return p[0]; });

  function draw(t) {
    if (!W || !H || !bg.width || !bg.height) { requestAnimationFrame(draw); return; }
    ctx.drawImage(bg, 0, 0, W, H);
    if (!reduced) {
      twinkles.forEach(function (s) {
        var al = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph));
        ctx.fillStyle = "rgba(225,232,255," + al + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.284); ctx.fill();
      });
    }

    // 连线：先淡的关键词线，再亮的大事件线
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i], A = items[e[0]], B = items[e[1]];
      if (isDim(A) || isDim(B)) continue;
      var hl = hoverId >= 0 && (e[0] === hoverId || e[1] === hoverId);
      var fade = hoverId >= 0 && !hl ? 0.25 : 1;
      var al2 = (0.06 + e[2] * 0.4) * fade * (EVENTS.length ? 0.55 : 1);
      var pa = toScreen(A._x, A._y), pb = toScreen(B._x, B._y);
      ctx.strokeStyle = hl ? "rgba(255,184,107," + Math.min(0.85, al2 + 0.4) + ")"
                           : "rgba(150,170,255," + al2 + ")";
      ctx.lineWidth = hl ? 1.3 : Math.max(0.4, e[2] * 1.4);
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    }
    for (var ei2 = 0; ei2 < evEdges.length; ei2++) {
      var ee = evEdges[ei2], A2 = items[ee[0]], B2 = items[ee[1]], ev2 = EVENTS[ee[2]];
      if (isDim(A2) || isDim(B2)) continue;
      var myEv = evOf[hoverId];
      var hot = hoverId >= 0 && myEv === ee[2]; // 悬停某颗星，它整个星座亮起
      var fade2 = hoverId >= 0 && !hot ? 0.28 : 1;
      var pa2 = toScreen(A2._x, A2._y), pb2 = toScreen(B2._x, B2._y);
      ctx.strokeStyle = hexA(ev2.c, (hot ? 0.95 : 0.4) * fade2);
      ctx.lineWidth = hot ? 2.6 : 1.7;
      ctx.beginPath(); ctx.moveTo(pa2[0], pa2[1]); ctx.lineTo(pb2[0], pb2[1]); ctx.stroke();
    }

    // 星星
    var order = items.map(function (_, i) { return i; })
      .sort(function (a, b) { return items[b]._r - items[a]._r; });
    for (var j = 0; j < order.length; j++) {
      var idx = order[j], d = items[idx];
      var sp = toScreen(d._x, d._y);
      if (sp[0] < -40 || sp[0] > W + 40 || sp[1] < -40 || sp[1] > H + 40) continue;
      var dimmed = isDim(d);
      var hov = idx === hoverId;
      var tw = reduced ? 1 : 0.82 + 0.18 * Math.sin(t * 0.0012 * d._speed + d._phase);
      var r = d._r * view.k * (hov ? 1.35 : 1);
      var alpha = (dimmed ? 0.14 : 1) * tw;

      var glow = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], Math.max(6, r * 3.4));
      glow.addColorStop(0, hexA(d._c, 0.4 * alpha));
      glow.addColorStop(1, hexA(d._c, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sp[0], sp[1], Math.max(6, r * 3.4), 0, 6.284); ctx.fill();

      ctx.fillStyle = hexA(d._c, 0.95 * alpha);
      ctx.beginPath(); ctx.arc(sp[0], sp[1], Math.max(1, r), 0, 6.284); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255," + (hov ? 0.95 : 0.55) * alpha + ")";
      ctx.beginPath(); ctx.arc(sp[0], sp[1], Math.max(0.6, r * 0.42), 0, 6.284); ctx.fill();

      if (hov) {
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sp[0], sp[1], r + 5, 0, 6.284); ctx.stroke();
      }
      if (hov || top6.indexOf(idx) !== -1) {
        ctx.font = "11px 'Microsoft YaHei',sans-serif";
        ctx.textAlign = "center";
        var label = dispT(d).length > 22 ? dispT(d).slice(0, 21) + "…" : dispT(d);
        ctx.fillStyle = "rgba(6,9,19,.55)";
        var wdt = ctx.measureText(label).width;
        ctx.fillRect(sp[0] - wdt / 2 - 4, sp[1] - r - 20, wdt + 8, 15);
        ctx.fillStyle = hov ? "rgba(233,237,255,.98)" : "rgba(233,237,255,.72)";
        ctx.fillText(label, sp[0], sp[1] - r - 9);
      }
    }

    // 事件名标签（画在星星上层，成员重心下方）
    if (EVENTS.length) {
      ctx.font = "600 12px 'Microsoft YaHei',sans-serif";
      ctx.textAlign = "center";
      for (var le = 0; le < EVENTS.length; le++) {
        var ev3 = EVENTS[le];
        if (isDim(items[ev3.i[0]])) continue;
        var hot3 = hoverId >= 0 && evOf[hoverId] === le;
        var sp3 = toScreen(ev3._cx, ev3._cy + 26);
        if (sp3[0] < -80 || sp3[0] > W + 80 || sp3[1] < -24 || sp3[1] > H + 24) continue;
        var txt3 = ev3.n + " ·" + ev3.i.length + "星";
        var w3 = ctx.measureText(txt3).width;
        ctx.fillStyle = "rgba(6,9,19," + (hot3 ? 0.78 : 0.6) + ")";
        ctx.fillRect(sp3[0] - w3 / 2 - 7, sp3[1] - 11, w3 + 14, 19);
        ctx.fillStyle = hexA(ev3.c, hot3 ? 1 : 0.85);
        ctx.fillText(txt3, sp3[0], sp3[1] + 3);
      }
    }
    requestAnimationFrame(draw);
  }

  function hexA(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  function isDim(d) { return soloSrc !== null && d.s !== soloSrc; }

  /* ---------- 故事卡 ---------- */
  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function dispT(d) { return isCN && d.t_cn ? d.t_cn : d.t; }
  function dispM(d) { return isCN && d.m_cn ? d.m_cn : d.m; }
  function showCard(i, mx, my) {
    var d = items[i];
    document.getElementById("cardT").innerHTML =
      '<a href="' + esc(d.u) + '" target="_blank" rel="noopener">' + esc(dispT(d)) + "</a>";
    var fit = d.k ? '<span class="badge fit">对口 ' + d.k + "/10</span>" : "";
    var mt = isCN && d.t_cn ? '<span class="badge">机翻</span>' : "";
    var evb = evOf[i] !== undefined
      ? '<span class="badge" style="color:' + EVENTS[evOf[i]].c + ';border-color:' +
        EVENTS[evOf[i]].c + ';font-weight:700">大事件：' + esc(EVENTS[evOf[i]].n) + "</span>"
      : "";
    document.getElementById("cardB").innerHTML =
      '<span class="badge src" style="background:' + d._c + '">' + esc(d.s) + "</span>" +
      evb + (d.x ? '<span class="badge">' + esc(d.x) + "</span>" : "") + fit + mt;
    document.getElementById("cardM").textContent = dispM(d) || "（这条没有摘要，点星星直接看原文）";
    document.getElementById("cardC").textContent = d.c ? "秘书点评：" + d.c : "";
    card.classList.add("show");
    var cw = 320, ch = card.offsetHeight || 160;
    var x = Math.min(Math.max(12, mx + 16), W - cw - 12);
    var y = Math.min(Math.max(12, my + 16), H - ch - 12);
    if (my + ch + 30 > H) y = Math.max(12, my - ch - 16);
    card.style.left = x + "px";
    card.style.top = y + "px";
  }
  function hideCard() { card.classList.remove("show"); }

  /* ---------- 交互 ---------- */
  var drag = null;
  canvas.addEventListener("mousedown", function (ev) {
    drag = { sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, moved: false };
    canvas.classList.add("dragging");
  });
  window.addEventListener("mousemove", function (ev) {
    mouse.x = ev.clientX; mouse.y = ev.clientY;
    if (drag) {
      var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      view.x = drag.vx - dx / view.k;
      view.y = drag.vy - dy / view.k;
      hideCard(); hoverId = -1;
      return;
    }
    var hit = pick(ev.clientX, ev.clientY);
    hoverId = hit;
    if (hit >= 0) showCard(hit, ev.clientX, ev.clientY); else hideCard();
  });
  window.addEventListener("mouseup", function (ev) {
    if (drag && !drag.moved && hoverId >= 0) {
      window.open(items[hoverId].u, "_blank", "noopener");
    }
    drag = null;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var factor = Math.pow(1.0015, -ev.deltaY);
    var nk = Math.min(4, Math.max(0.3, view.k * factor));
    var wpt = toWorld(ev.clientX, ev.clientY);
    view.k = nk;
    var spt = toScreen(wpt[0], wpt[1]);
    view.x += (ev.clientX - spt[0]) / nk;
    view.y += (ev.clientY - spt[1]) / nk;
  }, { passive: false });

  function pick(sx, sy) {
    var best = -1, bd = 1e9;
    for (var i = 0; i < items.length; i++) {
      var d = items[i];
      if (isDim(d)) continue;
      var sp = toScreen(d._x, d._y);
      var dd = Math.hypot(sp[0] - sx, sp[1] - sy);
      var lim = Math.max(13, d._r * view.k + 8);
      if (dd < lim && dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  // 触屏：单指拖动，双指缩放，轻点开卡片
  var touches = {};
  canvas.addEventListener("touchstart", function (ev) {
    for (var i = 0; i < ev.changedTouches.length; i++)
      touches[ev.changedTouches[i].identifier] = { x: ev.changedTouches[i].clientX, y: ev.changedTouches[i].clientY };
    if (ev.changedTouches.length === 1) {
      drag = { sx: ev.changedTouches[0].clientX, sy: ev.changedTouches[0].clientY, vx: view.x, vy: view.y, moved: false };
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", function (ev) {
    ev.preventDefault();
    var ids = Object.keys(touches);
    if (ev.changedTouches.length === 2 && ids.length >= 2) {
      var t0 = touches[ids[0]], t1 = touches[ids[1]];
      var d0 = Math.hypot(t0.x - t1.x, t0.y - t1.y);
      var n0 = ev.touches[0], n1 = ev.touches[1];
      var d1 = Math.hypot(n0.clientX - n1.clientX, n0.clientY - n1.clientY);
      view.k = Math.min(4, Math.max(0.3, view.k * (d1 / (d0 || 1))));
      touches[ids[0]] = { x: n0.clientX, y: n0.clientY };
      touches[ids[1]] = { x: n1.clientX, y: n1.clientY };
    } else if (drag && ev.changedTouches.length === 1) {
      var t = ev.changedTouches[0];
      var dx = t.clientX - drag.sx, dy = t.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      view.x = drag.vx - dx / view.k;
      view.y = drag.vy - dy / view.k;
      touches[ev.changedTouches.identifier] = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });
  canvas.addEventListener("touchend", function (ev) {
    if (drag && !drag.moved) {
      var hit = pick(drag.sx, drag.sy);
      if (hit >= 0) showCard(hit, drag.sx, drag.sy);
      else hideCard();
    }
    drag = null; touches = {};
  });

  /* ---------- 图例 ---------- */
  (function buildLegend() {
    var counts = {};
    items.forEach(function (d) { counts[d.s] = (counts[d.s] || 0) + 1; });
    var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    names.forEach(function (name) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = '<span class="dot" style="background:' + srcColor(name) + '"></span>' +
        esc(name) + ' <span class="n">' + counts[name] + "</span>";
      chip.addEventListener("click", function () {
        soloSrc = (soloSrc === name) ? null : name;
        Array.prototype.forEach.call(legendEl.children, function (c) { c.classList.remove("solo", "off"); });
        if (soloSrc) {
          Array.prototype.forEach.call(legendEl.children, function (c) {
            if (c.textContent.indexOf(name) === -1) c.classList.add("off");
            else c.classList.add("solo");
          });
        }
      });
      legendEl.appendChild(chip);
    });
  })();

  /* ---------- 顶部统计 ---------- */
  (function stats() {
    var n = items.length;
    var srcN = new Set(items.map(function (d) { return d.s; })).size;
    subEl.innerHTML = esc(DATA.date || "") + " 实时抓取 · <b>" + n + "</b> 颗星 · <b>" +
      edges.length + "</b> 条星线 · <b>" + srcN + "</b> 个信息源" +
      (EVENTS.length ? " · <b>" + EVENTS.length + "</b> 个大事件" : "") +
      "<br>同一件事的星连成同色星座，悬停一颗点亮整片";
  })();

  /* ---------- 给面板用的接口 ---------- */
  window.__STAR = {
    items: items,
    edges: edges,
    events: EVENTS,
    date: DATA.date,
    errors: DATA.errors || [],
    hover: function () { return hoverId; },
    lang: function () { return isCN; },
    flyTo: function (i, cb) {
      var d = items[i];
      var target = { x: d._x, y: d._y, k: Math.max(view.k, 1.5) };
      var from = { x: view.x, y: view.y, k: view.k }, t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / 700);
        var e = 1 - Math.pow(1 - p, 3);
        view.x = from.x + (target.x - from.x) * e;
        view.y = from.y + (target.y - from.y) * e;
        view.k = from.k + (target.k - from.k) * e;
        if (p < 1) requestAnimationFrame(step);
        else {
          var sp = toScreen(d._x, d._y);
          hoverId = i;
          showCard(i, sp[0] - 170, sp[1] - 40);
          if (cb) cb();
        }
      }
      requestAnimationFrame(step);
    }
  };

  /* ---------- 一键翻译 ---------- */
  var fabLang = document.getElementById("fabLang");
  fabLang.addEventListener("click", function () {
    isCN = !isCN;
    fabLang.textContent = isCN ? "看英文原味" : "译成中文";
    window.dispatchEvent(new CustomEvent("starmaplang"));
    if (hoverId >= 0) showCard(hoverId, mouse.x, mouse.y);
    else hideCard();
  });

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
})();
