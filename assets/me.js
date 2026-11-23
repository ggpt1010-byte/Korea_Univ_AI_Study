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
  let data = null;      // 그룹 기록 (방장 여부, 평가 금액)
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
      grid.replaceChildren(...mine.map((p) => projectCard(p, null, data)));
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
    document.getElementById('me-owner').textContent = me.owner;
    if (all) { showList(me); showManager(me); return; }
    count.textContent = '불러오는 중';
    loadBoard()
      .then((board) => {
        all = board.projects;
        data = board.data;
        const now = account.current();
        if (now) { showList(now); showManager(now); }
      })
      .catch((err) => {
        count.textContent = '';
        grid.style.display = 'block';
        grid.replaceChildren(el('div', { class: 'empty' }, [el('p', { text: err.message + ' 잠시 뒤에 새로고침해 주세요.' })]));
      });
  }

  // ---- 매니저 모드: 사이트 매니저이거나 방장인 사람에게만 보인다 ----
  const M = globalThis.Manager;
  const mgr = document.getElementById('mgr');
  const sw = document.getElementById('mgr-switch');
  const swLabel = document.getElementById('mgr-switch-label');
  const keyInput = document.getElementById('mgr-key');
  const remember = document.getElementById('mgr-remember');
  const keyStatus = document.getElementById('mgr-key-status');

  function drawSwitch() {
    const on = M.modeOn();
    sw.setAttribute('aria-checked', String(on));
    swLabel.textContent = on ? '켜짐' : '꺼짐';
    document.getElementById('mgr-key-box').hidden = !on;
  }

  function showManager(me) {
    if (!M || !M.isManager(me.owner, data)) { mgr.hidden = true; return; }
    const roles = [];
    if (M.isSiteManager(me.owner)) roles.push('사이트 매니저예요. 모든 공개 결과물에 금액을 달 수 있어요.');
    const owned = M.ownedGroups(me.owner, data).map((g) => g.name);
    if (owned.length) roles.push('방장인 방: ' + owned.join(', ') + '. 이 방에 올라온 결과물에 금액을 달 수 있어요.');
    document.getElementById('mgr-role').textContent = roles.join(' ');
    mgr.hidden = false;
    drawSwitch();
  }

  if (M) {
    sw.addEventListener('click', () => { M.setMode(!M.modeOn()); drawSwitch(); });
    const saved = M.storedKey();
    if (saved) { keyInput.value = saved; remember.checked = true; keyStatus.textContent = '이 브라우저에 저장한 키를 쓰고 있어요.'; }
    remember.addEventListener('change', () => {
      const value = keyInput.value.trim();
      M.storeKey(remember.checked ? value : '');
      keyStatus.textContent = remember.checked
        ? (value ? '이 브라우저에 키를 저장했어요.' : '키를 넣으면 이 브라우저에 저장해요.')
        : '키를 저장하지 않아요. 결과물 화면에서 분석할 때마다 키를 넣어 주세요.';
    });
    keyInput.addEventListener('change', () => { if (remember.checked) M.storeKey(keyInput.value.trim()); });
    document.getElementById('mgr-forget').addEventListener('click', () => {
      M.storeKey('');
      keyInput.value = '';
      remember.checked = false;
      keyStatus.textContent = '저장한 키를 지웠어요.';
    });
  }

  account.onChange(render);
  render(account.current());
})();
