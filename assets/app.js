/* ============================================================================
   五兽之镜 · PDP 行为风格测评 —— 交互层
   原生 JavaScript，无第三方依赖。
   结构：工具 → 路由 → 渲染 → 测评状态机 → 结果可视化 → 分享卡 → 事件绑定
   ========================================================================== */
(function () {
  'use strict';

  var D = window.PDP_DATA;
  var CFG = D.CONFIG;
  var QS = D.QUESTIONS;
  var TYPES = D.TYPES;
  var DIMS = D.DIM_ORDER;

  var STORAGE_KEY = 'wushou.pdp.v1';

  /* ------------------------------------------------------------------ 工具 */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ico(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
  }

  function mark(code, size) {
    var s = size || 40;
    return '<svg width="' + s + '" height="' + s + '" aria-hidden="true"><use href="#m-' +
      code.toLowerCase() + '"/></svg>';
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  /* ------------------------------------------------------------------ 路由 */
  var ROUTES = {
    home: { view: 'view-home', nav: 'home', title: '五兽之镜 · PDP 行为风格测评' },
    test: { view: 'view-test', nav: 'test', title: '开始测评 · 五兽之镜' },
    types: { view: 'view-types', nav: 'types', title: '五型图鉴 · 五兽之镜' },
    about: { view: 'view-about', nav: 'about', title: '作品介绍 · 五兽之镜' },
    scenarios: { view: 'view-scenarios', nav: 'scenarios', title: '使用场景 · 五兽之镜' },
    submit: { view: 'view-submit', nav: 'submit', title: '投稿信息 · 五兽之镜' }
  };

  var currentRoute = 'home';

  function parseHash() {
    var h = location.hash || '#/';
    if (h.indexOf('#/') !== 0) return null;
    var key = h.slice(2).replace(/\/$/, '');
    return key === '' ? 'home' : key;
  }

  function setRoute(key, opts) {
    var route = ROUTES[key] ? key : 'home';
    currentRoute = route;

    $$('.view').forEach(function (v) { v.classList.remove('is-active'); });
    var view = document.getElementById(ROUTES[route].view);
    if (view) view.classList.add('is-active');

    $$('.nav-links a[data-nav]').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === ROUTES[route].nav);
    });

    document.title = ROUTES[route].title;
    closeNav();

    if (route === 'test') {
      enterTest();
    }

    if (!opts || opts.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function onRouteChange() {
    var key = parseHash();

    /* 页内锚点（作品介绍目录）不走视图切换，但要先把所在视图激活 */
    if (key === null) {
      var id = (location.hash || '').replace('#', '');
      var el = id ? document.getElementById(id) : null;
      if (el) {
        var host = el.closest ? el.closest('.view') : null;
        var route = 'home';
        if (host) {
          Object.keys(ROUTES).forEach(function (k) {
            if (ROUTES[k].view === host.id) route = k;
          });
        }
        setRoute(route, { scroll: false });
        requestAnimationFrame(function () {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return;
      }
      key = 'home';
    }
    setRoute(key);
  }

  /* ------------------------------------------------------------------ 导航 */
  function openNav() {
    $('#navLinks').classList.add('is-open');
    var btn = $('#navToggle');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', '关闭菜单');
    var use = btn.querySelector('use');
    if (use) use.setAttribute('href', '#i-close');
    document.body.classList.add('nav-open');
  }

  function closeNav() {
    var links = $('#navLinks');
    if (!links) return;
    links.classList.remove('is-open');
    var btn = $('#navToggle');
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', '打开菜单');
      var use = btn.querySelector('use');
      if (use) use.setAttribute('href', '#i-menu');
    }
    document.body.classList.remove('nav-open');
  }

  function bindNav() {
    $('#navToggle').addEventListener('click', function () {
      if ($('#navLinks').classList.contains('is-open')) closeNav();
      else openNav();
    });

    $$('#navLinks a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });

    window.addEventListener('scroll', function () {
      $('#siteNav').classList.toggle('is-scrolled', window.scrollY > 8);
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  /* ------------------------------------------------------------------ 首页渲染 */
  function renderTypeStrip() {
    var el = $('#homeTypeStrip');
    if (!el) return;
    el.innerHTML = D.GALLERY_ORDER.filter(function (k) { return k !== 'C'; }).concat(['C']).map(function (k) {
      var t = TYPES[k];
      return '<a class="type-card" href="#/types" style="--c:' + t.color + '" aria-label="查看' + t.name + '详情">' +
        '<span class="tc-mark">' + mark(k, 38) + '</span>' +
        '<span class="tc-letter">TYPE ' + k + '</span>' +
        '<span class="tc-name">' + t.name + '</span>' +
        '<span class="tc-alias">' + t.alias + '</span>' +
        '<span class="tc-key">' + t.keywords.join(' · ') + '</span>' +
      '</a>';
    }).join('');
  }

  function renderHomeScenarios() {
    var el = $('#homeScenarios');
    if (!el) return;
    el.innerHTML = D.SCENARIOS.slice(0, 3).map(function (s) {
      return '<article class="sc-card reveal">' +
        '<span class="sc-no">' + s.no + '</span>' +
        '<h3>' + s.title + '</h3>' +
        '<p class="sc-for">' + s.forWho + '</p>' +
        '<p>' + s.how + '</p>' +
      '</article>';
    }).join('');
  }

  /* ------------------------------------------------------------------ 图鉴渲染 */
  function renderGallery() {
    var el = $('#gallery');
    if (!el) return;
    el.innerHTML = D.GALLERY_ORDER.map(function (k) {
      var t = TYPES[k];
      return '<article class="gallery-card" style="--c:' + t.color + ';--tint:' + t.tint + '">' +
        '<div class="gc-left">' +
          '<span class="gc-mark">' + mark(k, 52) + '</span>' +
          '<div class="gc-namebox">' +
            '<span class="gc-code">TYPE ' + k + '</span>' +
            '<h2 class="gc-name">' + t.name + '</h2>' +
            '<span class="gc-alias">' + t.alias + '</span>' +
          '</div>' +
          '<div class="gc-kw">' + t.keywords.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="gc-right">' +
          '<p class="gc-quote">' + t.headline + '</p>' +
          '<div class="gc-rows">' +
            '<div class="gc-row"><h4>整体印象</h4><p>' + t.summary + '</p></div>' +
            '<div class="gc-row"><h4>适合的场景</h4><p>' + t.scene + '</p></div>' +
            '<div class="gc-row"><h4>核心优势</h4><p>' + t.merit + '</p></div>' +
            '<div class="gc-row"><h4>注意盲区</h4><p>' + t.blind + '</p></div>' +
            '<div class="gc-row"><h4>发展建议</h4><p>' + t.advice + '</p></div>' +
          '</div>' +
          '<div class="gc-collab"><b>协作提示</b><span>' + t.collab + '</span></div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderFeatures() {
    var el = $('#featureGrid');
    if (!el) return;
    el.innerHTML = D.FEATURES.map(function (f) {
      return '<article class="feature-item">' +
        '<span class="feature-icon">' + ico('f-' + f.icon) + '</span>' +
        '<h3>' + f.title + '</h3>' +
        '<p>' + f.desc + '</p>' +
      '</article>';
    }).join('');
  }

  function renderScenarioList() {    var el = $('#scenarioList');
    if (!el) return;
    el.innerHTML = D.SCENARIOS.map(function (s) {
      return '<article class="scenario-block reveal">' +
        '<span class="sb-no">' + s.no + '</span>' +
        '<div class="sb-main">' +
          '<h3>' + s.title + '</h3>' +
          '<p class="sb-for">' + s.forWho + '</p>' +
          '<p class="sb-how">' + s.how + '</p>' +
        '</div>' +
        '<aside class="sb-side">' +
          '<div class="sb-pain"><h4>真实痛点</h4><p>' + s.pain + '</p></div>' +
          '<div class="sb-tip"><h4>主持提示</h4><p>' + s.tip + '</p></div>' +
        '</aside>' +
      '</article>';
    }).join('');
  }

  /* ------------------------------------------------------------------ 测评状态 */
  var S = {
    index: 1,
    scores: { T: 0, P: 0, K: 0, O: 0 },
    picks: [],
    startedAt: 0,
    elapsed: 0,
    finished: false,
    locking: false
  };

  function blankScores() { return { T: 0, P: 0, K: 0, O: 0 }; }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        index: S.index,
        scores: S.scores,
        picks: S.picks,
        startedAt: S.startedAt,
        elapsed: S.elapsed,
        finished: S.finished
      }));
    } catch (e) { /* 隐私模式下可能不可用，忽略 */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !Array.isArray(d.picks)) return null;
      return d;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function restore(d) {
    S.index = Math.min(d.index || 1, CFG.QUESTION_MAX);
    S.scores = d.scores || blankScores();
    S.picks = d.picks || [];
    S.startedAt = d.startedAt || 0;
    S.elapsed = d.elapsed || 0;
    S.finished = !!d.finished;
    S.locking = false;
  }

  function resetState() {
    S.index = 1;
    S.scores = blankScores();
    S.picks = [];
    S.startedAt = 0;
    S.elapsed = 0;
    S.finished = false;
    S.locking = false;
    clearSave();
  }

  /* ------------------------------------------------------------------ 测评面板 */
  function showPanel(which) {
    $('#testStart').hidden = which !== 'start';
    $('#testQuiz').hidden = which !== 'quiz';
    $('#testResult').hidden = which !== 'result';
  }

  var resumeAction = 'quiz';

  function enterTest() {
    var saved = load();
    var btn = $('#btnResume');

    if (saved && saved.finished) {
      restore(saved);
      showPanel('start');
      btn.hidden = false;
      resumeAction = 'result';
      $('#resumeLabel').textContent = '查看上次结果（' + TYPES[computeResult().key].name + '）';
      return;
    }

    if (saved && saved.picks.length > 0 && saved.picks.length < CFG.QUESTION_MAX) {
      restore(saved);
      showPanel('start');
      btn.hidden = false;
      resumeAction = 'quiz';
      $('#resumeLabel').textContent = '继续上次（第 ' + (S.picks.length + 1) + ' 题）';
      return;
    }

    resetState();
    showPanel('start');
    btn.hidden = true;
  }

  function startQuiz(fresh) {
    if (fresh !== false) resetState();
    S.startedAt = S.startedAt || Date.now();
    showPanel('quiz');
    renderQuiz();
    save();
  }

  function renderQuiz() {
    var q = QS[S.index - 1];
    if (!q) { finish(); return; }

    var percent = Math.round((S.index - 1) / CFG.QUESTION_MAX * 100);

    $('#qIndex').textContent = S.index;
    $('#qTotal').textContent = CFG.QUESTION_MAX;
    $('#qPercent').textContent = percent + '%';
    $('#qProgress').setAttribute('aria-valuenow', S.index - 1);
    $('#qProgressFill').style.width = percent + '%';
    $('#qText').textContent = q.q;
    $('#btnPrev').disabled = S.index <= 1;
    $('#btnPrev').style.opacity = S.index <= 1 ? '.45' : '1';

    $('#qOptions').innerHTML = q.opts.map(function (o, i) {
      return '<button class="option" type="button" data-idx="' + i + '">' +
        '<span class="option-idx">' + (i + 1) + '</span>' +
        '<span class="option-text">' + esc(o.text) + '</span>' +
      '</button>';
    }).join('');

    var body = $('#quizBody');
    body.classList.remove('is-out');
    body.style.animation = 'none';
    /* 触发重排以重播入场动画 */
    void body.offsetWidth;
    body.style.animation = '';
  }

  function pickOption(i) {
    if (S.locking || S.finished) return;
    if ($('#testQuiz').hidden) return;
    var q = QS[S.index - 1];
    if (!q || !q.opts[i]) return;

    S.locking = true;

    var btn = $('#qOptions .option[data-idx="' + i + '"]');
    if (btn) btn.classList.add('is-picked');

    S.scores[q.opts[i].k] += 1;
    S.picks[S.index - 1] = i;
    S.picks.length = S.index;
    save();

    setTimeout(function () {
      S.locking = false;
      if (S.index >= CFG.QUESTION_MAX) {
        finish();
      } else {
        S.index += 1;
        renderQuiz();
        save();
      }
    }, 190);
  }

  function prevQuestion() {
    if (S.locking || S.index <= 1) return;
    var optIdx = S.picks.pop();
    var prevQ = QS[S.index - 2];
    if (prevQ && prevQ.opts[optIdx]) {
      var k = prevQ.opts[optIdx].k;
      S.scores[k] = Math.max(0, S.scores[k] - 1);
    }
    S.index -= 1;
    renderQuiz();
    save();
  }

  function finish() {
    S.finished = true;
    S.elapsed = S.startedAt ? Date.now() - S.startedAt : 0;
    save();
    renderResult();
    showPanel('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ 结算 */
  function computeResult() {
    var max = -1, min = 9999;
    DIMS.forEach(function (k) {
      var v = S.scores[k] || 0;
      if (v > max) max = v;
      if (v < min) min = v;
    });
    var gap = max - min;
    if (gap <= CFG.CHAMELEON_GAP) return { key: 'C', gap: gap, max: max, min: min };
    for (var i = 0; i < CFG.TIE_ORDER.length; i++) {
      var k = CFG.TIE_ORDER[i];
      if ((S.scores[k] || 0) === max) return { key: k, gap: gap, max: max, min: min };
    }
    return { key: CFG.TIE_ORDER[0], gap: gap, max: max, min: min };
  }

  function elapsedText() {
    var ms = S.elapsed;
    if (!ms || ms < 0) return '';
    var sec = Math.round(ms / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m <= 0) return s + ' 秒';
    return m + ' 分 ' + s + ' 秒';
  }

  var CARD_COLORS = {
    T: '#D64541', P: '#D98324', K: '#4F9E68', O: '#3F72B5', C: '#8A6BC1'
  };

  function radarSvg(key) {
    var size = 240, cx = 120, cy = 120, R = 78;
    var axisMax = Math.max(8, Math.max.apply(null, DIMS.map(function (k) { return S.scores[k] || 0; })) + 1);
    var angles = [-90, 0, 90, 180];

    function pt(v, ai) {
      var a = angles[ai] * Math.PI / 180;
      var r = R * Math.max(0, Math.min(1, v / axisMax));
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }

    var out = ['<svg viewBox="0 0 240 240" role="img" aria-label="四维得分雷达图">'];

    /* 网格 */
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var p = angles.map(function (_, ai) {
        var a = angles[ai] * Math.PI / 180;
        return (cx + Math.cos(a) * R * f).toFixed(1) + ',' + (cy + Math.sin(a) * R * f).toFixed(1);
      }).join(' ');
      out.push('<polygon points="' + p + '" fill="none" stroke="#E5E1D7" stroke-width="1"/>');
    });

    /* 轴线 */
    angles.forEach(function (deg) {
      var a = deg * Math.PI / 180;
      out.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * R).toFixed(1) +
        '" y2="' + (cy + Math.sin(a) * R).toFixed(1) + '" stroke="#E5E1D7" stroke-width="1"/>');
    });

    /* 数据多边形 */
    var pts = DIMS.map(function (k, ai) { return pt(S.scores[k] || 0, ai); });
    var poly = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var color = CARD_COLORS[key] || '#15171A';
    out.push('<polygon points="' + poly + '" fill="' + color + '" fill-opacity=".14" stroke="' + color +
      '" stroke-width="2" stroke-linejoin="round"/>');

    /* 顶点 */
    pts.forEach(function (p) {
      out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) +
        '" r="3.4" fill="#fff" stroke="' + color + '" stroke-width="2"/>');
    });

    /* 标签 */
    DIMS.forEach(function (k, ai) {
      var a = angles[ai] * Math.PI / 180;
      var lx = cx + Math.cos(a) * (R + 26);
      var ly = cy + Math.sin(a) * (R + 22);
      var anchor = 'middle';
      if (Math.cos(a) > 0.3) anchor = 'start';
      if (Math.cos(a) < -0.3) anchor = 'end';
      out.push('<text x="' + lx.toFixed(1) + '" y="' + (ly - 2).toFixed(1) + '" text-anchor="' + anchor +
        '" font-size="11" font-weight="600" fill="#15171A" font-family="Inter, PingFang SC, Microsoft YaHei, sans-serif">' +
        TYPES[k].animal + '</text>');
      out.push('<text x="' + lx.toFixed(1) + '" y="' + (ly + 12).toFixed(1) + '" text-anchor="' + anchor +
        '" font-size="10" fill="#757983" font-family="ui-monospace, Consolas, monospace">' +
        (S.scores[k] || 0) + ' / ' + axisMax + '</text>');
    });

    out.push('</svg>');
    return out.join('');
  }

  function barsHtml(key) {
    return DIMS.map(function (k) {
      var t = TYPES[k];
      var v = S.scores[k] || 0;
      var pct = Math.round(v / CFG.QUESTION_MAX * 100);
      return '<div class="bar-row" style="--c:' + t.color + '">' +
        '<span class="bar-label"><i></i>' + t.animal + '</span>' +
        '<span class="bar-track"><span class="bar-fill" data-w="' + pct + '"></span></span>' +
        '<span class="bar-val">' + v + ' / ' + CFG.QUESTION_MAX + '</span>' +
      '</div>';
    }).join('');
  }

  function reviewHtml() {
    return QS.map(function (q, i) {
      var oi = S.picks[i];
      var o = q.opts[oi];
      if (!o) {
        return '<div class="review-item"><span class="rno">' + (i + 1) + '</span>' +
          '<span><span class="rq">' + esc(q.q) + '</span><span class="ra">未作答</span></span></div>';
      }
      var t = TYPES[o.k];
      return '<div class="review-item" style="--c:' + t.color + '">' +
        '<span class="rno">' + (i + 1) + '</span>' +
        '<span><span class="rq">' + esc(q.q) + '</span>' +
        '<span class="ra">' + esc(o.text) + '</span></span>' +
        '<span class="rdim">' + t.animal + '</span>' +
      '</div>';
    }).join('');
  }

  function renderResult() {
    var res = computeResult();
    var t = TYPES[res.key];
    var mount = $('#resultMount');
    var spend = elapsedText();

    var verdict;
    if (res.key === 'C') {
      verdict = '四项最高分与最低分之差为 <b>' + res.gap + '</b>，不超过阈值 <b>' +
        CFG.CHAMELEON_GAP + '</b>，因此判定为<b>变色龙型</b>。这不是「没有性格」，而是四种倾向都比较可用。';
    } else {
      verdict = '最高分 <b>' + res.max + '</b>，最低分 <b>' + res.min + '</b>，极差 <b>' + res.gap +
        '</b> 超过阈值 <b>' + CFG.CHAMELEON_GAP + '</b>，取最高分维度作为主类型。' +
        (res.gap === CFG.CHAMELEON_GAP + 1 ? '它离变色龙的判定只差 1 分。' : '');
    }

    mount.innerHTML =
      '<div class="result-hero" style="--c:' + t.color + ';--tint:' + t.tint + '">' +
        '<div class="result-eyebrow">' +
          '<span class="dotpulse"></span>' +
          '<span>测评完成 · ' + CFG.QUESTION_MAX + ' / ' + CFG.QUESTION_MAX + ' 题' +
            (spend ? ' · 用时 ' + spend : '') + '</span>' +
        '</div>' +
        '<div class="result-main">' +
          '<div class="result-mark">' + mark(res.key, 52) + '</div>' +
          '<div class="result-title-wrap">' +
            '<h1 class="result-name">' + t.name + '<span>' + t.alias + '</span></h1>' +
            '<p class="result-headline">' + t.headline + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="result-kw">' + t.keywords.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
      '</div>' +

      '<div class="result-body" style="--c:' + t.color + '">' +
        '<div class="result-grid">' +
          '<div class="radar-card">' + radarSvg(res.key) +
            '<p class="footnote" style="text-align:center;margin-top:6px">四维得分（轴上限自适应）</p>' +
          '</div>' +
          '<div class="bars-card">' + barsHtml(res.key) +
            '<div class="balance-note">' + verdict + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="copy-sections">' +
          '<div class="copy-section"><h3>整体印象</h3><p>' + t.summary + '</p></div>' +
          '<div class="copy-section"><h3>核心优势</h3><p>' + t.merit + '</p></div>' +
          '<div class="copy-section"><h3>注意盲区</h3><p>' + t.blind + '</p></div>' +
          '<div class="copy-section"><h3>发展建议</h3><p>' + t.advice + '</p></div>' +
          '<div class="copy-section"><h3>和这类人协作</h3><p>' + t.collab + '</p></div>' +
        '</div>' +

        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" id="btnCard">' + ico('i-download') + '下载结果卡</button>' +
          '<button class="btn btn-ghost" type="button" id="btnCopyResult">' + ico('i-copy') + '复制文字结果</button>' +
          '<a class="btn btn-ghost" href="#/types">' + ico('i-info') + '查看五型图鉴</a>' +
          '<button class="btn btn-quiet" type="button" id="btnRestart">' + ico('i-restart') + '重新测试</button>' +
        '</div>' +
      '</div>' +

      '<details class="review" style="--c:' + t.color + '">' +
        '<summary>答题回顾 · 看看你每一题选了什么' +
          '<span>维度在此处公开' + ico('i-arrow', 'chev') + '</span>' +
        '</summary>' +
        '<div class="review-body">' + reviewHtml() + '</div>' +
      '</details>';

    /* 条形图入场 */
    requestAnimationFrame(function () {
      $$('#resultMount .bar-fill').forEach(function (el) {
        el.style.width = el.getAttribute('data-w') + '%';
      });
    });

    bindResultActions(res.key);
  }

  function bindResultActions(key) {
    var t = TYPES[key];

    var card = $('#btnCard');
    if (card) card.addEventListener('click', function () { downloadCard(t, computeResult()); });

    var copy = $('#btnCopyResult');
    if (copy) {
      copy.addEventListener('click', function () {
        var res = computeResult();
        var lines = [
          '我的 PDP 行为风格：' + t.name + '（' + t.alias + '）',
          t.keywords.join(' · '),
          '',
          '老虎 ' + S.scores.T + ' ｜ 孔雀 ' + S.scores.P + ' ｜ 考拉 ' + S.scores.K + ' ｜ 猫头鹰 ' + S.scores.O,
          '极差 ' + res.gap + '（阈值 ' + CFG.CHAMELEON_GAP + '）',
          '',
          '核心优势：' + t.merit,
          '注意盲区：' + t.blind,
          '发展建议：' + t.advice,
          '',
          '—— 五兽之镜 · PDP 行为风格测评'
        ];
        copyText(lines.join('\n'), '结果已复制');
      });
    }

    var restart = $('#btnRestart');
    if (restart) {
      restart.addEventListener('click', function () {
        resetState();
        showPanel('start');
        $('#btnResume').hidden = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ------------------------------------------------------------------ 分享卡 */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = text[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function downloadCard(t, res) {
    var W = 1080, H = 1440;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    var font = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
    var mono = 'ui-monospace, Consolas, monospace';

    /* 背景 */
    x.fillStyle = '#F7F6F2';
    x.fillRect(0, 0, W, H);

    /* 顶部色条 */
    x.fillStyle = t.color;
    x.fillRect(0, 0, W, 12);

    /* 右侧竖排动物名水印（中文竖排，比单个拉丁字母更贴合版式） */
    x.save();
    x.globalAlpha = .07;
    x.fillStyle = t.color;
    x.font = '600 104px ' + font;
    x.textAlign = 'center';
    var chars = t.animal.split('');
    var startY = 250;
    chars.forEach(function (ch, i) {
      x.fillText(ch, W - 118, startY + i * 118);
    });
    x.restore();
    x.textAlign = 'left';

    /* 品牌 */
    x.fillStyle = '#15171A';
    x.font = '700 38px ' + font;
    x.textAlign = 'left';
    x.fillText('五兽之镜', 80, 112);

    x.fillStyle = '#757983';
    x.font = '400 19px ' + font;
    x.fillText('PDP 行为风格测评 · 1024 造物挑战', 80, 150);

    /* 类型 */
    x.fillStyle = '#757983';
    x.font = '400 22px ' + font;
    x.fillText('你的类型', 80, 268);

    x.fillStyle = t.color;
    x.font = '700 92px ' + font;
    x.fillText(t.name, 80, 366);

    x.fillStyle = '#3C4048';
    x.font = '400 28px ' + font;
    x.fillText(t.alias + '　·　' + t.keywords.join(' / '), 80, 418);

    /* 分隔线 */
    x.strokeStyle = '#DDD8CA';
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(80, 468); x.lineTo(W - 80, 468); x.stroke();

    /* 四维 */
    x.fillStyle = '#757983';
    x.font = '600 18px ' + font;
    x.fillText('四维得分', 80, 512);

    var barX = 250, barW = 600, barH = 16;
    var y = 560;
    ['T', 'P', 'K', 'O'].forEach(function (k) {
      var tt = TYPES[k];
      var v = S.scores[k] || 0;
      var ratio = v / CFG.QUESTION_MAX;

      x.fillStyle = '#3C4048';
      x.font = '500 24px ' + font;
      x.fillText(tt.animal, 80, y + 14);

      x.fillStyle = '#EAE7DE';
      roundRect(x, barX, y, barW, barH, barH / 2); x.fill();

      if (ratio > 0) {
        x.fillStyle = tt.color;
        roundRect(x, barX, y, Math.max(barH, barW * ratio), barH, barH / 2); x.fill();
      }

      x.fillStyle = '#757983';
      x.font = '400 20px ' + mono;
      x.fillText(String(v), barX + barW + 24, y + 15);

      y += 62;
    });

    /* 判定说明 */
    x.fillStyle = '#F1EFE8';
    roundRect(x, 80, 806, W - 160, 74, 16); x.fill();
    x.fillStyle = '#3C4048';
    x.font = '400 20px ' + font;
    var judge = res.key === 'C'
      ? '极差 ' + res.gap + ' ≤ 阈值 ' + CFG.CHAMELEON_GAP + '，判为变色龙型'
      : '最高分 ' + res.max + ' · 最低分 ' + res.min + ' · 极差 ' + res.gap + '（阈值 ' + CFG.CHAMELEON_GAP + '）';
    x.fillText(judge, 108, 852);

    /* 金句 */
    x.fillStyle = '#15171A';
    x.font = '600 40px ' + font;
    var lines = wrapLines(x, t.headline, W - 160);
    lines.slice(0, 2).forEach(function (ln, i) {
      x.fillText(ln, 80, 962 + i * 56);
    });

    /* 优势卡：高度随文案行数自适应，整体在底部区间内垂直居中 */
    var meritLines = wrapLines(x, t.merit, W - 232).slice(0, 3);
    var cardH = 96 + meritLines.length * 40;
    var cardY = 1020 + Math.max(0, (250 - cardH) / 2);

    x.fillStyle = t.tint;
    roundRect(x, 80, cardY, W - 160, cardH, 24); x.fill();

    x.fillStyle = t.color;
    x.font = '600 19px ' + font;
    x.fillText('核心优势', 116, cardY + 48);

    x.fillStyle = '#3C4048';
    x.font = '400 24px ' + font;
    meritLines.forEach(function (ln, i) {
      x.fillText(ln, 116, cardY + 96 + i * 40);
    });

    /* 页脚 */
    x.strokeStyle = '#DDD8CA';
    x.beginPath(); x.moveTo(80, 1330); x.lineTo(W - 80, 1330); x.stroke();

    x.fillStyle = '#757983';
    x.font = '400 18px ' + font;
    x.fillText('全部计算在本地完成 · 不收集任何作答数据', 80, 1376);

    x.textAlign = 'right';
    x.font = '500 18px ' + font;
    x.fillText('1024 造物挑战 · 参赛作品', W - 80, 1376);
    x.textAlign = 'left';

    c.toBlob(function (blob) {
      if (!blob) { toast('生成失败，请换一个浏览器试试'); return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '五兽之镜-' + t.name + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('结果卡已生成，请查看下载文件');
    }, 'image/png');
  }

  /* ------------------------------------------------------------------ 复制 */
  function copyText(text, okMsg) {
    function done() { toast(okMsg || '已复制'); }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else {
      fallback();
    }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch (e) {
        toast('当前浏览器不允许自动复制，请手动选中');
      }
      document.body.removeChild(ta);
    }
  }

  function bindCopyButtons() {
    $$('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = $(btn.getAttribute('data-copy'));
        if (!target) return;

        var text;
        if (target.tagName === 'UL' || target.tagName === 'OL') {
          text = $$('li', target).map(function (li, i) {
            return (target.tagName === 'OL' ? (i + 1) + '. ' : '· ') + li.innerText.trim();
          }).join('\n');
        } else {
          text = $$('p', target).length
            ? $$('p', target).map(function (p) { return p.innerText.trim(); }).join('\n\n')
            : target.innerText.trim();
        }

        copyText(text);
        btn.classList.add('is-done');
        var old = btn.innerHTML;
        btn.innerHTML = ico('i-check') + '已复制';
        setTimeout(function () {
          btn.classList.remove('is-done');
          btn.innerHTML = old;
        }, 1800);
      });
    });
  }

  /* ------------------------------------------------------------------ 检查清单 */
  function bindChecklist() {
    var boxes = $$('#checklist input');
    if (!boxes.length) return;

    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      $('#checkDone').textContent = done;
      $('#checkFill').style.width = (done / boxes.length * 100) + '%';
    }

    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();
  }

  /* ------------------------------------------------------------------ 测评事件 */
  function bindTest() {
    $('#btnStart').addEventListener('click', function () {
      resetState();
      startQuiz(false);
    });

    $('#btnResume').addEventListener('click', function () {
      if (resumeAction === 'result') {
        renderResult();
        showPanel('result');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        showPanel('quiz');
        renderQuiz();
      }
    });

    $('#qOptions').addEventListener('click', function (e) {
      var btn = e.target.closest('.option');
      if (!btn) return;
      pickOption(parseInt(btn.getAttribute('data-idx'), 10));
    });

    $('#btnPrev').addEventListener('click', prevQuestion);

    $('#btnQuit').addEventListener('click', function () {
      if (!window.confirm('退出后本次作答进度会被清空，确定要退出吗？')) return;
      resetState();
      showPanel('start');
      $('#btnResume').hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.addEventListener('keydown', function (e) {
      if (currentRoute !== 'test') return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;

      var quizVisible = !$('#testQuiz').hidden;
      var startVisible = !$('#testStart').hidden;

      if (startVisible && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        $('#btnStart').click();
        return;
      }

      if (!quizVisible) return;

      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        pickOption(parseInt(e.key, 10) - 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevQuestion();
      }
    });
  }

  /* ------------------------------------------------------------------ 进场动画 */
  function bindReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    $$('.reveal').forEach(function (el) { io.observe(el); });

    /* 动态渲染出来的卡片补登记 */
    setTimeout(function () {
      $$('.reveal:not(.is-in)').forEach(function (el) { io.observe(el); });
    }, 60);
  }

  /* ------------------------------------------------------------ 访问统计 */
  /* 口径：全站累计访问次数，按「设备 × 自然日」去重。
     页面打开时向计数服务发一次请求（该请求本身即 +1），当天其余加载
     直接读本机缓存不再请求，所以刷新页面不会把数字刷高。
     服务不可达时回退为本机计数，并在副行如实标注，不假装是全网数据。 */
  var STATS_KEY = 'wushou.visit.v2';
  var STATS_GAP = 30 * 60 * 1000;
  var STATS_TIMEOUT = 9000;
  var COUNTER_URL = 'https://hitscounter.dev/api/hit?url=wushou-pdp-mirror%2Eapp%2Eworkbuddy%2Ehost&label=visit';

  function readStats() {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return d && typeof d === 'object' ? d : null;
    } catch (e) { return null; }
  }

  function saveStats(d) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function dayKey(ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1;
    var dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
  }

  /* remote 为空表示全网数字拿不到，退回本机口径 */
  function paintStats(local, remote) {
    var numEl = $('#visitCount');
    var labelEl = $('#visitLabel');
    var metaEl = $('#visitMeta');
    if (!numEl) return;

    if (remote && typeof remote.total === 'number') {
      numEl.textContent = String(remote.total);
      if (labelEl) labelEl.textContent = '次全站访问';
      if (metaEl) metaEl.textContent = '按设备每日计一次';
    } else {
      numEl.textContent = String(local.count);
      if (labelEl) labelEl.textContent = '次本机访问';
      if (metaEl) metaEl.textContent = '统计暂不可达 · 累计 ' + local.days.length + ' 天';
    }
  }

  function initVisitStats() {
    var numEl = $('#visitCount');
    if (!numEl) return;

    var now = Date.now();
    var today = dayKey(now);
    var s = readStats() || {};
    if (typeof s.count !== 'number') s.count = 0;
    if (!s.first) s.first = now;
    if (!Array.isArray(s.days)) s.days = [];

    /* 本机口径：30 分钟内的重复加载算同一次访问 */
    if (now - (s.last || 0) > STATS_GAP) {
      s.count += 1;
      if (s.days.indexOf(today) < 0) s.days.push(today);
      s.last = now;
      saveStats(s);
    }

    var local = { count: s.count, days: s.days };

    /* 今天已经取过全网数字：直接显示，不再发请求 */
    if (s.day === today && typeof s.total === 'number') {
      paintStats(local, { total: s.total, today: s.today || 0 });
      return;
    }

    if (!window.fetch) { paintStats(local, null); return; }

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, STATS_TIMEOUT);
    var opts = { cache: 'no-store' };
    if (ctrl) opts.signal = ctrl.signal;

    fetch(COUNTER_URL, opts)
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (svg) {
        clearTimeout(timer);
        /* 徽章里的 aria-label 形如 "visit: 3 / 128"，前者是今日、后者是累计 */
        var m = svg ? /aria-label="[^"]*?(\d+)\s*\/\s*(\d+)"/.exec(svg) : null;
        if (!m) { paintStats(local, null); return; }

        var cur = readStats() || s;
        cur.day = today;
        cur.today = parseInt(m[1], 10);
        cur.total = parseInt(m[2], 10);
        saveStats(cur);
        paintStats(local, { total: cur.total, today: cur.today });
      })
      .catch(function () {
        clearTimeout(timer);
        paintStats(local, null);
      });
  }

  /* ------------------------------------------------------------------ 启动 */
  function init() {
    renderTypeStrip();
    renderHomeScenarios();
    renderGallery();
    renderScenarioList();
    renderFeatures();

    bindNav();
    bindTest();
    bindCopyButtons();
    bindChecklist();
    bindReveal();
    initVisitStats();

    window.addEventListener('hashchange', onRouteChange);
    onRouteChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
