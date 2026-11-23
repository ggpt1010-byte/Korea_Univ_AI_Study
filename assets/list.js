(function () {
  const chipsBox = document.getElementById('chips');
  const grid = document.getElementById('grid');
  const count = document.getElementById('count');
  let projects = [];
  let selected = '전체';

  function render() {
    chipsBox.replaceChildren(...CATEGORIES.map((c) => {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c === selected), text: c });
      b.addEventListener('click', () => { selected = c; render(); });
      return b;
    }));
    const shown = projects.filter((p) => selected === '전체' || (p.category || '기타') === selected);
    count.textContent = '결과물 ' + shown.length + '개';
    if (shown.length === 0) {
      const empty = el('div', { class: 'empty' }, [
        el('p', { text: projects.length === 0 ? '아직 올라온 결과물이 없어요. 첫 번째로 올려 보세요.' : '이 분류에는 아직 결과물이 없어요.' }),
        el('a', { class: 'btn btn-primary', href: 'submit.html', text: '내 결과물 올리기' })
      ]);
      grid.replaceChildren(empty);
      grid.style.display = 'block';
    } else {
      grid.style.display = '';
      grid.replaceChildren(...shown.map(projectCard));
    }
  }

  loadProjects()
    .then((list) => {
      projects = list.filter((p) => !p.private); // 비공개 결과물은 그룹 화면에서만 보여 준다.
      render();
    })
    .catch((err) => {
      count.textContent = '';
      grid.style.display = 'block';
      grid.replaceChildren(el('div', { class: 'empty' }, [el('p', { text: err.message + ' 잠시 뒤에 새로고침해 주세요.' })]));
    });
})();
