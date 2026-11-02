/* 信息星图 · 时光机按钮条
   星空更新脚本每天盘点 history 快照写成 history_manifest.js，
   这里照着名单生成"今晚 + 各日期"的切换条；正在回放时点亮日期并挂琥珀色"回放中"标记。 */
(function(){
  var days = (window.STARHISTORY || []).slice().reverse();
  var cur = (location.search.match(/[?&]d=(\d{4}-\d{2}-\d{2})/) || [])[1] || "";
  if (!days.length && !cur) return;

  var css = document.createElement("style");
  css.textContent =
    "#tmBar{position:fixed;left:14px;bottom:14px;z-index:999;display:flex;gap:6px;align-items:center;flex-wrap:wrap;" +
    "font-family:'Courier New',Consolas,monospace;padding:6px 8px;border:1px solid rgba(28,39,64,.9);background:rgba(6,10,18,.82)}" +
    "#tmBar .lab{font-size:10px;color:#66748f;letter-spacing:2px}" +
    "#tmBar a{font-size:11px;color:#8fa3c7;text-decoration:none;border:1px solid #1c2740;background:rgba(11,17,31,.9);padding:3px 9px;letter-spacing:1px}" +
    "#tmBar a:hover{border-color:#7f9cff;color:#c9d6ee}" +
    "#tmBar a.on{color:#0b111f;background:#7f9cff;border-color:#7f9cff}" +
    "#tmBar .rep{font-size:10px;color:#ffb454;border:1px dashed #5a3d14;padding:2px 7px;letter-spacing:1px}";
  document.head.appendChild(css);

  var bar = document.createElement("div");
  bar.id = "tmBar";
  var html = '<span class="lab">⏱ 时光机</span>' +
    '<a href="' + location.pathname + '"' + (!cur ? ' class="on"' : '') + '>今晚</a>';
  if (cur) html += '<span class="rep">回放中 · ' + cur + '</span>';
  days.forEach(function(d){
    html += '<a href="?d=' + d + '"' + (d === cur ? ' class="on"' : '') + '>' + d.slice(5) + '</a>';
  });
  bar.innerHTML = html;
  if (document.body) document.body.appendChild(bar);
  else document.addEventListener("DOMContentLoaded", function(){ document.body.appendChild(bar); });
})();
