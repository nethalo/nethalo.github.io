(function() {
  "use strict";
  const FULL_TEXT = "EXPLAIN ANALYZE SELECT knowledge FROM rendiment WHERE performance > 'good';";
  const TYPING_SPEED = 40;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
  function init() {
    const el = document.getElementById("typing-output");
    if (\!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0].isIntersecting) { obs.disconnect(); startTyping(el); } }, { threshold: 0.1 });
    const sec = document.querySelector(".dark-section");
    if (sec) obs.observe(sec);
  }
  function startTyping(el) {
    let txt = "", i = 0;
    const p = "<span class=\"term-prompt\">rendiment</span><span class=\"term-path\"> [mysql] ~ </span><span class=\"term-amber\">$</span> ";
    el.innerHTML = p;
    const iv = setInterval(() => {
      if (i < FULL_TEXT.length) {
        txt += FULL_TEXT[i++];
        el.innerHTML = p + colorizeSQL(txt) + "<span class=\"term-cursor\"></span>";
      } else {
        clearInterval(iv);
        el.innerHTML = p + colorizeSQL(txt);
      }
    }, TYPING_SPEED);
  }
  function colorizeSQL(t) {
    const kw = ["EXPLAIN", "ANALYZE", "SELECT", "FROM", "WHERE"];
    const r = new RegExp("(" + kw.join("|") + ")|('[^']*'?)|(>)", "g");
    return t.replace(r, (m, k, s, o) => k ? "<span class=\"term-green\">" + k + "</span>" : s ? "<span class=\"term-amber\">" + s + "</span>" : o ? "<span class=\"term-pink\">" + o + "</span>" : m);
  }
})();
