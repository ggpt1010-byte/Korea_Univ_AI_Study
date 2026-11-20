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
    box.append(el('p', { class: 'hint', text: 'GitHub 계정으로 로그인하면 피드백을 남길 수 있어요. 아래 "Sign in with GitHub" 버튼을 눌러 주세요.' }));
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
      el('a', { class: 'btn btn-plain btn-lg', href: '#feedback', text: '피드백 남기기' })
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
  loadProjects()
    .then((list) => {
      const p = list.find((item) => String(item.id) === id);
      if (p) render(p); else notFound('찾는 결과물이 없어요. 삭제되었거나 주소가 잘못되었을 수 있어요.');
    })
    .catch((err) => notFound(err.message));
})();
