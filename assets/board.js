// 결과물 판: 맨 위 "이번 주 새 결과물"(최근 7일), 그다음 좋아요 Top 4(테두리), 그 아래 나머지(기본 좋아요 순).
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

// opts: { list, data, state: { sort }, rerender, extraFor, emptyText, idPrefix }
function boardSections(opts) {
  const list = opts.list;
  const data = opts.data;
  const prefix = opts.idPrefix || 'board';
  const top = topList(list, data);
  const ranks = new Map(top.map((p, i) => [p.id, i + 1]));
  const card = (p) => boardCard(p, data, ranks.get(p.id), opts.extraFor);

  // 이번 주 새 결과물: 최신 순
  const week = sortList(list.filter(isThisWeek), data, 'new');
  const weekBox = el('section', { class: 'week-box', 'aria-labelledby': prefix + '-week' }, [
    el('div', { class: 'week-head' }, [
      el('h2', { class: 'section-title', id: prefix + '-week', text: '이번 주 새로 올라온 결과물' }),
      el('p', { class: 'count', text: '최근 ' + WEEK_DAYS + '일 새 결과물과 새 버전 · ' + week.length + '개' })
    ]),
    week.length
      ? el('div', { class: 'grid grid-cards' }, week.map(card))
      : el('p', { class: 'hint', text: '이번 주에 올라오거나 새 버전이 나온 결과물이 아직 없어요.' })
  ]);

  // 좋아요 Top 4
  const topBox = el('section', { class: 'list-section', 'aria-labelledby': prefix + '-top' }, [
    el('div', { class: 'toolbar' }, [
      el('h2', { class: 'section-title', id: prefix + '-top', text: '좋아요 Top ' + TOP }),
      el('p', { class: 'count', text: '좋아요를 가장 많이 받은 결과물이에요.' })
    ]),
    top.length
      ? el('div', { class: 'grid grid-cards' }, top.map(card))
      : el('p', { class: 'hint', text: '아직 좋아요를 받은 결과물이 없어요. 마음에 드는 결과물에 ♡를 눌러 주세요.' })
  ]);

  // 나머지: 기본 좋아요 순, 조회수, 가격, 업로드 순으로 바꿀 수 있다.
  const sortSelect = el('select', { id: prefix + '-sort', class: 'sort-select' }, SORTS.map((s) => {
    const o = el('option', { value: s.key, text: s.label });
    if (s.key === opts.state.sort) o.selected = true;
    return o;
  }));
  sortSelect.addEventListener('change', () => { opts.state.sort = sortSelect.value; opts.rerender(); });
  const rest = sortList(list.filter((p) => !ranks.has(p.id)), data, opts.state.sort);
  const restBox = el('section', { class: 'list-section', 'aria-labelledby': prefix + '-all' }, [
    el('div', { class: 'toolbar' }, [
      el('h2', { class: 'section-title', id: prefix + '-all', text: opts.title || '전체 결과물' }),
      el('div', { class: 'sort-box' }, [el('label', { for: prefix + '-sort', text: '정렬' }), sortSelect])
    ]),
    rest.length
      ? el('div', { class: 'grid grid-cards' }, rest.map(card))
      : el('div', { class: 'empty' }, [el('p', { text: opts.emptyText || 'Top ' + TOP + ' 말고는 아직 결과물이 없어요.' })])
  ]);
  return [weekBox, topBox, restBox];
}
