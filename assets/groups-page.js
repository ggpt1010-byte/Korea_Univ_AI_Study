// 그룹 들어가기 화면: 방 목록(#1부터), 방 만들기.
// 방을 누르면 그 방 화면으로 가고, 아직 안 들어간 방이면 거기서 비밀번호를 묻는다.
(function () {
  const G = globalThis.Groups;
  const config = globalThis.SITE_CONFIG || {};
  const account = globalThis.Account;
  const closed = document.getElementById('closed');
  const open = document.getElementById('open');
  if (!G.enabled) { closed.hidden = false; return; }
  open.hidden = false;

  const listBox = document.getElementById('list');
  const makeOpen = document.getElementById('make-open');
  const makeForm = document.getElementById('make-form');
  const makeError = document.getElementById('make-error');
  const makeSend = document.getElementById('make-send');
  const makeLogin = document.getElementById('make-login');
  let data = { groups: [], votes: {}, valueEvents: [] };
  let loginDrawn = false;

  function groupLink(id) { return 'group.html?g=' + encodeURIComponent(id); }

  // 맨 위에 둘 방(config.featuredGroup)을 먼저, 나머지는 만든 순서대로. 방금 만든 내 방은 끝에 붙인다.
  function ordered() {
    const featured = String(config.featuredGroup || '').trim();
    const list = data.groups.slice();
    const at = featured ? list.findIndex((g) => g.name === featured) : -1;
    if (at > 0) list.unshift(list.splice(at, 1)[0]);
    const mine = G.memberships();
    Object.keys(mine).forEach((id) => {
      if (!list.some((g) => g.id === id) && G.isMember(id, data)) list.push({ id: id, name: mine[id].name, intro: '', pending: true });
    });
    return list;
  }

  function renderList() {
    const list = ordered();
    if (!list.length) {
      listBox.replaceChildren(el('li', { class: 'empty' }, [el('p', { text: '아직 만들어진 방이 없어요. 위의 "방 만들기"로 첫 방을 만들어 보세요.' })]));
      return;
    }
    listBox.replaceChildren(...list.map((g, i) => {
      const member = G.isMember(g.id, data);
      const me = account && account.current();
      const state = el('span', { class: 'group-state' + (member ? ' is-in' : '') });
      state.innerHTML = member ? '' : ICONS.lock;
      state.append(document.createTextNode(member ? '들어간 방' : '비밀번호'));
      return el('li', {}, [el('a', { class: 'group-item group-row', href: groupLink(g.id) }, [
        el('span', { class: 'group-num', text: '#' + (i + 1) }),
        el('span', { class: 'group-main' }, [
          el('span', { class: 'group-name', text: g.name }),
          el('span', { class: 'hint', text: g.pending ? '방금 만든 방이에요. 다른 사람에게는 몇 분 뒤에 보여요.' : (g.intro || '') }),
          me && g.owner === me.owner ? el('span', { class: 'group-owner', text: '내가 방장' }) : null
        ]),
        state
      ])]);
    }));
  }

  function fail(box, message, input) {
    box.textContent = message;
    box.hidden = false;
    if (input) input.focus();
  }

  function refresh(force) {
    return G.load(force).then((d) => { data = d; }).catch((err) => {
      listBox.replaceChildren(el('li', { class: 'empty' }, [el('p', { text: err.message + ' 잠시 뒤에 새로고침해 주세요.' })]));
      throw err;
    }).then(renderList, () => {});
  }

  // ---- 방 만들기 ----
  function syncLogin() {
    const me = account && account.current();
    makeLogin.hidden = Boolean(me);
    makeSend.disabled = !me;
    if (!me && account && account.enabled && !loginDrawn) {
      loginDrawn = true;
      account.renderButton(document.getElementById('make-google'), 240);
    }
  }
  if (account && account.enabled) {
    makeOpen.hidden = false;
    account.onChange(() => { loginDrawn = false; syncLogin(); renderList(); });
  }
  function toggleMake(show) {
    makeForm.hidden = !show;
    makeOpen.setAttribute('aria-expanded', String(show));
    if (show) { syncLogin(); document.getElementById('make-title').focus(); }
  }
  makeOpen.addEventListener('click', () => toggleMake(makeForm.hidden));
  document.getElementById('make-cancel').addEventListener('click', () => { toggleMake(false); makeOpen.focus(); });

  makeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    makeError.hidden = true;
    const me = account && account.current();
    if (!me) return fail(makeError, '먼저 구글로 로그인해 주세요.');
    const f = makeForm.elements;
    const name = f.name.value.trim().replace(/\s+/g, ' ');
    const intro = f.intro.value.trim();
    if (!name) return fail(makeError, '방 이름을 적어 주세요.', f.name);
    if (f.pass.value.length < 6) return fail(makeError, '비밀번호는 6자 이상으로 정해 주세요.', f.pass);
    if (f.pass.value !== f.pass2.value) return fail(makeError, '두 비밀번호가 서로 달라요.', f.pass2);
    makeSend.disabled = true;
    makeSend.textContent = '만드는 중';
    try {
      // 같은 이름의 방이 이미 있는지 시트를 새로 읽어 확인한다.
      await refresh(true);
      const id = SheetData.groupKey(name);
      if (data.groups.some((g) => g.id === id)) return fail(makeError, '같은 이름의 방이 이미 있어요. 다른 이름을 적어 주세요.', f.name);
      await G.createGroup(name, intro, f.pass.value, me.owner);
      location.href = groupLink(id);
    } catch (err) {
      fail(makeError, '방을 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      makeSend.disabled = false;
      makeSend.textContent = '방 만들기';
    }
  });

  refresh(false);
})();
