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

  function isOwner(p) {
    const me = globalThis.Account && Account.current();
    return Boolean(me && p.owner && me.owner === p.owner && /^s[0-9a-f]{8}$/.test(String(p.id)));
  }

  // 평가 한 건: 누가(매니저/AI), 언제, 금액 두 개, 코멘트와 개선점.
  function evalItem(ev) {
    const who = M.isSiteManager(ev.by, data) ? '사이트 매니저' : '방장';
    const when = ev.at ? new Date(ev.at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    return el('div', { class: 'eval-item' }, [
      el('div', { class: 'eval-top' }, [
        el('span', { class: 'tag ' + (ev.kind === 'AI 평가' ? 'tag-ai' : 'tag-final'), text: ev.kind === 'AI 평가' ? 'AI 평가' : '매니저 확정' }),
        el('span', { class: 'hint', text: [who, when].filter(Boolean).join(' · ') })
      ]),
      el('p', {}, [el('strong', { text: M.won(ev.value) }), document.createTextNode(' · 개선 시 '), el('strong', { text: M.won(ev.improved) })]),
      ev.memo ? el('p', { class: 'value-memo', text: ev.memo }) : null
    ]);
  }

  // 버전별 평가 기록: 최신 버전이 위. 버전마다 마지막 평가를 펼쳐 두고, 이전 평가는 접어 둔다.
  function versionSection(p) {
    const versions = Array.isArray(p.versions) && p.versions.length ? p.versions : [{ v: 1, id: String(p.valueId || p.id), url: p.url, changes: '', createdAt: p.createdAt }];
    const many = versions.length > 1;
    const C = globalThis.Collab;
    const collab = data.collab;
    // 버전마다 지금 평가 금액(매니저 확정, 없으면 AI). 바로 앞 버전과 비교해 오르내린 금액을 보여 준다.
    const priceOf = (v) => {
      const x = M ? M.valueOf(Object.assign({}, p, { valueId: v.id }), data) : { state: 'requested' };
      return x.state === 'done' ? Number(x.value) : null;
    };
    const items = versions.slice().reverse().map((v) => {
      const list = M ? M.history(p, data, v.id) : [];
      const url = safeUrl(v.url);
      const val = M ? M.valueOf(Object.assign({}, p, { valueId: v.id }), data) : { state: 'requested' };
      const evals = list.length
        ? [evalItem(list[0])].concat(list.length > 1 ? [el('details', { class: 'eval-older' }, [
            el('summary', { text: '이전 평가 ' + (list.length - 1) + '개 보기' })
          ].concat(list.slice(1).map(evalItem)))] : [])
        : [el('p', { class: 'hint', text: val.state === 'analyzing' ? '분석 중이에요.' : '아직 평가가 없어요.' })];
      return el('li', { class: 'version-item' }, [
        el('div', { class: 'version-top' }, [
          el('strong', { text: 'v' + v.v + (v.v === p.version || !many ? ' (지금 버전)' : '') }),
          el('span', { class: 'hint' }, [
            document.createTextNode(formatDate(v.createdAt)),
            many && url ? document.createTextNode(' · ') : null,
            many && url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: '이 버전 체험 링크' }) : null
          ].filter(Boolean))
        ]),
        many ? (v.changes ? el('p', { text: v.changes }) : (v.v === 1 ? el('p', { text: '처음 올린 버전이에요.' }) : null)) : null,
        creditLine(v, versions, priceOf, C, collab)
      ].concat(evals));
    });
    return el('section', { class: 'panel', id: 'history' }, [
      el('h2', { text: many ? '버전별 평가 기록' : '평가 기록' }),
      el('ol', { class: 'version-list' }, items)
    ]);
  }
  // 버전 하나의 "같이 만든 기록": 앞 버전보다 오른 금액, 반영한 아이디어, 도와준 사람.
  function creditLine(v, versions, priceOf, C, collab) {
    const parts = [];
    const prev = versions[versions.indexOf(v) - 1];
    if (prev) {
      const a = priceOf(prev);
      const b = priceOf(v);
      if (a !== null && b !== null) {
        const diff = b - a;
        parts.push(el('p', { class: 'value-change' + (diff > 0 ? ' is-up' : diff < 0 ? ' is-down' : '') }, [
          document.createTextNode('v' + prev.v + ' ' + M.won(a) + ' → v' + v.v + ' ' + M.won(b) + ' '),
          el('strong', { text: diff === 0 ? '(변화 없음)' : '(' + (diff > 0 ? '+' : '−') + M.won(Math.abs(diff)) + ')' })
        ]));
      }
    }
    if (C && collab && collab.ready) {
      const done = collab.ideas.filter((i) => i.doneVersion === String(v.id));
      if (done.length) parts.push(el('p', { class: 'hint', text: '반영한 아이디어: ' + done.map((i) => i.body).join(' / ') }));
      const people = C.contributorsFor(collab, v.id);
      if (people.length) {
        parts.push(el('p', { class: 'credit-people' }, [
          el('span', { class: 'tag tag-seeking', text: '기여 ' + people.length + '명' }),
          document.createTextNode(' ' + people.map((x) => x.name).join(', '))
        ]));
      }
    }
    return parts.length ? el('div', { class: 'credit-line' }, parts) : null;
  }

  // 평가를 새로 남긴 뒤 기록 칸을 다시 그린다.
  function refreshHistory(p) {
    const old = root.querySelector('#history');
    if (old) old.replaceWith(versionSection(p));
  }

  let views = 0;
  function render(p) {
    const G = globalThis.Groups;
    views = G && G.viewsFor ? G.viewsFor(data, String(p.id)) : 0;
    if (G && G.enabled && G.view(String(p.id))) views += 1; // 오늘 처음 연 것이면 바로 1을 더해 보여 준다.
    document.title = p.title + ' · AI개발모임';
    const url = safeUrl(p.url);
    const meta = ['만든 사람 ' + p.author, formatDate(p.createdAt), p.version > 1 && p.updatedAt ? 'v' + p.version + ' ' + formatDate(p.updatedAt) : ''].filter(Boolean).join(' · ');

    const actions = el('div', { class: 'actions' }, [
      url
        ? el('a', { class: 'btn btn-primary btn-lg', href: url, target: '_blank', rel: 'noopener noreferrer', text: '체험하러 가기' })
        : el('span', { class: 'meta', text: '체험 링크가 올바르지 않아요.' }),
      el('a', { class: 'btn btn-plain btn-lg', href: '#feedback', text: '피드백 남기기' }),
      likeButton(p, data, 'btn btn-plain btn-lg', true),
      isOwner(p) && globalThis.DB && DB.enabled ? el('a', { class: 'btn btn-plain btn-lg', href: 'submit.html?parent=' + encodeURIComponent(p.id), text: '새 버전 올리기' }) : null
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
        el('div', { class: 'tag-row' }, [
          el('span', { class: 'tag', text: p.category || '기타' }), visibilityTag(p),
          p.version > 1 ? el('span', { class: 'tag tag-version', text: 'v' + p.version }) : null
        ].concat(collabTags(p))),
        el('h1', { text: p.title }),
        el('p', { class: 'summary', text: p.summary }),
        el('p', { class: 'meta' }, [document.createTextNode(meta), document.createTextNode(' · 조회 ' + views.toLocaleString('ko-KR'))]),
        actions
      ]),
      shot,
      panel.childNodes.length ? panel : null,
      valueBox,
      collabSection(p),
      versionSection(p),
      feedbackSection(p)
    );
  }

  // ---- 예상 가치: 어떤 프로젝트인가와 피드백 사이 ----
  function drawValue(box, p) {
    const v = M ? M.valueOf(p, data) : { state: 'requested' };
    const head = el('div', { class: 'value-head' }, [el('h2', { id: 'value-title', text: '예상 가치' })]);
    const body = [];
    if (v.state === 'done') {
      if (v.source === 'ai') head.append(el('span', { class: 'value-state', text: 'AI 평가 · 매니저 확인 전' }));
      body.push(el('div', { class: 'stat-grid' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: '평가 금액' }), el('span', { class: 'stat-value', text: M.won(v.value) })]),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-label', text: '개선 시 예상 금액' }), el('span', { class: 'stat-value', text: M.won(v.improved) })])
      ]));
      if (v.memo) body.push(el('p', { class: 'value-memo', text: v.memo }));
      const who = M.isSiteManager(v.by, data) ? '사이트 매니저' : '방장';
      const when = v.at ? new Date(v.at).toLocaleDateString('ko-KR') + '에 ' : '';
      body.push(el('p', { class: 'hint', text: (v.source === 'ai' ? who + '가 ' + when + 'AI로 분석한 평가예요.' : who + '가 ' + when + '달았어요.') + (v.reanalyzing ? ' 지금 다시 분석하고 있어요.' : '') + ' AI 추정이 섞인 값이라 실제와 크게 다를 수 있어요.' }));
      // 매니저가 금액을 고쳤으면 AI가 처음 낸 평가도 함께 보여 준다.
      if (v.source === 'manager' && v.ai && (v.ai.value !== v.value || v.ai.improved !== v.improved || v.ai.memo !== v.memo)) {
        body.push(el('details', { class: 'ai-eval' }, [
          el('summary', { text: 'AI가 낸 평가 보기: ' + M.won(v.ai.value) + ' · 개선 시 ' + M.won(v.ai.improved) }),
          v.ai.memo ? el('p', { class: 'value-memo', text: v.ai.memo }) : null
        ]));
      }
    } else {
      head.append(el('span', { class: 'value-state' + (v.state === 'analyzing' ? ' is-busy' : ''), text: v.state === 'analyzing' ? '분석 중' : '요청 중' }));
      body.push(el('p', { class: 'hint', text: v.state === 'analyzing'
        ? '매니저가 AI로 분석하고 있어요. 끝나면 평가 금액과 개선 시 예상 금액이 여기에 나와요.'
        : (p.version > 1 ? '새 버전(v' + p.version + ')이 나와서 새로 평가를 기다리고 있어요. 지난 버전의 평가는 아래 버전별 평가 기록에서 볼 수 있어요.' : '매니저가 AI로 분석해서 평가 금액과 개선 시 예상 금액을 달아 드릴 거예요.') }));
    }
    const tools = M && M.active(p, data) ? managerTools(box, p, v) : null;
    box.replaceChildren(...[el("div", { class: "panel value-panel" }, [head].concat(body)), tools].filter(Boolean));
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
        // AI가 낸 평가는 매니저가 고치기 전 그대로 "AI 평가"로 남긴다.
        try {
          await M.send('AI 평가', p, { value: r.value, improved: r.improved, memo: r.memo });
          const me = globalThis.Account.current();
          M.addLocal(data, { kind: 'AI 평가', target: String(p.valueId || p.id), by: me.owner, value: r.value, improved: r.improved, memo: r.memo });
          // AI가 뽑은 개선 아이디어를 "같이 개선하기"에 올린다. 실패해도 평가는 이미 남았다.
          if (globalThis.Collab && data.collab && data.collab.ready && r.ideas && r.ideas.length) {
            try { await Collab.addAiIdeas(p.valueId || p.id, r.ideas); await reloadCollab(p); } catch (ideaErr) { /* 아이디어만 못 올림 */ }
          }
          refreshHistory(p);
          drawValue(box, p);
          const note = box.querySelector('.manager-box [aria-live]');
          if (note) note.textContent = 'AI 평가를 남겼어요. 매니저 최종 금액으로 확정하려면 확인하고, 필요하면 고친 뒤 "이 금액으로 달기"를 눌러 주세요.';
          return;
        } catch (saveErr) {
          status.textContent = 'AI 평가를 저장하지 못했어요(' + saveErr.message + '). 내용을 확인하고 "이 금액으로 달기"를 눌러 주세요.';
        }
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
        M.addLocal(data, { kind: '가치 평가', target: String(p.valueId || p.id), by: me.owner, value: Math.round(value), improved: Math.round(improved), memo: ev.memo });
        drawValue(box, p);
        refreshHistory(p);
        const note = box.querySelector('.value-panel .hint');
        if (note) note.textContent = '금액을 달았어요.';
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


  // ---- 같이 개선하기: 예상 가치 아래 ----
  async function reloadCollab(p) {
    try { data.collab = await Collab.load(true); } catch (err) { /* 그대로 둔다 */ }
    const old = root.querySelector('#collab');
    if (old) old.replaceWith(collabSection(p));
    refreshHistory(p);
  }

  function collabSection(p) {
    const C = globalThis.Collab;
    const c = data.collab;
    const box = el('section', { class: 'panel collab', id: 'collab', 'aria-labelledby': 'collab-title' });
    if (!C || !c || !c.ready) return null; // 서버 준비 전에는 칸을 만들지 않는다.
    const me = globalThis.Account && Account.current();
    const owner = isOwner(p);
    const manager = M && me && M.canValue(me.owner, p, data);
    const repo = p.openSource && p.repoUrl && C.REPO_RE.test(p.repoUrl) ? p.repoUrl : '';
    const all = C.ideasFor(c, p.id);
    const versionOf = (vid) => { const v = (p.versions || []).find((x) => x.id === vid); return v ? v.v : null; };

    const head = el('div', { class: 'value-head' }, [el('h2', { id: 'collab-title', text: '같이 개선하기' })]);
    const tags = collabTags(p);
    if (p.openSource && p.license && p.license !== '모름') tags.push(el('span', { class: 'tag', text: p.license }));
    if (tags.length) head.append(el('div', { class: 'tag-row' }, tags));
    box.append(head);
    box.append(el('p', { class: 'hint', text: 'AI 평가에서 나온 개선 아이디어예요. 해 보고 싶은 아이디어에 "나도 해볼래요"를 누르면 만든 사람이 보고 연락해요. 새 버전에 반영되면 기여자로 이름이 남아요.' }));
    if (repo) {
      box.append(el('div', { class: 'actions' }, [
        el('a', { class: 'btn btn-plain btn-sm', href: repo, target: '_blank', rel: 'noopener noreferrer', text: 'GitHub 저장소 보기' })
      ]));
    }

    const error = el('p', { class: 'form-error', role: 'alert', hidden: '' });
    function fail(err) { error.textContent = (err && err.message) || '처리하지 못했어요.'; error.hidden = false; }
    async function run(button, job) {
      error.hidden = true;
      if (button) button.disabled = true;
      try { await job(); await reloadCollab(p); } catch (err) { if (button) button.disabled = false; fail(err); }
    }

    // 열린 아이디어
    const open = all.filter((i) => i.status === '열림');
    const list = el('ul', { class: 'idea-list' });
    open.forEach((i) => list.append(ideaItem(i)));
    box.append(open.length ? list : el('p', { class: 'hint', text: all.length ? '지금 열린 아이디어가 없어요.' : '아직 개선 아이디어가 없어요. 매니저가 AI 평가를 하면 생기고, 아래에서 직접 제안할 수도 있어요.' }));

    function ideaItem(i) {
      const n = C.countFor(c, i.id);
      const mine = C.myJoin(c, i.id);
      const li = el('li', { class: 'idea-item' + (mine ? ' is-joined' : '') });
      li.append(el('div', { class: 'idea-top' }, [
        el('p', { class: 'idea-body', text: i.body }),
        i.gain ? el('span', { class: 'idea-gain', text: '+' + M.won(i.gain) }) : null
      ]));
      li.append(el('p', { class: 'hint', text: [i.source === 'AI' ? 'AI 평가에서 나옴' : i.source === '제안' ? '모임원 제안' : '만든 사람이 적음', '해볼래요 ' + n + '명', mine ? '나도 참여 중' + (mine.note ? ': ' + mine.note : '') : ''].filter(Boolean).join(' · ') }));
      const buttons = el('div', { class: 'actions' });
      if (!me) {
        buttons.append(el('span', { class: 'hint', text: '구글로 로그인하면 참여할 수 있어요.' }));
      } else if (!owner) {
        if (mine) {
          const cancel = el('button', { type: 'button', class: 'btn btn-plain btn-sm', text: '참여 취소' });
          cancel.addEventListener('click', () => run(cancel, () => C.join(i.id, false)));
          buttons.append(cancel);
        } else {
          const join = el('button', { type: 'button', class: 'btn btn-outline btn-sm', text: '나도 해볼래요' });
          join.addEventListener('click', () => {
            join.hidden = true;
            const noteId = 'join-note-' + i.id;
            const note = el('input', { id: noteId, type: 'text', maxlength: '200', placeholder: '예: 프론트엔드 해 봤어요, 주말에 가능해요' });
            const send = el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '참여하기' });
            send.addEventListener('click', () => run(send, () => C.join(i.id, true, note.value.trim())));
            li.append(el('div', { class: 'field join-form' }, [
              el('label', { for: noteId, text: '만든 사람에게 한 줄 (선택, 만든 사람과 나만 봐요)' }), note,
              el('div', { class: 'actions' }, [send])
            ]));
            note.focus();
          });
          buttons.append(join);
        }
      }
      const issue = repo ? C.issueUrl(repo, p, i) : null;
      if (issue) buttons.append(el('a', { class: 'btn btn-plain btn-sm', href: issue, target: '_blank', rel: 'noopener noreferrer', text: 'GitHub 이슈 만들기' }));
      if (owner || manager) {
        const close = el('button', { type: 'button', class: 'btn btn-plain btn-sm', text: '닫기' });
        close.addEventListener('click', () => run(close, () => C.setStatus(i.id, '닫힘')));
        buttons.append(close);
      }
      li.append(buttons);
      // 주인에게만: 참여한 사람과 메모
      const joins = owner ? C.joinsFor(c, i.id) : [];
      if (joins.length) {
        li.append(el('ul', { class: 'join-list' }, joins.map((j) => el('li', {}, [
          el('strong', { text: j.name }), document.createTextNode(j.note ? ' · ' + j.note : '')
        ]))));
      }
      return li;
    }

    // 주인에게만: 승인을 기다리는 제안
    const pending = all.filter((i) => i.status === '제안');
    if (owner && pending.length) {
      box.append(el('h3', { text: '승인을 기다리는 제안 ' + pending.length + '개' }));
      box.append(el('ul', { class: 'idea-list' }, pending.map((i) => {
        const ok = el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '승인' });
        const no = el('button', { type: 'button', class: 'btn btn-plain btn-sm', text: '거절' });
        ok.addEventListener('click', () => run(ok, () => C.setStatus(i.id, '열림')));
        no.addEventListener('click', () => run(no, () => C.setStatus(i.id, '닫힘')));
        return el('li', { class: 'idea-item is-pending' }, [el('p', { class: 'idea-body', text: i.body }), el('div', { class: 'actions' }, [ok, no])]);
      })));
    } else if (!owner && me) {
      const waiting = pending.filter((i) => i.by === me.owner);
      if (waiting.length) box.append(el('p', { class: 'hint', text: '내가 낸 제안 ' + waiting.length + '개가 만든 사람의 승인을 기다리고 있어요.' }));
    }

    // 반영된 아이디어
    const done = all.filter((i) => i.status === '반영');
    if (done.length) {
      box.append(el('details', { class: 'eval-older' }, [el('summary', { text: '반영된 아이디어 ' + done.length + '개' })].concat(done.map((i) =>
        el('p', {}, [el('span', { class: 'tag tag-version', text: versionOf(i.doneVersion) ? 'v' + versionOf(i.doneVersion) + '에 반영' : '반영됨' }), document.createTextNode(' ' + i.body)])
      ))));
    }
    // 주인에게만: 닫은 아이디어 다시 열기
    const closed = all.filter((i) => i.status === '닫힘');
    if ((owner || manager) && closed.length) {
      box.append(el('details', { class: 'eval-older' }, [el('summary', { text: '닫은 아이디어 ' + closed.length + '개' })].concat(closed.map((i) => {
        const reopen = el('button', { type: 'button', class: 'btn btn-plain btn-sm', text: '다시 열기' });
        reopen.addEventListener('click', () => run(reopen, () => C.setStatus(i.id, '열림')));
        return el('div', { class: 'idea-closed' }, [el('span', { text: i.body }), reopen]);
      }))));
    }

    // 아이디어 적기: 주인은 바로 열리고, 다른 사람은 제안(주인 승인 후 보임)
    if (me) {
      const ta = el('textarea', { id: 'idea-new', maxlength: '200', rows: '2', placeholder: '예: 첫 화면에 사용 예시를 보여 주면 더 많이 써 볼 것 같아요' });
      const add = el('button', { type: 'button', class: 'btn btn-plain btn-sm', text: owner ? '아이디어 추가' : '아이디어 제안하기' });
      add.addEventListener('click', () => {
        if (!ta.value.trim()) { fail(new Error('아이디어를 적어 주세요.')); ta.focus(); return; }
        run(add, () => C.propose(p.id, ta.value.trim()));
      });
      box.append(el('div', { class: 'field' }, [
        el('label', { for: 'idea-new', text: owner ? '개선 아이디어 직접 적기' : '개선 아이디어 제안하기 (만든 사람이 승인하면 보여요)' }), ta,
        el('div', { class: 'actions' }, [add])
      ]));
    }

    // 주인에게만: 협업 설정
    if (owner) box.append(settingsForm(p, run));
    box.append(error);
    return box;
  }

  function settingsForm(p, run) {
    const C = globalThis.Collab;
    const openBox = el('input', { type: 'checkbox', id: 'cs-open' });
    openBox.checked = Boolean(p.openSource);
    const repo = el('input', { id: 'cs-repo', type: 'url', maxlength: '200', placeholder: 'https://github.com/아이디/저장소' });
    repo.value = p.repoUrl || '';
    const lic = el('select', { id: 'cs-license' }, C.LICENSES.map((l) => el('option', { value: l, text: l === '모름' ? '아직 모름' : l })));
    lic.value = p.license || '모름';
    const seek = el('input', { type: 'checkbox', id: 'cs-seeking' });
    seek.checked = Boolean(p.seeking);
    const save = el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: '저장' });
    const repoBox = el('div', { class: 'stack-sm' }, [
      el('div', { class: 'field' }, [el('label', { for: 'cs-repo', text: 'GitHub 저장소 주소' }), repo]),
      el('div', { class: 'field' }, [el('label', { for: 'cs-license', text: '라이선스' }), lic])
    ]);
    const sync = () => { repoBox.hidden = !openBox.checked; };
    openBox.addEventListener('change', sync);
    sync();
    save.addEventListener('click', () => {
      const url = repo.value.trim().replace(/\.git$/, '');
      if (openBox.checked && !C.REPO_RE.test(url)) { repo.focus(); run(null, () => Promise.reject(new Error('저장소 주소는 https://github.com/아이디/저장소 모양으로 적어 주세요.'))); return; }
      run(save, async () => {
        await C.setCollab(p.id, openBox.checked, url, lic.value, seek.checked);
        p.openSource = openBox.checked; p.repoUrl = openBox.checked ? url : ''; p.license = lic.value; p.seeking = seek.checked;
        render(p);
      });
    });
    const l1 = el('label', { class: 'radio' }); l1.append(openBox, document.createTextNode(' 코드를 오픈소스로 공개해요'));
    const l2 = el('label', { class: 'radio' }); l2.append(seek, document.createTextNode(' 같이 개선할 사람을 구해요'));
    return el('details', { class: 'collab-settings' }, [
      el('summary', { text: '협업 설정 (만든 사람만 보여요)' }),
      el('div', { class: 'stack-sm' }, [l1, repoBox, l2, el('div', { class: 'actions' }, [save])])
    ]);
  }

  if (!id) { notFound('어떤 결과물인지 알 수 없어요.'); return; }
  // 비공개 결과물은 서버가 그 그룹 멤버(와 올린 사람)에게만 내려 준다. 여기까지 왔으면 볼 수 있는 사람이다.
  function locked(p) {
    root.replaceChildren(
      el('div', { class: 'empty' }, [
        el('p', { text: '그룹 멤버에게만 공개된 결과물이에요. 그룹 비밀번호를 알고 있다면 그룹에 들어간 뒤 다시 열어 주세요.' }),
        el('a', { class: 'btn btn-primary', href: 'group.html?g=' + encodeURIComponent(p.group), text: '그룹에 들어가기' })
      ])
    );
  }

  function canSee(p) { return Boolean(p); }

  loadBoard()
    .then((board) => {
      data = board.data;
      const p = board.projects.find((item) => String(item.id) === id);
      if (!p) { notFound('찾는 결과물이 없어요. 비공개 결과물이라면 구글로 로그인하고 그 방에 들어간 뒤 다시 열어 주세요. 삭제되었거나 주소가 잘못되었을 수도 있어요.'); return; }
      if (canSee(p)) render(p); else locked(p);
    })
    .catch((err) => notFound(err.message));
})();
