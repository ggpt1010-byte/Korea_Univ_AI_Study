// 공통 기능: 데이터 불러오기와 화면 요소 만들기.
// 모임원이 입력한 글이 그대로 들어오므로, 화면에 넣을 때는 항상 textContent만 사용한다.

const CATEGORIES = ['전체', '챗봇', '도구', '이미지', '게임', '기타'];

async function loadProjects() {
  const res = await fetch('data/projects.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('결과물 목록을 불러오지 못했어요 (' + res.status + ')');
  const list = await res.json();
  return Array.isArray(list) ? list : [];
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
