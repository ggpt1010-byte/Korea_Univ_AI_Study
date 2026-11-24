// 결과물 판: 맨 위 슬라이드(이번 주 새 결과물, 좋아요 Top 4, 조회수 Top 4), 바로 아래 전체 결과물(기본 좋아요 순).
// 첫 화면과 방 화면의 공개 결과물에서 같이 쓴다.
const SORTS = [
  { key: 'likes', label: '좋아요 순' },
  { key: 'views', label: '조회수 순' },
  { key: 'price', label: '가격 순' },
  { key: 'new', label: '업로드 순' }
];
const WEEK_DAYS = 7;
const TOP = 4;

function koreaToday() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function daysAgo(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return Infinity;
  return Math.round((Date.parse(koreaToday()) - Date.parse(isoDate)) / 86400000);
}
function isThisWeek(p) { const d = daysAgo(p.updatedAt || p.createdAt); return d >= 0 && d < WEEK_DAYS; }

function boardStats(p, data) {
  const G = globalThis.Groups;
  const M = globalThis.Manager;
  const v = M ? M.valueOf(p, data) : { state: 'requested' };
  return {
    likes: G && G.likersFor ? G.likersFor(data, String(p.id)).length : 0,
    views: G && G.viewsFor ? G.viewsFor(data, String(p.id)) : 0,
    price: v.state === 'done' ? Number(v.value) || 0 : -1, // 아직 평가 전이면 맨 뒤로
    when: String(p.updatedAt || p.createdAt || '') + '#' + String(p.row || 0).padStart(12, '0')
  };
}

// 정렬. 같으면 좋아요, 조회수, 최신 순으로 가른다.
function sortList(list, data, key) {
  const s = new Map(list.map((p) => [p, boardStats(p, data)]));
  const order = {
    likes: ['likes', 'views', 'when'],
    views: ['views', 'likes', 'when'],
    price: ['price', 'likes', 'when'],
    new: ['when', 'likes', 'views']
  }[key] || ['likes', 'views', 'when'];
  return list.slice().sort((a, b) => {
    for (const k of order) {
      const x = s.get(a)[k];
      const y = s.get(b)[k];
      if (x === y) continue;
      return k === 'when' ? String(y).localeCompare(String(x)) : y - x;
    }
    return 0;
  });
}

// 좋아요 Top 4. 좋아요가 하나도 없으면 순위에 넣지 않는다.
function topList(list, data) {
  return sortList(list, data, 'likes').filter((p) => boardStats(p, data).likes > 0).slice(0, TOP);
}

// 카드 하나. 순위가 있으면 테두리와 배지를 붙인다.
function boardCard(p, data, rank, extraFor) {
  const card = projectCard(p, extraFor ? extraFor(p) : null, data);
  if (rank) {
    card.classList.add('is-rank', 'rank-' + rank);
    card.prepend(el('span', { class: 'rank-badge', text: rank + '위' }));
  }
  return card;
}

// 조회수 Top 4. 조회가 하나도 없으면 순위에 넣지 않는다.
function viewTopList(list, data) {
  return sortList(list, data, 'views').filter((p) => boardStats(p, data).views > 0).slice(0, TOP);
}

