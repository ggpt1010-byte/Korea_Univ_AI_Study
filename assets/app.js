// 공통 기능: 데이터 불러오기와 화면 요소 만들기.
// 모임원이 입력한 글이 그대로 들어오므로, 화면에 넣을 때는 항상 textContent만 사용한다.

const CATEGORIES = ['전체', '사이트', '게임', '기타'];

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error('결과물 목록을 불러오지 못했어요 (' + res.status + ')');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// 모임원이 구글 폼으로 등록한 결과물. 시트를 바로 읽고, 안 되면 저장소에 받아 둔 사본을 쓴다.
async function loadSubmitted() {
  const config = globalThis.SITE_CONFIG || {};
  if (!config.sheetCsvUrl) return [];
  try {
    const res = await fetch(config.sheetCsvUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return SheetData.rowsToProjects(SheetData.parseCsv(await res.text()));
  } catch (err) {
    try { return await fetchJson('data/submissions.json'); } catch (err2) { return []; }
  }
}

// 최근에 올라온 결과물이 먼저 오도록 정렬해서 돌려준다.
async function loadProjects() {
  const [base, submitted] = await Promise.all([fetchJson('data/projects.json'), loadSubmitted()]);
  const key = (p) => String(p.createdAt || '') + '#' + String(p.row || 0).padStart(6, '0');
  return submitted.concat(base).sort((a, b) => key(b).localeCompare(key(a)));
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  });
  (children || []).forEach((child) => { if (child) node.append(child); });
  return node;
}

// http, https 주소만 링크로 쓴다. 그 밖의 주소는 버린다.
function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch (err) {
    return null;
  }
}

// 사진 넘겨 보기. 올린 사람이 적은 사진 주소들 다음에, 자동으로 찍어 둔 체험 링크 첫 화면을 둔다.
function photoList(project) {
  const list = [];
  [project.image].concat(project.images || []).forEach((src) => {
    if (src && list.indexOf(src) === -1) list.push(src);
  });
  list.push('shots/' + encodeURIComponent(project.id) + '.jpg');
  return list;
}

function thumbnail(project, extraClass) {
  const box = el('div', { class: 'thumb' + (extraClass ? ' ' + extraClass : '') });
  let photos = photoList(project);
  let index = 0;
  const img = el('img', { alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  const prev = el('button', { type: 'button', class: 'thumb-nav thumb-prev', 'aria-label': '이전 사진' });
  const next = el('button', { type: 'button', class: 'thumb-nav thumb-next', 'aria-label': '다음 사진' });
  prev.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg>';
  next.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 4.5L13 10l-5.5 5.5"/></svg>';
  const counter = el('span', { class: 'thumb-count', 'aria-live': 'polite' });

  function show() {
    if (!photos.length) {
      box.replaceChildren(document.createTextNode('첫 화면 미리보기를 준비하고 있어요'));
      return;
    }
    index = (index + photos.length) % photos.length;
    img.src = photos[index];
    img.alt = project.title + ' 사진 ' + (index + 1);
    const many = photos.length > 1;
    prev.hidden = !many;
    next.hidden = !many;
    counter.hidden = !many;
    counter.textContent = (index + 1) + ' / ' + photos.length;
  }
  // 불러오지 못한 사진은 목록에서 빼고 다음 사진을 보여 준다.
  img.addEventListener('error', () => { photos.splice(index, 1); show(); });
  prev.addEventListener('click', (e) => { e.preventDefault(); index -= 1; show(); });
  next.addEventListener('click', (e) => { e.preventDefault(); index += 1; show(); });
  box.append(img, prev, next, counter);
  show();
  return box;
}

// 공개, 비공개 아이콘.
const ICONS = {
  lock: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>',
  globe: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 1.7 2.6 3.7 2.6 6S9.8 12.3 8 14M8 2C6.2 3.7 5.4 5.7 5.4 8s.8 4.3 2.6 6"/></svg>'
};
function visibilityTag(p) {
  const tag = el('span', { class: 'tag ' + (p.private ? 'tag-private' : 'tag-public') });
  tag.innerHTML = p.private ? ICONS.lock : ICONS.globe;
  tag.append(document.createTextNode(p.private ? '비공개' : '공개'));
  return tag;
}

// 결과물과 그룹 기록(검증, 평가 금액)을 함께 불러온다. 그룹 기록을 못 읽어도 결과물은 보여 준다.
function loadBoard() {
  const G = globalThis.Groups;
  const empty = { groups: [], votes: {}, valueEvents: [] };
  return Promise.all([loadProjects(), G ? G.load().catch(() => empty) : Promise.resolve(empty)])
    .then(([projects, data]) => ({ projects: projects, data: data }));
}

// 카드 아래쪽의 예상 가치 줄.
function valueLine(p, data) {
  const M = globalThis.Manager;
  const v = M ? M.valueOf(p, data) : { state: 'requested' };
  if (v.state === 'done') {
    return el('div', { class: 'card-value' }, [
      el('span', {}, [el('span', { class: 'value-label', text: '예상 가치 ' }), el('strong', { text: M.won(v.value) })]),
      el('span', {}, [el('span', { class: 'value-label', text: '개선 시 예상 가치 ' }), el('strong', { text: M.won(v.improved) })])
    ]);
  }
  return el('div', { class: 'card-value' }, [
    el('span', { class: 'value-label', text: '예상 가치' }),
    el('span', { class: 'value-state' + (v.state === 'analyzing' ? ' is-busy' : ''), text: v.state === 'analyzing' ? '분석 중' : '요청 중' })
  ]);
}

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? m[1] + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일' : '';
}

function projectLink(project) {
  return 'project.html?id=' + encodeURIComponent(project.id);
}

function shortDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? m[1] + '.' + m[2] + '.' + m[3] : '';
}

// 목록, 내 정보, 그룹 화면에서 같이 쓰는 결과물 카드. extra 는 카드 아래쪽에 덧붙일 요소, data 는 그룹 기록.
function projectCard(p, extra, data) {
  return el('article', { class: 'card' }, [
    thumbnail(p),
    el('div', { class: 'card-body' }, [
      el('div', { class: 'card-top' }, [
        el('div', { class: 'tag-row' }, [el('span', { class: 'tag', text: p.category || '기타' }), visibilityTag(p)]),
        el('div', { class: 'card-when' }, [
          shortDate(p.createdAt) ? el('span', { text: shortDate(p.createdAt) }) : null,
          el('span', { text: p.author })
        ])
      ]),
      el('h2', {}, [el('a', { href: projectLink(p), text: p.title })]),
      el('p', { class: 'summary', text: p.summary }),
      valueLine(p, data),
      extra || null,
      el('a', { class: 'btn btn-outline btn-block', href: projectLink(p), text: '자세히 보고 체험하기' })
    ])
  ]);
}
