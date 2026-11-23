// 手機版選單開關；點選連結後自動收起
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

// 點選單外面時收起「其他作品」下拉
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu[open]').forEach((d) => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});

// 作品分頁沒有寫好的目錄：依頁面標題與各段標題自動產生
const buildCaseToc = () => {
  const sections = [...document.querySelectorAll('.case-section')];
  if (!sections.length) return null;
  const items = [];
  const hero = document.querySelector('.case-hero');
  if (hero) { hero.id ||= 'overview'; items.push([hero.id, hero.querySelector('h1').textContent]); }
  sections.forEach((sec, n) => {
    sec.id ||= `section-${n + 1}`;
    items.push([sec.id, sec.querySelector('h2').textContent.split('：')[0]]);
  });
  const next = document.querySelector('.case-next');
  if (next) { next.id ||= 'more-work'; items.push([next.id, '其他作品']); }
  const nav = document.createElement('nav');
  nav.className = 'toc'; nav.id = 'toc'; nav.setAttribute('aria-label', '本頁目錄');
  nav.innerHTML = `<ol class="toc-list">${items.map(([id, label]) => `<li><a href="#${id}" data-sections="${id}">${label}</a></li>`).join('')}</ol>`;
  document.body.append(nav);
  return nav;
};

// 懸浮目錄：捲過開頭後出現，目前所在的區塊字會放大
const toc = document.getElementById('toc') || buildCaseToc();
if (toc) {
  const links = [...toc.querySelectorAll('a')];
  links.forEach((a) => { a.dataset.label = a.textContent.trim(); });  // 平板收起時，滑鼠移上圓點顯示名稱
  const groups = links.map((a) => ({ a, els: a.dataset.sections.split(' ').map((id) => document.getElementById(id)).filter(Boolean) }));
  // 平板：平常只顯示圓點，捲動或點目錄外的地方就收起
  // 滑鼠：移上圓點顯示名稱，點圓點直接前往；觸控沒有滑鼠移上的提示，第一次點先展開文字、再點才前往
  const compact = matchMedia('(min-width: 761px)');
  const touch = matchMedia('(hover: none)');
  let openedAt = 0;
  const open = () => { toc.classList.add('open'); openedAt = scrollY; };
  const close = () => toc.classList.remove('open');
  let justOpened = false;
  toc.addEventListener('pointerdown', (e) => {
    if (compact.matches && touch.matches && !toc.classList.contains('open')) { e.preventDefault(); open(); justOpened = true; }
  });
  toc.addEventListener('click', (e) => {
    if (justOpened) { e.preventDefault(); justOpened = false; return; }
    if (compact.matches) close();
  });
  document.addEventListener('pointerdown', (e) => { if (!toc.contains(e.target)) close(); });
  toc.addEventListener('focusin', (e) => { if (compact.matches && e.target.matches(':focus-visible')) open(); });  // 鍵盤 Tab 進來時展開
  const update = () => {
    toc.classList.toggle('show', scrollY > 360);
    if (toc.classList.contains('open') && Math.abs(scrollY - openedAt) > 8) close();
    // 判斷線平常在畫面 35% 處；接近頁尾時往下移，讓最後幾段短的區塊也能被標示
    const remaining = document.documentElement.scrollHeight - (scrollY + innerHeight);
    const line = innerHeight * (0.35 + 0.6 * Math.max(0, 1 - remaining / innerHeight));
    let active = groups[0];
    groups.forEach((g) => { if (g.els[0].getBoundingClientRect().top <= line) active = g; });
    links.forEach((a) => {
      a.classList.toggle('active', a === active.a);
      if (a === active.a) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  };
  // 捲動時在目前段落的圓點旁顯示標題，停止約 1 秒後漸漸隱藏
  let idleTimer;
  const onScroll = () => {
    update();
    toc.classList.add('scrolling');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => toc.classList.remove('scrolling'), 1000);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', update);
  update();
}

// 點功能介紹的 App 圖片放大查看；點任何地方或按 Esc 關閉
// 同一組（核心設計、照顧者情境、其他功能）裡的圖片，展開後可用左右箭頭、鍵盤方向鍵或滑動切換
const zoomables = [...document.querySelectorAll('#highlights .phone img, #highlights .feature-shot img, #highlights img.shot, .project-cover img.shot, #results .compare img.shot')];
if (zoomables.length) {
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.innerHTML = '<img alt=""><button type="button" class="lightbox-close" aria-label="關閉">×</button>'
    + '<button type="button" class="lightbox-nav lightbox-prev" aria-label="上一張">‹</button>'
    + '<button type="button" class="lightbox-nav lightbox-next" aria-label="下一張">›</button>'
    + '<p class="lightbox-count" aria-live="polite"></p>';
  document.body.appendChild(box);
  const big = box.querySelector('img');
  const count = box.querySelector('.lightbox-count');
  let group = [], index = 0, lastFocus = null, frameTimer = null;
  // 有 data-frames 的圖片：放大後播放「游標點擊切換」示範——游標移到 data-clicks 指定的位置（圖片寬高的百分比）點一下，畫面直接換到下一張，循環播放；減少動態效果時只顯示原圖
  const cursor = document.createElement('span');
  cursor.className = 'lightbox-cursor';
  cursor.hidden = true;
  cursor.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2.5v17.2l4.6-4.3 2.9 6.6 2.9-1.3-2.9-6.5h6.3z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  box.appendChild(cursor);
  let run = 0;
  const stopFrames = () => { run++; cursor.hidden = true; cursor.classList.remove('is-click'); };
  const wait = (ms, id) => new Promise((r) => setTimeout(r, ms)).then(() => { if (id !== run) throw new Error('stop'); });
  const place = (p, animate) => {
    const r = big.getBoundingClientRect();
    cursor.style.transition = animate ? 'left .9s ease-in-out, top .9s ease-in-out' : 'none';
    cursor.style.left = (r.left + r.width * p[0] / 100) + 'px';
    cursor.style.top = (r.top + r.height * p[1] / 100) + 'px';
  };
  const playFrames = async (img) => {
    const frames = (img.dataset.frames || '').split(/\s+/).filter(Boolean);
    const clicks = (img.dataset.clicks || '').split(/\s+/).filter(Boolean).map((s) => s.split(',').map(Number));
    if (frames.length < 2 || clicks.length < frames.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = ++run;
    frames.forEach((f) => { new Image().src = f; });
    big.src = frames[0];
    let f = 0;
    try {
      await wait(500, id);
      place([72, 72], false);
      cursor.hidden = false;
      for (;;) {
        await wait(600, id);
        place(clicks[f], true);
        await wait(1000, id);
        cursor.classList.add('is-click');
        await wait(160, id);
        f = (f + 1) % frames.length;
        big.src = frames[f];
        await wait(340, id);
        cursor.classList.remove('is-click');
        await wait(1300, id);
      }
    } catch (e) { /* 已切換或關閉 */ }
  };
  const show = (i) => {
    stopFrames();
    index = (i + group.length) % group.length;
    const img = group[index];
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    box.classList.toggle('is-phone', !!img.closest('.phone'));
    box.classList.toggle('is-narrow', !!img.closest('.phone, .feature-shot') || img.classList.contains('shot-phone'));  // 直式手機圖：箭頭靠近圖片
    count.textContent = group.length > 1 ? `${index + 1} / ${group.length}` : '';
    playFrames(img);
  };
  const step = (d) => { if (group.length > 1) show(index + d); };
  box.querySelector('.lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  box.querySelector('.lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); step(1); });
  box.addEventListener('click', () => box.close());
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  // 觸控：左右滑動切換
  let startX = null, startY = 0;
  box.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { step(dx < 0 ? 1 : -1); box.dataset.swiped = '1'; }
  });
  box.addEventListener('click', (e) => { if (box.dataset.swiped) { delete box.dataset.swiped; e.stopImmediatePropagation(); } }, true);
  box.addEventListener('close', () => {
    stopFrames();
    big.removeAttribute('src');
    document.documentElement.classList.remove('lightbox-open');
    lastFocus?.focus();
  });
  zoomables.forEach((img) => {
    img.classList.add('zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    const open = () => {
      const core = img.closest('.core, .features, .compare');
      group = core ? zoomables.filter((z) => core.contains(z)) : [img];
      box.classList.toggle('has-nav', group.length > 1);
      lastFocus = img;
      show(group.indexOf(img));
      document.documentElement.classList.add('lightbox-open');
      box.showModal();
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// 點信箱複製到剪貼簿，圖示短暫變成打勾並顯示提示
document.querySelectorAll('.copy-email').forEach((btn) => {
  const status = btn.closest('.wrap')?.querySelector('.copy-status');
  let timer;
  btn.addEventListener('click', async () => {
    const email = btn.dataset.email;
    let ok = false;
    try { await navigator.clipboard.writeText(email); ok = true; } catch {
      const t = document.createElement('textarea');
      t.value = email; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
      document.body.append(t); t.select();
      try { ok = document.execCommand('copy'); } catch {}
      t.remove();
    }
    btn.classList.toggle('copied', ok);
    if (status) status.textContent = ok ? '已複製信箱' : `複製失敗，請手動複製：${email}`;
    clearTimeout(timer);
    timer = setTimeout(() => { btn.classList.remove('copied'); if (status) status.textContent = ''; }, 2000);
  });
});

// 簡易 Prototype：點按鈕開啟，依序瀏覽畫面；點畫面上閃爍的熱點、按「下一頁」或方向鍵前進
document.querySelectorAll('[data-proto-open]').forEach((opener) => {
  const src = document.getElementById(opener.dataset.protoOpen);
  if (!src) return;
  const data = JSON.parse(src.textContent);
  const screens = data.screens;
  const dlg = document.createElement('dialog');
  dlg.className = 'proto';
  dlg.setAttribute('aria-label', `${data.title}流程`);
  dlg.innerHTML = `
    <div class="proto-head"><b>${data.title}</b><small>流程</small>
      <button type="button" class="proto-close" aria-label="關閉">×</button></div>
    <nav class="proto-steps" aria-label="流程進度" style="--n: ${data.modules.length}"><span class="proto-fill" aria-hidden="true"></span>${data.modules.map((m, i) =>
      `<button type="button" data-m="${i}" aria-label="${String(i + 1).padStart(2, '0')} ${m}"><span class="proto-dot">${String(i + 1).padStart(2, '0')}</span><span class="proto-label">${m}</span></button>`).join('')}</nav>
    <div class="proto-stage"><figure class="proto-screen"><img alt=""><button type="button" class="proto-hot"></button></figure><figure class="proto-side" hidden><img alt=""><figcaption></figcaption></figure><svg class="proto-arrow" aria-hidden="true" hidden><defs><marker id="proto-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs><circle r="16"/><path class="proto-arrow-line" marker-end="url(#proto-arrowhead)"/><text></text></svg></div>
    <div class="proto-foot">
      <p class="proto-caption"><span class="proto-role"></span><span class="proto-text"></span></p>
      <div class="proto-nav"><button type="button" class="proto-prev">上一頁</button><span class="proto-count"></span><button type="button" class="proto-next">下一頁</button></div>
    </div>`;
  document.body.appendChild(dlg);
  const $ = (sel) => dlg.querySelector(sel);
  const fig = $('.proto-screen'), img = $('.proto-screen img'), hot = $('.proto-hot');
  const steps = [...dlg.querySelectorAll('.proto-steps button')];
  let i = 0;
  const show = (n) => {
    i = Math.max(0, Math.min(screens.length - 1, n));
    const sc = screens[i];
    img.src = sc.src;
    img.alt = `${data.modules[sc.m]}：${sc.text}`;
    fig.classList.toggle('is-phone', !!sc.phone);
    // 並排的第二個畫面（例如同一張單在主管手機上的樣子）
    const side = $('.proto-side');
    side.hidden = !sc.side;
    $('.proto-stage').classList.toggle('side-first', !!(sc.side && sc.side.first));
    if (sc.side) { side.querySelector('img').src = sc.side.src; side.querySelector('img').alt = sc.side.label; side.querySelector('figcaption').textContent = sc.side.label; }
    drawArrow();
    // 熱點只用在同一個人、同一個模組內的連續操作；換模組或換使用者時，改按「下一頁」
    const nx = screens[i + 1];
    const hasHot = !!sc.hot && !!nx && nx.m === sc.m && nx.role === sc.role;
    hot.hidden = !hasHot;
    if (hasHot) { hot.style.left = `${sc.hot[0]}%`; hot.style.top = `${sc.hot[1]}%`; hot.setAttribute('aria-label', `${sc.act}（下一頁）`); }
    // 畫面上其他可點的地方（例如切回分頁），不閃爍，滑過時顯示外框
    fig.querySelectorAll('.proto-link').forEach((el) => el.remove());
    (sc.links || []).forEach((l) => {
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'proto-link';
      a.setAttribute('aria-label', l.label);
      a.title = l.label;
      Object.assign(a.style, { left: `${l.area[0]}%`, top: `${l.area[1]}%`, width: `${l.area[2]}%`, height: `${l.area[3]}%` });
      a.addEventListener('click', (e) => { e.stopPropagation(); show(i + l.go); });
      fig.appendChild(a);
    });
    $('.proto-role').textContent = sc.role;
    $('.proto-text').textContent = sc.text;
    $('.proto-count').textContent = `${i + 1} / ${screens.length}`;
    $('.proto-prev').disabled = i === 0;
    $('.proto-next').textContent = i === screens.length - 1 ? '完成' : '下一頁';
    $('.proto-next').classList.toggle('is-cue', !hasHot && i < screens.length - 1);  // 沒有熱點的畫面，改提示按「下一頁」
    steps.forEach((b, k) => {
      if (k === sc.m) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', k < sc.m);
    });
    $('.proto-steps').style.setProperty('--p', data.modules.length > 1 ? sc.m / (data.modules.length - 1) : 0);  // 進度條填到目前的模組
    const next = screens[i + 1];
    if (next) new Image().src = next.src;  // 預先載入下一張
  };
  // 箭頭：從一張畫面上的按鈕（例如「送出」）指到並排的另一張，表示送出後對方看到的內容
  // side.reverse = true 時從手機指向主畫面；side.first = true 時手機放在左邊
  const arrow = $('.proto-arrow');
  const drawArrow = () => {
    const sc = screens[i], sd = sc && sc.side;
    const off = !(sd && sd.from);
    arrow.toggleAttribute('hidden', off);  // SVG 元素沒有 hidden 屬性，要直接改 attribute
    if (off) return;
    const stage = $('.proto-stage').getBoundingClientRect();
    const mainR = img.getBoundingClientRect(), sideR = $('.proto-side img').getBoundingClientRect();
    if (!mainR.width || !sideR.width) return;
    const fromR = sd.reverse ? sideR : mainR, toR = sd.reverse ? mainR : sideR;
    const x1 = fromR.left - stage.left + fromR.width * sd.from[0] / 100, y1 = fromR.top - stage.top + fromR.height * sd.from[1] / 100;
    const x2 = toR.left - stage.left + toR.width * sd.to[0] / 100 - 6, y2 = toR.top - stage.top + toR.height * sd.to[1] / 100;
    arrow.querySelector('circle').setAttribute('cx', x1);
    arrow.querySelector('circle').setAttribute('cy', y1);
    // 先往右走出畫面，沿兩張圖之間的空隙上下移動，再轉進另一張，避免線條壓在內容上
    const leftR = mainR.left < sideR.left ? mainR : sideR, rightR = leftR === mainR ? sideR : mainR;
    const gx = (leftR.right + rightR.left) / 2 - stage.left, r = 10, dy = y2 < y1 ? -r : r;
    arrow.querySelector('.proto-arrow-line').setAttribute('d',
      `M${x1 + 18} ${y1} L${gx - r} ${y1} Q${gx} ${y1} ${gx} ${y1 + dy} L${gx} ${y2 - dy} Q${gx} ${y2} ${gx + r} ${y2} L${x2} ${y2}`);
    const t = arrow.querySelector('text');
    t.textContent = sd.note || '';
    t.setAttribute('x', gx);
    t.setAttribute('y', (y1 + y2) / 2);
  };
  img.addEventListener('load', drawArrow);
  $('.proto-side img').addEventListener('load', drawArrow);
  window.addEventListener('resize', () => { if (dlg.open) drawArrow(); });
  const next = () => { if (i === screens.length - 1) dlg.close(); else show(i + 1); };
  hot.addEventListener('click', next);
  $('.proto-next').addEventListener('click', next);
  $('.proto-prev').addEventListener('click', () => show(i - 1));
  $('.proto-close').addEventListener('click', () => dlg.close());
  steps.forEach((b) => b.addEventListener('click', () => show(screens.findIndex((sc) => sc.m === +b.dataset.m))));
  // 點到熱點以外的畫面：熱點快速閃一下，提示要點哪裡
  img.addEventListener('click', () => { fig.classList.add('is-hint'); setTimeout(() => fig.classList.remove('is-hint'), 1000); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
  });
  dlg.addEventListener('close', () => { document.documentElement.classList.remove('lightbox-open'); opener.focus(); });
  opener.addEventListener('click', () => {
    show(0);
    document.documentElement.classList.add('lightbox-open');
    dlg.showModal();
    $('.proto-next').focus();
  });
});

// 系統流程（平板與手機）：文件簽核與監控放右側，置於「02 開案」上緣到執行底部的正中間，表示開案後才開始
(() => {
  const flow = document.querySelector('.sysflow');
  const bands = flow && flow.querySelector('.sysflow-bands');
  const open = flow && flow.querySelector('.sysflow-node[value="2"]');
  if (!bands || !open) return;
  const track = flow.querySelector('.sysflow-track');
  const mq = matchMedia('(max-width: 1199px)');
  const align = () => {
    bands.style.marginTop = '';
    ['--span-h', '--span-off', '--stem-y'].forEach((v) => bands.style.removeProperty(v));
    if (!mq.matches) return;
    const top = open.getBoundingClientRect().top;
    const span = track.getBoundingClientRect().bottom - top;
    const off = Math.max(0, (span - bands.offsetHeight) / 2);
    bands.style.marginTop = Math.round(top - bands.getBoundingClientRect().top + off) + 'px';
    bands.style.setProperty('--span-h', Math.round(span) + 'px');
    bands.style.setProperty('--span-off', Math.round(off) + 'px');
    bands.style.setProperty('--stem-y', Math.round(span / 2 - off) + 'px');
  };
  new ResizeObserver(align).observe(track);
  mq.addEventListener('change', align);
  align();
})();

// 出入庫管理系統：入倉操作動畫。第一版每一步都要用滑鼠點欄位；第二版掃描後自動帶入、游標自動跳到下一個欄位
document.querySelectorAll('.wh-demo').forEach((fig) => {
  const v = fig.dataset.version;
  const frame = fig.querySelector('.whd-frame');
  const stage = fig.querySelector('.whd-stage');
  const $ = (s) => stage.querySelector(s);
  const field = (f) => $(`[data-field="${f}"]`);
  const cursor = $('.whd-cursor'), scanner = $('.whd-scanner');
  const count = fig.querySelector('.whd-count b');
  const steps = [...fig.querySelectorAll('.whd-steps li')];
  const rows = [...stage.querySelectorAll('[data-row]')];
  const need = [2, 1];
  let scale = 1, run = 0, clicks = 0;
  const fit = () => {
    scale = Math.min(1.35, frame.clientWidth / 680);
    const offset = Math.max(0, (frame.clientWidth - 680 * scale) / 2);
    stage.style.transform = `translateX(${offset}px) scale(${scale})`;
    frame.style.height = stage.offsetHeight * scale + 'px';
  };
  new ResizeObserver(fit).observe(frame);
  fit();
  const wait = (ms, id) => new Promise((r) => setTimeout(r, ms)).then(() => { if (id !== run) throw new Error('stop'); });
  const at = (el, dx, dy) => {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [(r.left - s.left) / scale + dx, (r.top - s.top) / scale + dy];
  };
  const focus = (el) => { stage.querySelectorAll('.whd-input').forEach((n) => n.classList.toggle('is-focus', n === el)); };
  const step = (i) => steps.forEach((li, k) => li.classList.toggle('is-active', k === i));
  const reset = () => {
    clicks = 0; count.textContent = '0';
    stage.querySelectorAll('.whd-val').forEach((n) => { n.textContent = ''; });
    stage.querySelectorAll('.whd-input').forEach((n) => n.classList.remove('is-focus', 'is-flash', 'is-error'));
    rows.forEach((r, i) => { r.querySelector('.whd-qty b').textContent = '0'; r.querySelector('.whd-qty').classList.remove('is-full'); r.querySelector('.whd-prog i').style.setProperty('--p', '0%'); r.querySelector('.whd-prog u').textContent = '0%'; });
    $('.whd-done').classList.remove('is-on');
    cursor.style.opacity = 0; scanner.classList.remove('is-on', 'is-error', 'is-done'); step(-1);
    $('.whd-toast').classList.remove('is-on'); $('.whd-hint').classList.remove('is-on');
  };
  const click = async (el, id) => {
    const [x, y] = at(el, el.offsetWidth * 0.55, el.offsetHeight * 0.55);
    cursor.style.opacity = 1; cursor.style.left = x + 'px'; cursor.style.top = y + 'px';
    await wait(750, id);
    cursor.classList.add('is-click'); clicks += 1; count.textContent = clicks; focus(el);
    await wait(700, id); cursor.classList.remove('is-click');
  };
  // sound：一般掃描「嗶」；第二版品項達 100% 時改用完成提示音（綠色「叮咚」）
  const scan = async (el, value, id, done = false) => {
    const [x, y] = at(el, el.offsetWidth - 40, -50);
    scanner.style.left = x + 'px'; scanner.style.top = y + 'px';
    scanner.querySelector('.whd-sound').textContent = done ? '叮咚 ✓' : '嗶';
    scanner.classList.toggle('is-done', done);
    scanner.classList.add('is-on');
    await wait(380, id);
    el.querySelector('.whd-val').textContent = value; el.classList.add('is-flash');
    await wait(420, id);
    scanner.classList.remove('is-on', 'is-done'); el.classList.remove('is-flash');
  };
  const showHint = (loc) => {
    const h = $('.whd-hint'), d = $('.whd-dialog');
    const dr = d.getBoundingClientRect(), lr = loc.getBoundingClientRect();
    h.style.left = ((lr.left - dr.left) / scale + loc.offsetWidth / 2 - h.offsetWidth / 2) + 'px';
    h.style.top = ((lr.top - dr.top) / scale - h.offsetHeight - 8) + 'px';
    h.classList.add('is-on');
  };
  const addQty = (i) => {
    const r = rows[i], b = r.querySelector('.whd-qty b'), n = Number(b.textContent) + 1, p = Math.round(n / need[i] * 100);
    b.textContent = n; r.querySelector('.whd-qty').classList.toggle('is-full', n >= need[i]);
    r.querySelector('.whd-prog i').style.setProperty('--p', p + '%'); r.querySelector('.whd-prog u').textContent = p + '%';
  };
  // 掃到不在入倉清單中的品項：輸入框變紅並搖晃、跳出提示、發出不同的連續警示音，數量不變
  const scanError = async (id) => {
    const it = field('item'), toast = $('.whd-toast');
    const [x, y] = at(it, it.offsetWidth - 40, -50);
    scanner.style.left = x + 'px'; scanner.style.top = y + 'px';
    scanner.querySelector('.whd-sound').textContent = '嗶嗶嗶！';
    scanner.classList.add('is-on', 'is-error');
    await wait(380, id);
    it.querySelector('.whd-val').textContent = '4710999990012'; it.classList.add('is-error'); toast.classList.add('is-on');
    await wait(1600, id);
    scanner.classList.remove('is-on', 'is-error'); toast.classList.remove('is-on');
    it.classList.remove('is-error'); it.querySelector('.whd-val').textContent = '';
  };
  const scanItem = async (i, id) => {
    const it = field('item');
    const willFill = v === '2' && Number(rows[i].querySelector('.whd-qty b').textContent) + 1 >= need[i];
    await scan(it, '4710' + (i ? '88' : '12') + '30051', id, willFill); addQty(i); await wait(250, id); it.querySelector('.whd-val').textContent = ''; };
  const play = async () => {
    const id = ++run;
    reset();
    try {
      await wait(500, id);
      const it = field('item');
      for (let i = 0; i < 2; i++) {
        step(0);
        // 第一版每筆都要點品項欄位；第二版開啟視窗就預設聚焦在品項條碼，不需要點擊
        if (v === '1') await click(it, id); else focus(it);
        for (let k = 0; k < need[i]; k++) {
          await wait(450, id); await scanItem(i, id);
          if (v === '2' && i === 0 && k === 0) { await wait(450, id); step(1); await scanError(id); step(0); }
        }
        step(v === '2' ? 2 : 1);
        const loc = field('loc' + i);
        if (v === '1') { await wait(400, id); await click(loc, id); } else { await wait(350, id); focus(loc); showHint(loc); await wait(700, id); }
        await wait(450, id); $('.whd-hint').classList.remove('is-on'); await scan(loc, i ? '301A00005' : '301A00002', id);
        if (i === 1) break;  // 最後一筆掃完儲位：完成度全滿，直接可按「完成入倉」
        step(v === '2' ? 3 : 2);
        if (v === '2') { await wait(350, id); focus(it); }
      }
      await wait(300, id); cursor.style.opacity = 0;
      focus(null); $('.whd-done').classList.add('is-on');
      await wait(2600, id);
      play();
    } catch (e) { /* 已停止 */ }
  };
  const showFinal = () => {
    reset();
    rows.forEach((r, i) => { r.querySelector('.whd-qty b').textContent = need[i]; r.querySelector('.whd-qty').classList.add('is-full'); r.querySelector('.whd-prog i').style.setProperty('--p', '100%'); r.querySelector('.whd-prog u').textContent = '100%'; });
    field('loc0').querySelector('.whd-val').textContent = '301A00002'; field('loc1').querySelector('.whd-val').textContent = '301A00005';
    count.textContent = v === '1' ? '4' : '0';
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { showFinal(); return; }
  new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { if (!fig.dataset.playing) { fig.dataset.playing = '1'; play(); } } else { run++; delete fig.dataset.playing; reset(); } }), { threshold: 0.35 }).observe(fig);
});

// 顧客消費歷程管理平台：「調整參數」互動示範。選擇捲動深度，右側示意圖即時捲到觸發起始線；
// 進入畫面時自動示範，使用者一操作就停止自動示範、改由使用者控制
document.querySelectorAll('.cj-demo').forEach((fig) => {
  const frame = fig.querySelector('.cjd-frame'), stage = fig.querySelector('.cjd-stage');
  const trig = stage.querySelector('.cjd-trigger'), list = stage.querySelector('.cjd-list'), valEl = stage.querySelector('.cjd-value');
  const page = stage.querySelector('.cjd-page'), line = stage.querySelector('.cjd-line'), thumb = stage.querySelector('.cjd-thumb');
  const view = stage.querySelector('.cjd-view'), cursor = stage.querySelector('.cjd-cursor');
  const opts = [...list.querySelectorAll('li')];
  const DW = 720; let scale = 1, run = 0, user = false;
  // 修改前的截圖與示範同高，兩張並排時對齊
  const beforeImg = fig.closest('.cj-compare')?.querySelector('.cj-before .shot');
  const fit = () => {
    scale = Math.min(1.3, frame.clientWidth / DW);
    const off = Math.max(0, (frame.clientWidth - DW * scale) / 2);
    stage.style.transform = `translateX(${off}px) scale(${scale})`;
    frame.style.height = stage.offsetHeight * scale + 'px';
    if (beforeImg) beforeImg.style.height = frame.style.height;
  };
  new ResizeObserver(fit).observe(frame); fit();
  const set = (v) => {
    valEl.textContent = v + '%';
    opts.forEach((o) => o.setAttribute('aria-selected', String(+o.dataset.v === v)));
    const band = page.querySelector('span').offsetHeight, y = band * (v / 10);
    line.style.top = y + 'px';
    const max = page.offsetHeight - view.offsetHeight, sc = Math.max(0, Math.min(max, y - 30));
    page.style.transform = `translateY(${-sc}px)`;
    thumb.style.top = (20 + (view.offsetHeight - 40) * (sc / max)) + 'px';
  };
  const open = (o) => { list.hidden = !o; trig.setAttribute('aria-expanded', String(o)); };
  trig.addEventListener('click', () => open(list.hidden));
  opts.forEach((o) => o.addEventListener('click', () => { set(+o.dataset.v); open(false); }));
  fig.addEventListener('pointerdown', (e) => { if (e.isTrusted && !user) { user = true; run++; cursor.style.opacity = 0; opts.forEach((o) => o.classList.remove('is-hover')); } });
  document.addEventListener('click', (e) => { if (!fig.contains(e.target)) open(false); });
  set(0);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { set(50); return; }
  const wait = (ms, id) => new Promise((r) => setTimeout(r, ms)).then(() => { if (id !== run) throw new Error('stop'); });
  const at = (el, fx, fy) => { const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return [(r.left - s.left) / scale + el.offsetWidth * fx, (r.top - s.top) / scale + el.offsetHeight * fy]; };
  const move = async (el, id, fx = 0.6, fy = 0.6) => { const [x, y] = at(el, fx, fy); cursor.style.opacity = 1; cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; await wait(650, id); };
  const click = async (id) => { cursor.classList.add('is-click'); await wait(500, id); cursor.classList.remove('is-click'); };
  const demo = async () => {
    const id = ++run;
    try {
      for (;;) {
        for (const v of [50, 30, 80]) {
          await wait(900, id);
          await move(trig, id); await click(id); open(true);
          const o = opts.find((x) => +x.dataset.v === v);
          list.scrollTop = Math.max(0, o.offsetTop - 60);
          await wait(300, id);
          await move(o, id, 0.3, 0.6); o.classList.add('is-hover'); await click(id);
          o.classList.remove('is-hover'); set(v); open(false);
          await wait(400, id); cursor.style.opacity = 0;
          await wait(2200, id);
        }
      }
    } catch (e) { /* 已停止 */ }
  };
  new IntersectionObserver((es) => es.forEach((e) => { if (user) return; if (e.isIntersecting) { if (!fig.dataset.playing) { fig.dataset.playing = '1'; demo(); } } else { run++; delete fig.dataset.playing; cursor.style.opacity = 0; open(false); } }), { threshold: 0.4 }).observe(fig);
});