// 맨 위 슬라이드: 이번 주 새 결과물, 좋아요 Top 4, 조회수 Top 4를 한 자리에서 넘겨 본다.
// 위쪽 버튼으로 고르고, 6초마다 저절로 다음 것으로 넘어간다.
// 마우스를 올리거나 손가락으로 만지거나 안을 키보드로 다니는 동안은 멈춘다. 멈춤 버튼도 있다.
// 움직임 줄이기 설정을 켠 사람에게는 저절로 넘기지 않는다.
const SLIDE_MS = 6000;
const slideTimers = {};
function highlightSection(opts) {
  const list = opts.list;
  const data = opts.data;
  const prefix = opts.idPrefix || 'board';
  const state = opts.state;
  const extraFor = opts.extraFor;
  const week = sortList(list.filter(isThisWeek), data, 'new');
  const panels = [
    {
      key: 'week', tab: '이번 주 새 결과물', count: week.length,
      desc: '최근 ' + WEEK_DAYS + '일 안에 올라오거나 새 버전이 나온 결과물' + (week.length > TOP ? ' 중 최신 ' + TOP + '개예요. 나머지는 아래 전체 결과물에서 볼 수 있어요.' : '이에요.'),
      items: week.slice(0, TOP).map((p) => boardCard(p, data, 0, extraFor)),
      empty: '이번 주에 올라오거나 새 버전이 나온 결과물이 아직 없어요.'
    },
    {
      key: 'likes', tab: '좋아요 Top ' + TOP,
      desc: '좋아요를 가장 많이 받은 결과물이에요.',
      items: topList(list, data).map((p, i) => boardCard(p, data, i + 1, extraFor)),
      empty: '아직 좋아요를 받은 결과물이 없어요. 마음에 드는 결과물에 ♡를 눌러 주세요.'
    },
    {
      key: 'views', tab: '조회수 Top ' + TOP,
      desc: '사람들이 가장 많이 열어 본 결과물이에요.',
      items: viewTopList(list, data).map((p, i) => boardCard(p, data, i + 1, extraFor)),
      empty: '아직 조회 기록이 없어요.'
    }
  ];
  if (!panels.some((x) => x.key === state.slide)) state.slide = 'week';
  const reduce = globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (state.slidePaused === undefined) state.slidePaused = Boolean(reduce);

  const tabs = [];
  const boxes = [];
  const tabList = el('div', { class: 'hl-tabs', role: 'tablist', 'aria-label': '골라 보기' });
  panels.forEach((x, i) => {
    const tabId = prefix + '-hl-tab-' + x.key;
    const panelId = prefix + '-hl-panel-' + x.key;
    const tab = el('button', { type: 'button', class: 'hl-tab', role: 'tab', id: tabId, 'aria-controls': panelId }, [
      el('span', { text: x.tab }),
      x.count !== undefined ? el('span', { class: 'hl-tab-count', text: String(x.count) }) : null
    ]);
    tab.addEventListener('click', () => { show(x.key); restart(); });
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = panels[(i + step + panels.length) % panels.length];
      show(next.key); restart();
      tabs[panels.indexOf(next)].focus();
    });
    tabs.push(tab);
    tabList.append(tab);
    boxes.push(el('div', { class: 'hl-panel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId }, [
      el('p', { class: 'hl-desc', text: x.desc }),
      x.items.length
        ? el('div', { class: 'hl-grid' }, x.items)
        : el('div', { class: 'hl-empty' }, [el('p', { text: x.empty })])
    ]));
  });

  const bar = el('span', { class: 'hl-bar' });
  const pauseBtn = el('button', { type: 'button', class: 'hl-pause' });
  const track = el('div', { class: 'hl-track' }, boxes);
  const root = el('section', { class: 'hl', 'aria-label': '눈에 띄는 결과물', 'aria-roledescription': '슬라이드' }, [
    tabList,
    track,
    el('div', { class: 'hl-foot' }, [el('div', { class: 'hl-progress', 'aria-hidden': 'true' }, [bar]), pauseBtn])
  ]);

  function show(key) {
    state.slide = key;
    panels.forEach((x, i) => {
      const on = x.key === key;
      tabs[i].setAttribute('aria-selected', String(on));
      tabs[i].tabIndex = on ? 0 : -1;
      boxes[i].classList.toggle('is-on', on);
      if (on) boxes[i].removeAttribute('inert'); else boxes[i].setAttribute('inert', '');
      boxes[i].setAttribute('aria-hidden', String(!on));
    });
  }
  function step(n) {
    const i = panels.findIndex((x) => x.key === state.slide);
    show(panels[(i + n + panels.length) % panels.length].key);
  }

  // 저절로 넘기기. 멈출 이유가 있는 동안은 시간이 흐르지 않는다.
  let elapsed = 0;
  let touchedAt = 0;
  function restart() { elapsed = 0; bar.style.width = '0%'; }
  function drawPause() {
    pauseBtn.innerHTML = state.slidePaused
      ? '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4L13 8z"/></svg>'
      : '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.8" width="3.2" height="10.4" rx="1"/><rect x="9.3" y="2.8" width="3.2" height="10.4" rx="1"/></svg>';
    pauseBtn.append(el('span', { class: 'hl-pause-text', text: state.slidePaused ? '자동 넘김 켜기' : '자동 넘김 멈춤' }));
    pauseBtn.setAttribute('aria-pressed', String(Boolean(state.slidePaused)));
    root.classList.toggle('is-paused', Boolean(state.slidePaused));
  }
  pauseBtn.addEventListener('click', () => { state.slidePaused = !state.slidePaused; restart(); drawPause(); });
  root.addEventListener('touchstart', () => { touchedAt = Date.now(); }, { passive: true });

  // 손가락으로 옆으로 밀면 다음 것으로 넘어간다. 폰에서 카드 줄이 옆으로 움직일 때는 카드 줄이 먼저다.
  let sx = null;
  let sy = 0;
  track.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const grid = track.querySelector('.hl-panel.is-on .hl-grid');
    if (grid && grid.scrollWidth > grid.clientWidth + 4) {
      const atStart = grid.scrollLeft <= 4;
      const atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 4;
      if (dx < 0 && !atEnd) return;
      if (dx > 0 && !atStart) return;
    }
    step(dx < 0 ? 1 : -1);
    restart();
  }, { passive: true });

  clearInterval(slideTimers[prefix]);
  const TICK = 100;
  slideTimers[prefix] = setInterval(() => {
    if (!root.isConnected) { clearInterval(slideTimers[prefix]); return; }
    const hold = state.slidePaused || document.hidden || Date.now() - touchedAt < 10000 ||
      root.matches(':hover') || root.contains(document.activeElement);
    if (hold) return;
    elapsed += TICK;
    bar.style.width = Math.min(100, elapsed / SLIDE_MS * 100) + '%';
    if (elapsed >= SLIDE_MS) { step(1); restart(); }
  }, TICK);

  show(state.slide);
  drawPause();
  return root;
}

