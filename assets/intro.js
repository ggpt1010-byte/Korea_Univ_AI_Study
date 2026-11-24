// 소개 페이지(intro.html)의 움직임: 입자 배경, 3D 기울기, 스크롤 단계, 숫자 올라가기, 실제 숫자 불러오기.
// 움직임을 줄이도록 설정한 사람에게는 정지 화면만 보여 준다.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // 숫자를 0부터 목표까지 올린다.
  function countUp(node, to, opts) {
    opts = opts || {};
    var prefix = opts.prefix || '';
    var from = opts.from || 0;
    var dur = opts.duration || 1400;
    var fmt = function (n) { return prefix + Math.round(n).toLocaleString('ko-KR'); };
    if (reduce) { node.textContent = fmt(to); return; }
    var start = null;
    if (node._raf) cancelAnimationFrame(node._raf);
    function tick(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (p < 1) node._raf = requestAnimationFrame(tick);
    }
    node._raf = requestAnimationFrame(tick);
  }

  // 1) 입자 배경: 점들이 떠다니다 가까우면 선으로 이어진다. 마우스 근처 점은 살짝 끌려온다.
  function particles(canvas, density) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [];
    var w = 0, h = 0;
    var mouse = { x: -9999, y: -9999 };
    var running = false;

    function resize() {
      var r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(110, Math.max(28, (w * h) / density)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.8 + 0.8, z: Math.random() });
      }
      if (reduce) draw();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var link = Math.min(140, w / 7);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (!reduce) {
          var dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 32000) { p.vx += dx * 0.00004; p.vy += dy * 0.00004; }
          p.vx *= 0.995; p.vy *= 0.995;
          p.x += p.vx * (0.5 + p.z); p.y += p.vy * (0.5 + p.z);
          if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
          if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.05;
          if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.05;
        }
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j];
          var ex = p.x - q.x, ey = p.y - q.y, d = Math.sqrt(ex * ex + ey * ey);
          if (d < link) {
            ctx.strokeStyle = 'rgba(140,160,255,' + (0.28 * (1 - d / link)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.fillStyle = p.z > 0.8 ? 'rgba(63,214,176,0.9)' : 'rgba(170,186,255,' + (0.45 + p.z * 0.4).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.7 + p.z * 0.6), 0, Math.PI * 2); ctx.fill();
      }
    }

    function loop() {
      if (!running) return;
      draw();
      requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    canvas.parentElement.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    canvas.parentElement.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
    if (reduce) return;
    // 화면에 보일 때만 그린다(배터리 아끼기).
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !running) { running = true; requestAnimationFrame(loop); }
      if (!vis) running = false;
    }).observe(canvas);
  }
  var small = window.innerWidth < 700;
  particles(document.getElementById('particles'), small ? 9000 : 11000);
  particles(document.getElementById('particles-2'), small ? 12000 : 15000);

  // 2) 첫 화면 카드 3D 기울기: 마우스를 따라 기울고, 터치 화면에서는 스스로 천천히 흔들린다.
  var tilt = document.getElementById('tilt');
  var tiltInner = document.getElementById('tilt-inner');
  if (tilt && tiltInner && !reduce) {
    var hero = document.getElementById('hero');
    if (finePointer) {
      hero.addEventListener('pointermove', function (e) {
        var r = tilt.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        var y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        tiltInner.style.setProperty('--ry', (-14 + x * 30).toFixed(2) + 'deg');
        tiltInner.style.setProperty('--rx', (8 - y * 22).toFixed(2) + 'deg');
      });
      hero.addEventListener('pointerleave', function () {
        tiltInner.style.removeProperty('--ry'); tiltInner.style.removeProperty('--rx');
      });
    } else {
      var t0 = performance.now();
      (function sway(t) {
        var s = (t - t0) / 1000;
        tiltInner.style.setProperty('--ry', (-12 + Math.sin(s * 0.8) * 10).toFixed(2) + 'deg');
        tiltInner.style.setProperty('--rx', (8 + Math.cos(s * 0.6) * 5).toFixed(2) + 'deg');
        requestAnimationFrame(sway);
      })(t0);
    }
  }

  // 3) 스크롤하면 나타나기
  var reveals = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (n) { n.classList.add('is-in'); });
  } else {
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } });
    }, { threshold: 0.15 });
    reveals.forEach(function (n) { ro.observe(n); });
  }

  // 4) 흐름: 화면 가운데에 온 단계에 맞춰 예시 카드가 바뀐다.
  var stage = document.getElementById('stage');
  var steps = Array.prototype.slice.call(document.querySelectorAll('.i-step'));
  var v1 = document.getElementById('value-v1');
  var v2 = document.getElementById('value-v2');
  var current = 0;
  function setStep(n) {
    if (n === current) return;
    var prev = current;
    current = n;
    stage.setAttribute('data-step', String(n));
    stage.classList.remove('is-uploaded');
    if (n === 1) setTimeout(function () { if (current === 1) stage.classList.add('is-uploaded'); }, 1400);
    steps.forEach(function (s) { s.classList.toggle('is-active', Number(s.getAttribute('data-step')) === n); });
    if (n === 2 && prev < 2) countUp(v1, 3200000, { prefix: '₩ ', duration: 1600 });
    if (n >= 2 && prev < 2 && n > 2) v1.textContent = '₩ 3,200,000';
    if (n === 1) v1.textContent = '₩ 0';
    if (n === 4) countUp(v2, 8500000, { prefix: '₩ ', from: 3200000, duration: 1800 });
  }
  if (stage && steps.length) {
    if ('IntersectionObserver' in window) {
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) setStep(Number(e.target.getAttribute('data-step'))); });
      }, { rootMargin: window.innerWidth <= 860 ? '-64% 0px -30% 0px' : '-45% 0px -45% 0px' });
      steps.forEach(function (s) { so.observe(s); });
    }
    setStep(1);
  }

  // 5) 위쪽 진행 막대
  var bar = document.getElementById('scroll-bar');
  if (bar) {
    var onScroll = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 6) 실제 숫자: 서버가 이 사람에게 보여 주는 것만 센다(비공개 결과물은 빼고 센다).
  var statsBox = document.getElementById('stats');
  var DB = globalThis.DB;
  function show(values) {
    var shown = false;
    statsBox.querySelectorAll('.i-stat-num').forEach(function (node) {
      var v = values[node.getAttribute('data-key')];
      if (typeof v !== 'number') return;
      var run = function () { countUp(node, v, { duration: 1500 }); };
      if (reduce || !('IntersectionObserver' in window)) { run(); return; }
      var o = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { run(); o.disconnect(); }
      }, { threshold: 0.4 });
      o.observe(node);
      shown = true;
    });
    var note = document.getElementById('stats-note');
    if (note && values.projects >= 10) note.textContent = '숫자는 지금 이 순간의 실제 값이에요.';
    return shown;
  }
  if (statsBox && DB && DB.enabled) {
    var safe = function (p) { return p.catch(function () { return null; }); };
    Promise.all([
      safe(DB.select('projects', 'id,parent,is_private')),
      safe(DB.select('groups', 'id')),
      safe(DB.select('likes', 'target')),
      safe(DB.select('value_events', 'kind,target'))
    ]).then(function (r) {
      var values = {};
      if (r[0]) values.projects = r[0].filter(function (p) { return !p.is_private && !p.parent; }).length;
      if (r[1]) values.groups = r[1].length;
      if (r[2]) values.likes = r[2].length;
      if (r[3]) {
        var seen = {};
        r[3].forEach(function (e) { if (e.kind === '가치 평가' || e.kind === 'AI 평가') seen[e.target] = true; });
        values.valued = Object.keys(seen).length;
      }
      if (!Object.keys(values).length) { statsBox.hidden = true; return; }
      show(values);
    });
  }
})();
