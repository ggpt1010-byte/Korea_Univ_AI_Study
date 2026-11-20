// 로그인과 "내 정보" 메뉴. 모든 화면 오른쪽 위에 붙는다.
// 서버가 없는 사이트라서 구글 로그인 결과를 이 브라우저 안에서만 쓴다.
// - 가져오는 것: 이름, 그리고 구글 계정 번호를 알아볼 수 없게 바꾼 값(아래 ownerOf).
// - 이메일 주소와 프로필 사진은 쓰지도, 저장하지도, 보내지도 않는다.
// - 서버에서 다시 확인하지 않으므로 본인 확인 기능은 아니다. "내 결과물 모아 보기" 용도로만 쓴다.
(function () {
  var config = globalThis.SITE_CONFIG || {};
  var KEY = 'korai-account';
  var MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30일 지나면 다시 로그인
  var enabled = Boolean(config.googleClientId);
  var listeners = [];
  var gsiPromise = null;

  function valid(a) {
    return a && typeof a.name === 'string' && a.name && /^g[0-9a-f]{16}$/.test(String(a.owner));
  }

  function read() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!valid(s) || !(Date.now() - Number(s.at) < MAX_AGE)) return null;
      return { name: s.name.slice(0, 40), owner: s.owner };
    } catch (err) { return null; }
  }

  var current = enabled ? read() : null;

  function save(a) {
    current = a;
    try {
      if (a) localStorage.setItem(KEY, JSON.stringify({ name: a.name, owner: a.owner, at: Date.now() }));
      else localStorage.removeItem(KEY);
    } catch (err) { /* 저장이 막힌 브라우저에서는 이 화면에서만 로그인 상태가 유지된다. */ }
    listeners.slice().forEach(function (fn) { fn(current); });
  }

  function decode(credential) {
    try {
      var part = String(credential).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var bytes = Uint8Array.from(atob(part), function (c) { return c.charCodeAt(0); });
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) { return null; }
  }

  // 구글 계정 번호(sub)를 SHA-256으로 바꾼 앞 16자리. 같은 계정이면 늘 같은 값이 나오고,
  // 이 값으로는 원래 계정을 알아낼 수 없다. 시트에 공개되므로 이메일 같은 정보는 섞지 않는다.
  function ownerOf(sub) {
    var data = new TextEncoder().encode('korai-account:' + sub);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      var hex = Array.from(new Uint8Array(buf)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      return 'g' + hex.slice(0, 16);
    });
  }

  function handleCredential(response) {
    var p = decode(response && response.credential);
    if (!p || !p.sub) return;
    var name = String(p.name || p.given_name || '').trim().slice(0, 40) || '모임원';
    ownerOf(String(p.sub)).then(function (owner) { save({ name: name, owner: owner }); });
  }

  function loadGsi() {
    if (!enabled) return Promise.reject(new Error('off'));
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise(function (resolve, reject) {
      var ready = function () {
        if (!(globalThis.google && google.accounts && google.accounts.id)) { reject(new Error('gsi')); return; }
        google.accounts.id.initialize({ client_id: config.googleClientId, callback: handleCredential, auto_select: false });
        resolve(google.accounts.id);
      };
      if (globalThis.google && google.accounts && google.accounts.id) { ready(); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = ready;
      s.onerror = function () { reject(new Error('gsi')); };
      document.head.append(s);
    });
    gsiPromise.catch(function () { gsiPromise = null; });
    return gsiPromise;
  }

  function renderButton(container, width) {
    container.replaceChildren();
    return loadGsi().then(function (id) {
      id.renderButton(container, {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with',
        shape: 'rectangular', locale: 'ko', width: width || 260
      });
    }).catch(function () {
      var p = document.createElement('p');
      p.className = 'hint';
      p.textContent = '구글 로그인을 불러오지 못했어요. 잠시 뒤에 새로고침해 주세요.';
      container.replaceChildren(p);
    });
  }

  function signOut() {
    if (globalThis.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    save(null);
  }

  globalThis.Account = {
    enabled: enabled,
    current: function () { return current; },
    onChange: function (fn) { listeners.push(fn); },
    renderButton: renderButton,
    signOut: signOut
  };

  // ---- 오른쪽 위 메뉴 ----
  var slot = document.getElementById('account');
  if (!slot) return;
  if (!enabled) { slot.hidden = true; return; }

  var popId = 'account-pop';
  var trigger = null;
  var pop = null;

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function close(focusBack) {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focusBack) trigger.focus();
  }

  function place() {
    // 좁은 화면에서는 버튼 위치와 상관없이 화면 양쪽 16px 안에 들어오게 띄운다.
    if (window.innerWidth < 560) {
      var r = trigger.getBoundingClientRect();
      pop.classList.add('is-sheet');
      pop.style.top = Math.round(r.bottom + 8) + 'px';
    } else {
      pop.classList.remove('is-sheet');
      pop.style.top = '';
    }
  }

  function open() {
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    place();
    if (!current) Account.renderButton(pop.querySelector('.pop-google'), 260);
    var first = pop.querySelector('a, button');
    if (current && first) first.focus();
  }

  function render() {
    slot.replaceChildren();
    if (current) {
      trigger = make('button', 'account-btn');
      trigger.type = 'button';
      trigger.setAttribute('aria-label', current.name + ' 님, 내 정보 메뉴');
      trigger.append(make('span', 'avatar', Array.from(current.name)[0] || '?'), make('span', 'account-name', current.name));
      pop = make('div', 'account-pop');
      pop.append(make('p', 'pop-name', current.name + ' 님'), make('p', '', '구글 계정으로 로그인했어요.'));
      var me = make('a', 'pop-link', '내 정보와 내 결과물');
      me.href = 'me.html';
      if (/\/me\.html$/.test(location.pathname)) me.setAttribute('aria-current', 'page');
      var out = make('button', 'pop-link pop-out', '로그아웃');
      out.type = 'button';
      out.addEventListener('click', function () { signOut(); });
      pop.append(me, out);
    } else {
      trigger = make('button', 'btn btn-plain account-login', '로그인');
      trigger.type = 'button';
      pop = make('div', 'account-pop');
      pop.append(
        make('p', 'pop-name', '구글로 로그인'),
        make('p', '', '로그인하고 올리면 내 결과물을 내 정보 화면에서 모아 볼 수 있어요. 이름만 가져오고, 이메일 주소는 저장하지 않아요.'),
        make('div', 'pop-google')
      );
      var more = make('a', 'pop-more', '어떤 정보를 쓰는지 보기');
      more.href = 'privacy.html';
      pop.append(more);
    }
    pop.id = popId;
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', current ? '내 정보 메뉴' : '로그인');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', popId);
    trigger.addEventListener('click', function () { if (pop.hidden) open(); else close(false); });
    slot.append(trigger, pop);
  }

  document.addEventListener('click', function (e) {
    if (pop && !pop.hidden && !slot.contains(e.target)) close(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close(true);
  });
  window.addEventListener('resize', function () { if (pop && !pop.hidden) place(); });
  window.addEventListener('scroll', function () { if (pop && !pop.hidden && pop.classList.contains('is-sheet')) close(false); }, { passive: true });

  Account.onChange(function () { render(); });
  render();
})();
