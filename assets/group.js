// 방 화면: 이 방의 비공개 결과물과 모임 전체 공개 결과물을 함께 보고, 서로 검증한다.
(function () {
  const G = globalThis.Groups;
  const root = document.getElementById('room');
  const id = new URLSearchParams(location.search).get('g') || '';
  let data = { groups: [], votes: {}, valueEvents: [] };
  let projects = [];
  let filter = '전체';

  function message(text, linkText, href) {
    root.replaceChildren(el('div', { class: 'empty' }, [
      el('p', { text: text }),
      el('a', { class: 'btn btn-primary', href: href || 'groups.html', text: linkText || '방 목록으로 가기' })
    ]));
  }

  // 비밀번호를 아직 안 맞힌 사람에게 보여 주는 잠금 화면.
  function lockScreen(g) {
    document.title = g.name + ' · 그룹 · AI개발모임';
    const form = el('form', { class: 'form', novalidate: '' });
    const error = el('p', { class: 'form-error', role: 'alert', hidden: '' });
    const input = el('input', { id: 'room-pass', type: 'password', autocomplete: 'current-password', maxlength: '100' });
    const send = el('button', { class: 'btn btn-primary', type: 'submit', text: '들어가기' });
    form.append(
      el('div', { class: 'field' }, [el('label', { for: 'room-pass', text: '비밀번호' }), input]),
      error,
      el('div', { class: 'form-actions' }, [send])
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      if (!input.value) { error.textContent = '비밀번호를 적어 주세요.'; error.hidden = false; input.focus(); return; }
      send.disabled = true;
      const key = await G.passKey(g.id, input.value);
      send.disabled = false;
      if (key !== g.pass) { error.textContent = '비밀번호가 맞지 않아요.'; error.hidden = false; input.focus(); return; }
      G.join(g.id, g.name, key);
      render();
    });
    root.replaceChildren(el('div', { class: 'page-narrow-inner stack' }, [
      el('a', { class: 'back', href: 'groups.html', text: '‹ 방 목록으로' }),
      el('section', { class: 'page-head' }, [
        el('h1', { text: g.name }),
        el('p', { text: (g.intro ? g.intro + ' ' : '') + '이 방은 비밀번호를 아는 사람만 들어갈 수 있어요.' })
      ]),
      form
    ]));
    input.focus();
  }

  function verifyBox(p) {
    const box = el('div', { class: 'verify' });
    function draw() {
      const voters = G.votersFor(data, id, p.id);
      const mine = voters.indexOf(G.voterId()) !== -1;
      const done = voters.length >= G.goal;
      const button = el('button', {
        type: 'button', class: 'btn btn-sm ' + (mine ? 'btn-primary' : 'btn-plain'), 'aria-pressed': String(mine),
        text: mine ? '검증했어요' : '검증하기'
      });
      button.addEventListener('click', () => {
        button.disabled = true;
        G.vote(id, p.id, !mine).catch(() => {}).then(() => { draw(); });
      });
      box.replaceChildren(
        done
          ? el('span', { class: 'badge-verified', text: '✓ 검증됨 ' + voters.length + '명' })
          : el('span', { class: 'verify-count', text: '검증 ' + voters.length + ' / ' + G.goal }),
        button
      );
    }
    draw();
    return box;
  }

  function grid(list, emptyText) {
    if (!list.length) return el('div', { class: 'empty' }, [el('p', { text: emptyText })]);
    return el('div', { class: 'grid' }, list.map((p) => projectCard(p, verifyBox(p), data)));
  }

  function isVerified(p) { return G.votersFor(data, id, p.id).length >= G.goal; }

  // 방 화면: 큰 제목과 설명, 그 아래 비공개 결과물(이 방 멤버만), 그다음 공개 결과물. 둘 다 최신순.
  function room(g) {
    document.title = g.name + ' · 그룹 · AI개발모임';
    const pick = (list) => filter === '검증됨' ? list.filter(isVerified) : list;
    const hidden = pick(projects.filter((p) => p.private && p.group === id));
    const open = pick(projects.filter((p) => !p.private));

    const chips = el('div', { class: 'chips', role: 'group', 'aria-label': '걸러 보기' }, ['전체', '검증됨'].map((c) => {
      const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c === filter), text: c });
      b.addEventListener('click', () => { filter = c; room(g); });
      return b;
    }));
    const leave = el('button', { type: 'button', class: 'btn btn-plain', text: '이 브라우저에서 방 나가기' });
    leave.addEventListener('click', () => { G.leave(id); location.href = 'groups.html'; });

    function sectionTitle(icon, label, count, idName) {
      const h = el('h2', { class: 'section-title section-icon', id: idName });
      h.innerHTML = ICONS[icon];
      h.append(document.createTextNode(label + ' ' + count + '개'));
      return h;
    }

    const me = globalThis.Account && Account.current();
    root.replaceChildren(
      el('a', { class: 'back', href: 'groups.html', text: '‹ 방 목록으로' }),
      el('section', { class: 'room-head' }, [
        el('h1', { text: g.name }),
        el('p', { text: g.intro || '멤버끼리 결과물을 나누고, 괜찮은 결과물은 검증해 주세요.' }),
        g.pending ? el('p', { class: 'hint', text: '방금 만든 방이에요. 다른 멤버에게는 몇 분 뒤부터 보여요.' }) : null,
        me && g.owner && g.owner === me.owner ? el('p', { class: 'hint', text: '내가 방장인 방이에요. 내 정보 화면에서 매니저 모드를 켜면 이 방 결과물에 예상 가치를 달 수 있어요.' }) : null,
        el('div', { class: 'actions' }, [
          el('a', { class: 'btn btn-primary', href: 'submit.html?group=' + encodeURIComponent(id), text: '이 방에 결과물 올리기' }),
          leave
        ])
      ]),
      el('p', { class: 'hint', text: '멤버 ' + G.goal + '명이 검증하면 "검증됨" 표시가 붙어요. 검증은 이 방 안에서만 세요. 비공개 결과물은 이 사이트에서 방 멤버에게만 보이지만, 공개 시트에는 남아 있어서 완전히 숨겨지지는 않아요.' }),
      el('div', { class: 'toolbar' }, [chips]),
      el('section', { class: 'list-section', 'aria-labelledby': 'own-title' }, [
        sectionTitle('lock', '비공개 결과물', hidden.length, 'own-title'),
        grid(hidden, filter === '검증됨' ? '아직 검증된 비공개 결과물이 없어요.' : '아직 이 방에 올라온 비공개 결과물이 없어요.')
      ]),
      el('section', { class: 'list-section', 'aria-labelledby': 'open-title' }, [
        sectionTitle('globe', '공개 결과물', open.length, 'open-title'),
        grid(open, filter === '검증됨' ? '아직 이 방에서 검증한 공개 결과물이 없어요.' : '아직 공개 결과물이 없어요.')
      ])
    );
  }

  function render() {
    const g = data.groups.find((x) => x.id === id);
    const local = G.memberships()[id];
    if (!g && !local) return message('찾는 방이 없어요. 방금 만든 방이라면 몇 분 뒤에 다시 열어 주세요.');
    if (!G.isMember(id, data)) return lockScreen(g);
    room(g || { id: id, name: local.name, intro: '', pending: true });
  }

  if (!G.enabled) { message('그룹 기능은 곧 열려요.', '목록으로 돌아가기', 'index.html'); return; }
  if (!/^k[0-9a-f]{8}$/.test(id)) { message('어떤 방인지 알 수 없어요.'); return; }
  Promise.all([G.load(), loadProjects()])
    .then(([d, list]) => { data = d; projects = list; render(); })
    .catch((err) => message(err.message + ' 잠시 뒤에 새로고침해 주세요.'));
})();
