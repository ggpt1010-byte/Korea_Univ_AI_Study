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

// 직접 올린 이미지가 있으면 그것을, 없으면 자동으로 찍어 둔 체험 링크 첫 화면을 보여 준다.
function thumbnail(project, extraClass) {
  const box = el('div', { class: 'thumb' + (extraClass ? ' ' + extraClass : '') });
  const src = project.image || 'shots/' + encodeURIComponent(project.id) + '.jpg';
  const img = el('img', { src: src, alt: project.title + ' 첫 화면', loading: 'lazy' });
  img.addEventListener('error', () => {
    box.replaceChildren(document.createTextNode('첫 화면 미리보기를 준비하고 있어요'));
  });
  box.append(img);
  return box;
}

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? m[1] + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일' : '';
}

function projectLink(project) {
  return 'project.html?id=' + encodeURIComponent(project.id);
}

// 목록과 내 정보 화면에서 같이 쓰는 결과물 카드.
function projectCard(p) {
  return el('article', { class: 'card' }, [
    thumbnail(p),
    el('div', { class: 'card-body' }, [
      el('span', { class: 'tag', text: p.category || '기타' }),
      el('h2', {}, [el('a', { href: projectLink(p), text: p.title })]),
      el('p', { class: 'summary', text: p.summary }),
      el('div', { class: 'card-meta', text: p.author }),
      el('a', { class: 'btn btn-outline btn-block', href: projectLink(p), text: '자세히 보고 체험하기' })
    ])
  ]);
}
