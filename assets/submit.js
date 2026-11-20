(function () {
  const config = globalThis.SITE_CONFIG || {};
  const fields = config.formFields || {};
  const names = ['title', 'summary', 'author', 'category', 'url', 'description'];
  const ready = Boolean(config.formAction) && names.every((n) => fields[n]);

  const closed = document.getElementById('closed');
  const open = document.getElementById('open');
  const done = document.getElementById('done');
  const form = document.getElementById('form');
  const error = document.getElementById('error');
  const send = document.getElementById('send');

  if (!ready) { closed.hidden = false; return; }
  open.hidden = false;

  // 구글 로그인: 로그인한 사람의 이름을 "만든 사람" 칸에 넣어 준다.
  // 이름을 편하게 채워 주는 기능일 뿐, 본인 확인은 아니다. 이메일 주소는 쓰지도 보내지도 않는다.
  function decodeName(credential) {
    try {
      const part = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      return String(payload.name || payload.given_name || '').trim().slice(0, 40);
    } catch (err) {
      return '';
    }
  }

  function setupGoogleLogin() {
    if (!config.googleClientId) return;
    const box = document.getElementById('login-box');
    const text = document.getElementById('login-text');
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!globalThis.google || !google.accounts || !google.accounts.id) return;
      google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: (response) => {
          const name = decodeName(response.credential || '');
          if (!name) return;
          form.elements.author.value = name;
          text.textContent = name + ' 님으로 로그인했어요. 만든 사람 칸에 이름을 넣었어요. 다른 이름으로 올리고 싶으면 고쳐 적어도 돼요.';
          document.getElementById('google-button').hidden = true;
        }
      });
      google.accounts.id.renderButton(document.getElementById('google-button'), {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'ko'
      });
      box.hidden = false;
    };
    document.head.append(script); // 불러오지 못하면 버튼 없이 직접 적으면 된다.
  }
  setupGoogleLogin();

  function fail(message, input) {
    error.textContent = message;
    error.hidden = false;
    if (input) input.focus();
  }

  function isWebUrl(value) {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch (err) { return false; }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    const data = {};
    names.forEach((n) => { data[n] = form.elements[n].value.trim(); });

    if (!data.title) return fail('프로젝트 이름을 적어 주세요.', form.elements.title);
    if (!data.summary) return fail('한 줄 소개를 적어 주세요.', form.elements.summary);
    if (!data.author) return fail('만든 사람을 적어 주세요.', form.elements.author);
    if (!isWebUrl(data.url)) return fail('체험 링크는 https:// 로 시작하는 주소로 적어 주세요.', form.elements.url);

    const body = new URLSearchParams();
    names.forEach((n) => body.append(fields[n], data[n]));

    send.disabled = true;
    send.textContent = '보내는 중';
    try {
      // 구글 폼은 다른 사이트에서 보낸 요청의 결과를 알려 주지 않는다. 요청이 나갔으면 접수된 것으로 본다.
      await fetch(config.formAction, { method: 'POST', mode: 'no-cors', body: body });
      open.hidden = true;
      done.hidden = false;
      document.getElementById('done-title').focus();
    } catch (err) {
      fail('보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      send.disabled = false;
      send.textContent = '등록하기';
    }
  });

  document.getElementById('again').addEventListener('click', () => {
    form.reset();
    done.hidden = true;
    open.hidden = false;
    form.elements.title.focus();
  });
})();
