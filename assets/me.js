// 내 정보 화면: 로그인한 계정으로 올린 결과물만 모아 보여 준다.
(function () {
  const account = globalThis.Account;
  const off = document.getElementById('me-off');
  const out = document.getElementById('me-out');
  const inside = document.getElementById('me-in');
  const lead = document.getElementById('me-lead');
  const grid = document.getElementById('me-grid');
  const count = document.getElementById('me-count');
  let all = null;       // 불러온 결과물 목록 (한 번만 불러온다)
  let drawn = false;    // 로그인 버튼을 이미 그렸는지

  if (!account || !account.enabled) { off.hidden = false; lead.hidden = true; return; }

  document.getElementById('me-logout').addEventListener('click', () => account.signOut());

  function showList(me) {
    const mine = all.filter((p) => p.owner && p.owner === me.owner);
    count.textContent = '결과물 ' + mine.length + '개';
    if (mine.length === 0) {
      grid.style.display = 'block';
      grid.replaceChildren(el('div', { class: 'empty' }, [
        el('p', { text: '아직 이 계정으로 올린 결과물이 없어요.' }),
        el('a', { class: 'btn btn-primary', href: 'submit.html', text: '내 결과물 올리기' })
      ]));
    } else {
      grid.style.display = '';
      grid.replaceChildren(...mine.map(projectCard));
    }
  }

  function render(me) {
    out.hidden = Boolean(me);
    inside.hidden = !me;
    lead.hidden = Boolean(me);
    if (!me) {
      if (!drawn) { drawn = true; account.renderButton(document.getElementById('me-google'), 260); }
      return;
    }
    drawn = false;
    document.getElementById('me-name').textContent = me.name + ' 님';
    document.getElementById('me-initial').textContent = Array.from(me.name)[0] || '?';
    if (all) { showList(me); return; }
    count.textContent = '불러오는 중';
    loadProjects()
      .then((list) => { all = list; const now = account.current(); if (now) showList(now); })
      .catch((err) => {
        count.textContent = '';
        grid.style.display = 'block';
        grid.replaceChildren(el('div', { class: 'empty' }, [el('p', { text: err.message + ' 잠시 뒤에 새로고침해 주세요.' })]));
      });
  }

  account.onChange(render);
  render(account.current());
})();
