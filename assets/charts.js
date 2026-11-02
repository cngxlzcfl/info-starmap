/* 数据面板：各信息源进账图 + 今晚最亮的星 + 抓取异常如实播报 */
(function () {
  "use strict";
  var S = window.__STAR;
  if (!S) return;

  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue("--accent").trim();
  var ink = style.getPropertyValue("--ink").trim();
  var muted = style.getPropertyValue("--muted").trim();

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
  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* --- 面板开关 --- */
  var panel = document.getElementById("panel");
  document.getElementById("fab").addEventListener("click", function () {
    panel.classList.add("open");
    document.body.classList.add("panel-open");
  });
  document.getElementById("closePanel").addEventListener("click", function () {
    panel.classList.remove("open");
    document.body.classList.remove("panel-open");
  });

  /* --- 各信息源进账 --- */
  var counts = {};
  S.items.forEach(function (d) { counts[d.s] = (counts[d.s] || 0) + 1; });
  var names = Object.keys(counts).sort(function (a, b) { return counts[a] - counts[b]; });

  var chart = echarts.init(document.getElementById("chart-src"), null, { renderer: "svg" });
  chart.setOption({
    animation: false,
    backgroundColor: "transparent",
    grid: { left: 2, right: 36, top: 6, bottom: 2, containLabel: true },
    tooltip: { appendToBody: true, trigger: "axis", axisPointer: { type: "none" } },
    xAxis: { type: "value", splitLine: { show: false }, axisLabel: { show: false }, axisLine: { show: false } },
    yAxis: {
      type: "category", data: names,
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { show: false }, axisTick: { show: false }
    },
    series: [{
      type: "bar",
      data: names.map(function (n) {
        return { value: counts[n], itemStyle: { color: srcColor(n), borderRadius: [0, 5, 5, 0] } };
      }),
      barWidth: 10,
      label: { show: true, position: "right", color: ink, fontSize: 11 }
    }]
  });
  window.addEventListener("resize", function () { chart.resize(); });

  /* --- 今晚最亮的星（随中英切换重建）--- */
  function buildBright() {
    var top = S.items.map(function (d, i) { return { i: i, d: d }; })
      .filter(function (x) { return x.d.h > 0; })
      .sort(function (a, b) { return b.d.h - a.d.h; })
      .slice(0, 8);
    var ol = document.getElementById("bright");
    ol.innerHTML = "";
    top.forEach(function (x, rank) {
      var t = (S.lang && S.lang() && x.d.t_cn) ? x.d.t_cn : x.d.t;
      var li = document.createElement("li");
      li.innerHTML = '<a href="javascript:void(0)"><span class="rk">' + (rank + 1) +
        '</span><span class="tt">' + esc(t) +
        '</span><span class="ht">' + esc(x.d.x || "") + "</span></a>";
      li.querySelector("a").addEventListener("click", function () { S.flyTo(x.i); });
      ol.appendChild(li);
    });
    if (!top.length) {
      var li0 = document.createElement("li");
      li0.innerHTML = '<span class="tt" style="color:' + muted + '">今晚这些源都没报热度数字，星星一样亮</span>';
      ol.appendChild(li0);
    }
  }
  buildBright();
  window.addEventListener("starmaplang", buildBright);

  /* --- 今晚大事件（点名字飞到事件里最亮那颗星）--- */
  function buildEvents() {
    var ol = document.getElementById("events");
    var head = document.getElementById("evHead");
    if (!ol || !head) return;
    ol.innerHTML = "";
    if (!S.events || !S.events.length) {
      head.style.display = "none"; ol.style.display = "none"; return;
    }
    head.style.display = ""; ol.style.display = "";
    S.events.slice().sort(function (a, b) {
      function top(ev) { return Math.max.apply(null, ev.i.map(function (ix) { return S.items[ix].h || 0; })); }
      return top(b) - top(a);
    }).forEach(function (ev) {
      var li = document.createElement("li");
      li.innerHTML = '<a href="javascript:void(0)"><span class="rk" style="color:' + ev.c +
        '">◆</span><span class="tt">' + esc(ev.n) +
        '</span><span class="ht">' + ev.i.length + "星</span></a>";
      li.querySelector("a").addEventListener("click", function () { S.flyTo(ev.i[0]); });
      ol.appendChild(li);
    });
  }
  buildEvents();
  window.addEventListener("starmaplang", buildEvents);

  /* --- 抓取异常如实播报 --- */
  if (S.errors && S.errors.length) {
    document.getElementById("perr").textContent = "今晚没抓到的源：" + S.errors.join("；");
  }
})();
