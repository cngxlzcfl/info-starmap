/* 信息星图 · 星空电台（真人语音版）
   音频由 make_radio.py 在每次更新时用微软 Edge 免费神经语音离线生成，
   页面只负责播放 assets/radio.mp3，不再调用浏览器自带的机械朗读。 */
(function () {
  "use strict";
  var S = window.__STAR;
  if (!S || !S.items || !S.items.length) return;

  var fab = document.getElementById("fabRadio");
  var bar = document.getElementById("radioBar");
  var txt = document.getElementById("radioText");
  var stopBtn = document.getElementById("radioStop");
  if (!fab || !bar || !txt || !stopBtn) return;

  var src = window.RADIO_AUDIO || "assets/radio.mp3";
  var audio = new Audio(src);
  audio.preload = "none";
  var playing = false;

  function reset() {
    playing = false;
    audio.pause();
    audio.currentTime = 0;
    bar.classList.remove("show");
    fab.textContent = "电台";
    window.__RADIO = { playing: false, line: "" };
  }

  audio.addEventListener("ended", reset);
  audio.addEventListener("error", function () {
    if (playing) {
      txt.textContent = "今天的播报音频没加载出来，稍后再点一次试试。";
    }
  });

  fab.addEventListener("click", function () {
    if (playing) {
      reset();
      return;
    }
    audio.currentTime = 0;
    playing = true;
    fab.textContent = "停止";
    bar.classList.add("show");
    txt.textContent = "正在播报今天的星空 · 真人语音";
    window.__RADIO = { playing: true, line: "真人语音播报" };
    var p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {
        txt.textContent = "浏览器没让播放，请再点一下「电台」。";
        reset();
      });
    }
  });

  stopBtn.addEventListener("click", reset);

  window.__RADIO = { playing: false, line: "" };
})();
