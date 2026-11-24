// 첫 화면: 분류 칩, 이번 주 새 결과물, 순위 목록(기본 좋아요 순).
(function () {
  const chipsBox = document.getElementById('chips');
  const board = document.getElementById('board');
  const count = document.getElementById('count');
  let projects = [];
  let data = null;
  let selected = '전체';
  const state = { sort: 'likes' };
  // 협업 거르기: 오픈소스만, 같이 할 사람 구함만. 분류와 함께 쓸 수 있다.
  const toggles = [
    { key: 'openSource', label: '오픈소스만', on: false },
    { key: 'seeking', label: '같이 할 사람 구함', on: false }
  ];

  function render() {
    chipsBox.replaceChildren(...CATEGORIES.map((c) => {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c === selected), text: c });
      b.addEventListener('click', () => { selected = c; render(); });
      return b;
    }), el('span', { class: 'chip-sep', 'aria-hidden': 'true' }), ...toggles.map((t) => {
      const b = el('button', { type: 'button', class: 'chip chip-toggle', 'aria-pressed': String(t.on), text: t.label });
      b.addEventListener('click', () => { t.on = !t.on; render(); });
      return b;
    }));
    const shown = projects.filter((p) => (selected === '전체' || (p.category || '기타') === selected) &&
      toggles.every((t) => !t.on || p[t.key]));
    count.textContent = '결과물 ' + shown.length + '개';
    if (shown.length === 0) {
      board.replaceChildren(el('div', { class: 'empty' }, [
        el('p', { text: projects.length === 0 ? '아직 올라온 결과물이 없어요. 첫 번째로 올려 보세요.' : (toggles.some((t) => t.on) ? '조건에 맞는 결과물이 아직 없어요.' : '이 분류에는 아직 결과물이 없어요.') }),
        el('a', { class: 'btn btn-primary', href: 'submit.html', text: '내 결과물 올리기' })
      ]));
      return;
    }
    board.replaceChildren(...boardSections({ list: shown, data: data, state: state, rerender: render, idPrefix: 'main' }));
  }

  loadBoard()
    .then((b) => {
      data = b.data;
      projects = b.projects.filter((p) => !p.private); // 비공개 결과물은 방 화면에서만 보여 준다.
      render();
    })
    .catch((err) => {
      count.textContent = '';
      board.replaceChildren(el('div', { class: 'empty' }, [el('p', { text: err.message + ' 잠시 뒤에 새로고침해 주세요.' })]));
    });
})();
