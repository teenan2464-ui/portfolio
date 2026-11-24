/* 瀏覽統計：只記錄從 LinkedIn（?ref=linkedin）或 104（?ref=104）連結進來的訪客。
   其他訪客完全不載入統計程式、不送出任何資料。
   同一個分頁內接著瀏覽的作品頁，會沿用進站時的來源一起記錄。
   在網址後加 #toggle-goatcounter 可切換「不統計這個瀏覽器」。 */
(function () {
  var KEY = 'gc_src', SKIP = 'skipgc';
  try {
    if (location.hash === '#toggle-goatcounter') {
      if (localStorage.getItem(SKIP) === 't') {
        localStorage.removeItem(SKIP);
        alert('已恢復統計這個瀏覽器的瀏覽。');
      } else {
        localStorage.setItem(SKIP, 't');
        alert('這個瀏覽器的瀏覽將不再被統計。');
      }
      return;
    }
    if (localStorage.getItem(SKIP) === 't') return;

    var m = location.search.match(/[?&]ref=(linkedin|104)(?:&|$)/i);
    var src = m ? m[1].toLowerCase() : sessionStorage.getItem(KEY);
    if (m) sessionStorage.setItem(KEY, src);
    if (src !== 'linkedin' && src !== '104') return;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://tina-portfolio.goatcounter.com/count');
    s.setAttribute('data-goatcounter-settings', '{"no_onload": true}');
    s.onload = function () {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: location.pathname, referrer: src });
      }
    };
    document.body.appendChild(s);
  } catch (e) { /* 儲存空間被封鎖時直接不統計 */ }
})();