// 전체 결과물: 기본 좋아요 순, 조회수, 가격, 업로드 순으로 바꿀 수 있다.
// opts.toolbar 가 있으면 제목 바로 아래에 둔다(분류 칩 등).
function allSection(opts) {
  const list = opts.list;
  const data = opts.data;
  const prefix = opts.idPrefix || 'board';
  const ranks = new Map(topList(list, data).map((p, i) => [p.id, i + 1]));
  const sortSelect = el('select', { id: prefix + '-sort', class: 'sort-select' }, SORTS.map((s) => {
    const o = el('option', { value: s.key, text: s.label });
    if (s.key === opts.state.sort) o.selected = true;
    return o;
  }));
  sortSelect.addEventListener('change', () => { opts.state.sort = sortSelect.value; opts.rerender(); });
  const all = sortList(list, data, opts.state.sort);
  return el('section', { class: 'list-section', 'aria-labelledby': prefix + '-all' }, [
    el('div', { class: 'toolbar' }, [
      el('h2', { class: 'section-title', id: prefix + '-all', text: opts.title || '전체 결과물' }),
      el('div', { class: 'sort-box' }, [el('label', { for: prefix + '-sort', text: '정렬' }), sortSelect])
    ]),
    opts.toolbar || null,
    all.length
      ? el('div', { class: 'grid grid-cards' }, all.map((p) => boardCard(p, data, ranks.get(p.id), opts.extraFor)))
      : el('div', { class: 'empty' }, [el('p', { text: opts.emptyText || '아직 결과물이 없어요.' })])
  ]);
}

// opts: { list, data, state: { sort, slide }, rerender, extraFor, emptyText, idPrefix, title }
function boardSections(opts) {
  return [highlightSection(opts), allSection(opts)];
}
