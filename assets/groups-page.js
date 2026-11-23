// 그룹 화면: 내 그룹, 그룹 들어가기, 새 그룹 만들기.
(function () {
  const G = globalThis.Groups;
  const closed = document.getElementById('closed');
  const open = document.getElementById('open');
  if (!G.enabled) { closed.hidden = false; return; }
  open.hidden = false;

  const mineBox = document.getElementById('mine');
  const enterForm = document.getElementById('enter-form');
  const enterError = document.getElementById('enter-error');
  const enterSend = document.getElementById('enter-send');
  const makeForm = document.getElementById('make-form');
  const makeError = document.getElementById('make-error');
  const makeSend = document.getElementById('make-send');
  let data = { groups: [], votes: {} };

  function groupLink(id) { return 'group.html?g=' + encodeURIComponent(id); }

  function renderMine() {
    const mine = G.myGroups(data);
    if (!mine.length) {
      mineBox.replaceChildren(el('p', { class: 'hint', text: '아직 들어간 그룹이 없어요. 아래에서 그룹에 들어가거나 새로 만들어 보세요.' }));
      return;
    }
    mineBox.replaceChildren(...mine.map((g) => el('a', { class: 'group-item', href: groupLink(g.id) }, [
      el('span', { class: 'group-name', text: g.name }),
      el('span', { class: 'hint', text: g.pending ? '방금 만든 그룹이에요. 다른 사람에게는 몇 분 뒤에 보여요.' : (g.intro || '그룹으로 가기') })
    ])));
  }

  function renderSelect() {
    const select = enterForm.elements.group;
    const list = data.groups.filter((g) => !G.isMember(g.id, data));
    if (!list.length) {
      select.replaceChildren(el('option', { value: '', text: '들어갈 수 있는 그룹이 아직 없어요' }));
      select.disabled = true;
      enterSend.disabled = true;
      return;
    }
    select.disabled = false;
    enterSend.disabled = false;
    select.replaceChildren(...list.map((g) => el('option', { value: g.id, text: g.name })));
    const wanted = new URLSearchParams(location.search).get('g');
    if (wanted && list.some((g) => g.id === wanted)) select.value = wanted;
  }

  function fail(box, message, input) {
    box.textContent = message;
    box.hidden = false;
    if (input) input.focus();
  }

  function refresh(force) {
    return G.load(force).then((d) => { data = d; }).catch((err) => {
      fail(enterError, err.message + ' 잠시 뒤에 새로고침해 주세요.');
    }).then(() => { renderMine(); renderSelect(); });
  }

  enterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    enterError.hidden = true;
    const g = data.groups.find((x) => x.id === enterForm.elements.group.value);
    const pass = enterForm.elements.pass.value;
    if (!g) return fail(enterError, '들어갈 그룹을 골라 주세요.', enterForm.elements.group);
    if (!pass) return fail(enterError, '비밀번호를 적어 주세요.', enterForm.elements.pass);
    enterSend.disabled = true;
    enterSend.textContent = '확인하는 중';
    try {
      const key = await G.passKey(g.id, pass);
      if (key !== g.pass) return fail(enterError, '비밀번호가 맞지 않아요.', enterForm.elements.pass);
      G.join(g.id, g.name, key);
      location.href = groupLink(g.id);
    } finally {
      enterSend.disabled = false;
      enterSend.textContent = '들어가기';
    }
  });

  makeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    makeError.hidden = true;
    const f = makeForm.elements;
    const name = f.name.value.trim().replace(/\s+/g, ' ');
    const intro = f.intro.value.trim();
    if (!name) return fail(makeError, '그룹 이름을 적어 주세요.', f.name);
    if (f.pass.value.length < 6) return fail(makeError, '비밀번호는 6자 이상으로 정해 주세요.', f.pass);
    if (f.pass.value !== f.pass2.value) return fail(makeError, '두 비밀번호가 서로 달라요.', f.pass2);
    makeSend.disabled = true;
    makeSend.textContent = '만드는 중';
    try {
      // 같은 이름의 그룹이 이미 있는지 시트를 새로 읽어 확인한다.
      await refresh(true);
      const id = SheetData.groupKey(name);
      if (data.groups.some((g) => g.id === id)) return fail(makeError, '같은 이름의 그룹이 이미 있어요. 다른 이름을 적어 주세요.', f.name);
      await G.createGroup(name, intro, f.pass.value);
      location.href = groupLink(id);
    } catch (err) {
      fail(makeError, '그룹을 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      makeSend.disabled = false;
      makeSend.textContent = '그룹 만들기';
    }
  });

  refresh(false);
})();
