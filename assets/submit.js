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

  // 구글 로그인(오른쪽 위 메뉴와 같은 로그인): 이름을 "만든 사람" 칸에 넣고,
  // 등록할 때 계정 번호(알아볼 수 없게 바꾼 값)를 함께 보내 내 정보 화면에 모아 보이게 한다.
  // 본인 확인 기능은 아니다. 이메일 주소는 쓰지도 보내지도 않는다.
  const account = globalThis.Account;
  const loginBox = document.getElementById('login-box');
  const loginText = document.getElementById('login-text');
  const googleButton = document.getElementById('google-button');
  const doneMine = document.getElementById('done-mine');
  let buttonDrawn = false;

  function showAccount(a) {
    if (!account || !account.enabled) { loginBox.hidden = true; return; }
    loginBox.hidden = false;
    if (a) {
      if (!form.elements.author.value.trim()) form.elements.author.value = a.name;
      loginText.textContent = a.name + ' 님으로 로그인했어요. 지금 올리는 결과물은 내 정보 화면에 모여요. 만든 사람 이름은 고쳐 적어도 돼요.';
      googleButton.hidden = true;
    } else {
      loginText.textContent = '구글로 로그인하고 올리면 만든 사람 이름이 자동으로 들어가고, 내 정보 화면에서 내 결과물을 모아 볼 수 있어요. 로그인하지 않아도 올릴 수 있어요.';
      googleButton.hidden = false;
      if (!buttonDrawn) { buttonDrawn = true; account.renderButton(googleButton, 240); }
    }
  }
  if (account) {
    showAccount(account.current());
    account.onChange((a) => { buttonDrawn = false; showAccount(a); });
  } else {
    loginBox.hidden = true;
  }

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
    const me = account && account.current();
    if (me && fields.owner) body.append(fields.owner, me.owner);

    send.disabled = true;
    send.textContent = '보내는 중';
    try {
      // 구글 폼은 다른 사이트에서 보낸 요청의 결과를 알려 주지 않는다. 요청이 나갔으면 접수된 것으로 본다.
      await fetch(config.formAction, { method: 'POST', mode: 'no-cors', body: body });
      open.hidden = true;
      done.hidden = false;
      doneMine.hidden = !(me && fields.owner);
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
