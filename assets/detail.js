(function () {
  const root = document.getElementById('detail');
  const id = new URLSearchParams(location.search).get('id');
  const M = globalThis.Manager;
  let data = { groups: [], votes: {}, valueEvents: [], likes: {}, views: {} };

  function section(title, body) {
    return el('section', {}, [el('h2', { text: title }), body]);
  }

  function notFound(message) {
    root.replaceChildren(
      el('div', { class: 'empty' }, [
        el('p', { text: message }),
        el('a', { class: 'btn btn-primary', href: 'index.html', text: '목록으로 돌아가기' })
      ])
    );
  }

  // GitHub 계정으로 로그인해서 남기는 피드백 창 (utterances). 글은 저장소의 Issues 에 쌓인다.
  function feedbackSection(p) {
    const config = globalThis.SITE_CONFIG || {};
    const box = el('section', { class: 'feedback', id: 'feedback' }, [el('h2', { text: '피드백' })]);
    if (!config.feedbackRepo) {
      box.append(el('div', { class: 'notice', text: '피드백 기능은 곧 열려요.' }));
      return box;
    }
    box.append(el('p', { class: 'hint', text: 'GitHub 계정으로 로그인하면 피드백을 남길 수 있어요. 아래 "Sign in with GitHub" 버튼을 눌러 주세요.' + (p.private ? ' 비공개 결과물이라도 피드백은 공개 저장소에 남아요.' : '') }));
    const frame = el('div', { class: 'feedback-frame' });
    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('repo', config.feedbackRepo);
    script.setAttribute('issue-term', '피드백 ' + p.id);
    script.setAttribute('theme', 'github-light');
    frame.append(script);
    box.append(frame);
    return box;
  }

  let views = 0;
  function render(p) {
    const G = globalThis.Groups;
    views = G && G.viewsFor ? G.viewsFor(data, String(p.id)) : 0;
    if (G && G.enabled && G.view(String(p.id))) views += 1; // 오늘 처음 연 것이면 바로 1을 더해 보여 준다.
    document.title = p.title + ' · AI개발모임';
    const url = safeUrl(p.url);
    const meta = ['만든 사람 ' + p.author, formatDate(p.createdAt)].filter(Boolean).join(' · ');

    const actions = el('div', { class: 'actions' }, [
      url
        ? el('a', { class: 'btn btn-primary btn-lg', href: url, target: '_blank', rel: 'noopener noreferrer', text: '체험하러 가기' })
        : el('span', { class: 'meta', text: '체험 링크가 올바르지 않아요.' }),
      el('a', { class: 'btn btn-plain btn-lg', href: '#feedback', text: '피드백 남기기' }),
      likeButton(p, data, 'btn btn-plain btn-lg', true)
    ]);

    const panel = el('div', { class: 'panel' });
    if (p.description) panel.append(section('어떤 프로젝트인가요', el('p', { text: p.description })));
    if (Array.isArray(p.howto) && p.howto.length) {
      panel.append(section('이렇게 써 보세요', el('ol', {}, p.howto.map((step) => el('li', { text: step })))));
    }
    if (Array.isArray(p.tools) && p.tools.length) {
      panel.append(section('만드는 데 쓴 것', el('div', { class: 'tools' }, p.tools.map((t) => el('span', { text: t })))));
    }

    const shot = thumbnail(p, 'thumb-lg');
    const valueBox = el('section', { class: 'value-section', id: 'value', 'aria-labelledby': 'value-title' });
    drawValue(valueBox, p);

    root.replaceChildren(
      el('a', { class: 'back', href: 'index.html', text: '‹ 목록으로 돌아가기' }),
      el('section', { class: 'detail-head' }, [
        el('div', { class: 'tag-row' }, [el('span', { class: 'tag', text: p.category || '기타' }), visibilityTag(p)]),
        el('h1', { text: p.title }),
        el('p', { class: 'summary', text: p.summary }),
        el('p', { class: 'meta' }, [document.createTextNode(meta), document.createTextNode(' · 조회 ' + views.toLocaleString('ko-KR'))]),
        actions
      ]),
      shot,
      panel.childNodes.length ? panel : null,
      valueBox,
      feedbackSection(p)
    );
  }

  // ---- 예상 가치: 어떤 프로젝트인가와 피드백 사이 ----
  function drawValue(box, p) {
    const v = M ? M.valueOf(p, data) : { state: 'requested' };
    const head = el('div', { class: 'value-head' }, [el('h2', { id: 'value-title', text: '예상 가치' })]);
    const body = [];
    if (v.state === 'done') {
      body.push(el('div', { class: 'stat-grid' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: '평가 금액' }), el('span', { class: 'stat-value', text: M.won(v.value) })]),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: '개선 시 예상 금액' }), el('span', { class: 'stat-value', text: M.won(v.improved) })])
      ]));
      if (v.memo) body.push(el('p', { class: 'value-memo', text: v.memo }));
      const who = M.isSiteManager(v.by) ? '사이트 매니저' : '방장';
      const when = v.at ? new Date(v.at).toLocaleDateString('ko-KR') + '에 ' : '';
      body.push(el('p', { class: 'hint', text: who + '가 ' + when + '달았어요.' + (v.reanalyzing ? ' 지금 다시 분석하고 있어요.' : '') + ' AI 추정이 섞인 값이라 실제와 크게 다를 수 있어요.' }));
    } else {
      head.append(el('span', { class: 'value-state' + (v.state === 'analyzing' ? ' is-busy' : ''), text: v.state === 'analyzing' ? '분석 중' : '요청 중' }));
      body.push(el('p', { class: 'hint', text: v.state === 'analyzing'
        ? '매니저가 AI로 분석하고 있어요. 끝나면 평가 금액과 개선 시 예상 금액이 여기에 나와요.'
        : '매니저가 AI로 분석해서 평가 금액과 개선 시 예상 금액을 달아 드릴 거예요.' }));
    }
    const tools = M && M.active(p, data) ? managerTools(box, p, v) : null;
    box.replaceChildren(el('div', { class: 'panel value-panel' }, [head].concat(body)), tools);
  }

  // 매니저 모드가 켜져 있고 금액을 달 수 있는 사람에게만 보인다.
  function managerTools(box, p, v) {
    const form = el('form', { class: 'form manager-box', novalidate: '' });
    const keyId = 'mt-key';
    const keyInput = el('input', { id: keyId, type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'sk-ant-로 시작하는 키' });
    keyInput.value = M.storedKey();
    const valueIn = el('input', { id: 'mt-value', type: 'number', min: '0', step: '10000', inputmode: 'numeric' });
    const improvedIn = el('input', { id: 'mt-improved', type: 'number', min: '0', step: '10000', inputmode: 'numeric' });
    const memoIn = el('textarea', { id: 'mt-memo', maxlength: '1800', placeholder: '금액을 이렇게 잡은 이유와 개선하면 좋은 점' });
    if (v.state === 'done') { valueIn.value = v.value; improvedIn.value = v.improved; memoIn.value = v.memo || ''; }
    const status = el('p', { class: 'hint', 'aria-live': 'polite' });
    const error = el('p', { class: 'form-error', role: 'alert', hidden: '' });
    const ai = el('button', { class: 'btn btn-primary', type: 'button', text: 'AI 분석 수락하기' });
    const save = el('button', { class: 'btn btn-plain', type: 'submit', text: '이 금액으로 달기' });

    function fail(message, input) { error.textContent = message; error.hidden = false; if (input) input.focus(); }

    ai.addEventListener('click', async () => {
      error.hidden = true;
      const key = keyInput.value.trim();
      if (!key) return fail('Anthropic API 키를 넣어 주세요. 내 정보 화면에서 기억해 둘 수도 있어요.', keyInput);
      ai.disabled = true;
      save.disabled = true;
      ai.textContent = '분석하는 중 (1분쯤 걸려요)';
      status.textContent = '다른 사람에게는 "분석 중"으로 보여요.';
      M.send('분석 시작', p).catch(() => {});
      try {
        const r = await M.analyze(key, p);
        valueIn.value = r.value;
        improvedIn.value = r.improved;
        memoIn.value = r.memo;
        status.textContent = 'AI가 채운 내용을 확인하고, 필요하면 고친 뒤 "이 금액으로 달기"를 눌러 주세요.';
        valueIn.focus();
      } catch (err) {
        M.send('분석 취소', p).catch(() => {});
        status.textContent = '';
        fail(err.message);
      } finally {
        ai.disabled = false;
        save.disabled = false;
        ai.textContent = 'AI 분석 수락하기';
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      const value = Number(valueIn.value);
      const improved = Number(improvedIn.value);
      if (valueIn.value.trim() === '' || !Number.isFinite(value) || value < 0) return fail('평가 금액을 0 이상의 숫자로 적어 주세요.', valueIn);
      if (improvedIn.value.trim() === '' || !Number.isFinite(improved) || improved < 0) return fail('개선 시 예상 금액을 0 이상의 숫자로 적어 주세요.', improvedIn);
      save.disabled = true;
      save.textContent = '보내는 중';
      const ev = { value: String(Math.round(value)), improved: String(Math.round(improved)), memo: memoIn.value.trim().slice(0, 1800) };
      try {
        await M.send('가치 평가', p, ev);
        const me = globalThis.Account.current();
        M.addLocal(data, { kind: '가치 평가', target: String(p.id), by: me.owner, value: Math.round(value), improved: Math.round(improved), memo: ev.memo });
        drawValue(box, p);
        const note = box.querySelector('.value-panel .hint');
        if (note) note.textContent = '금액을 달았어요. 다른 사람에게는 몇 분 뒤에 보여요.';
      } catch (err) {
        save.disabled = false;
        save.textContent = '이 금액으로 달기';
        fail('보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
      }
    });

    form.append(
      el('h2', { class: 'section-title', text: '매니저 도구' }),
      el('p', { class: 'hint', text: '매니저 모드가 켜져 있어서 보여요. AI 분석은 내 API 키로 해요. 끄려면 내 정보 화면에서 매니저 모드를 꺼 주세요.' }),
      el('div', { class: 'field' }, [el('label', { for: keyId, text: '내 Anthropic API 키' }), keyInput]),
      el('div', { class: 'form-actions form-actions-start' }, [ai]),
      status,
      el('div', { class: 'field-row' }, [
        el('div', { class: 'field' }, [el('label', { for: 'mt-value', text: '평가 금액 (원)' }), valueIn]),
        el('div', { class: 'field' }, [el('label', { for: 'mt-improved', text: '개선 시 예상 금액 (원)' }), improvedIn])
      ]),
      el('div', { class: 'field' }, [el('label', { for: 'mt-memo', text: '메모' }), memoIn]),
      error,
      el('div', { class: 'form-actions' }, [save])
    );
    return form;
  }

  if (!id) { notFound('어떤 결과물인지 알 수 없어요.'); return; }
  // 비공개 결과물은 그 그룹에 들어간 사람에게만 보여 준다. (공개 시트에는 남아 있어서 완전히 숨겨지지는 않는다.)
  function locked(p) {
    root.replaceChildren(
      el('div', { class: 'empty' }, [
        el('p', { text: '그룹 멤버에게만 공개된 결과물이에요. 그룹 비밀번호를 알고 있다면 그룹에 들어간 뒤 다시 열어 주세요.' }),
        el('a', { class: 'btn btn-primary', href: 'group.html?g=' + encodeURIComponent(p.group), text: '그룹에 들어가기' })
      ])
    );
  }

  function canSee(p) {
    if (!p.private) return true;
    const G = globalThis.Groups;
    return Boolean(G && G.isMember(p.group, data));
  }

  loadBoard()
    .then((board) => {
      data = board.data;
      const p = board.projects.find((item) => String(item.id) === id);
      if (!p) { notFound('찾는 결과물이 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.'); return; }
      if (canSee(p)) render(p); else locked(p);
    })
    .catch((err) => notFound(err.message));
})();
