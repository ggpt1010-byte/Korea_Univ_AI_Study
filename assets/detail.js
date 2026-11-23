(function () {
  const root = document.getElementById('detail');
  const id = new URLSearchParams(location.search).get('id');

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

  function render(p) {
    document.title = p.title + ' · AI개발모임';
    const url = safeUrl(p.url);
    const meta = ['만든 사람 ' + p.author, formatDate(p.createdAt)].filter(Boolean).join(' · ');

    const actions = el('div', { class: 'actions' }, [
      url
        ? el('a', { class: 'btn btn-primary btn-lg', href: url, target: '_blank', rel: 'noopener noreferrer', text: '체험하러 가기' })
        : el('span', { class: 'meta', text: '체험 링크가 올바르지 않아요.' }),
      el('a', { class: 'btn btn-plain btn-lg', href: '#feedback', text: '피드백 남기기' }),
      p.category === '게임'
        ? el('a', { class: 'btn btn-plain btn-lg', href: 'estimate.html?id=' + encodeURIComponent(p.id), text: '수익 평가해 보기' })
        : null
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
    const shotLink = url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': p.title + ' 체험하러 가기' }, [shot]) : shot;

    root.replaceChildren(
      el('a', { class: 'back', href: 'index.html', text: '‹ 목록으로 돌아가기' }),
      el('section', { class: 'detail-head' }, [
        el('span', { class: 'tag', text: p.category || '기타' }),
        el('h1', { text: p.title }),
        el('p', { class: 'summary', text: p.summary }),
        el('p', { class: 'meta', text: meta }),
        actions
      ]),
      shotLink,
      panel.childNodes.length ? panel : null,
      feedbackSection(p)
    );
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
    if (!p.private) return Promise.resolve(true);
    const G = globalThis.Groups;
    if (!G) return Promise.resolve(false);
    return G.load().catch(() => null).then((data) => G.isMember(p.group, data));
  }

  loadProjects()
    .then((list) => {
      const p = list.find((item) => String(item.id) === id);
      if (!p) { notFound('찾는 결과물이 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.'); return; }
      return canSee(p).then((ok) => { if (ok) render(p); else locked(p); });
    })
    .catch((err) => notFound(err.message));
})();
