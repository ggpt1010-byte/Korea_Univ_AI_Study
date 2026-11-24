(function () {
  const config = globalThis.SITE_CONFIG || {};
    const names = ['title', 'summary', 'author', 'category', 'url', 'description'];
  const DB = globalThis.DB;
  const ready = Boolean(DB && DB.enabled);

  const closed = document.getElementById('closed');
  const open = document.getElementById('open');
  const done = document.getElementById('done');
  const form = document.getElementById('form');
  const error = document.getElementById('error');
  const send = document.getElementById('send');

  if (!ready) { closed.hidden = false; return; }
  open.hidden = false;

  // 구글 로그인(오른쪽 위 메뉴와 같은 로그인): 이름을 "만든 사람" 칸에 넣고,
  // 서버가 로그인한 계정으로 결과물 주인을 기록해 내 정보 화면에 모아 보이게 한다.
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

  // 새 버전 올리기: submit.html?parent=<결과물 번호>. 같은 구글 계정으로 로그인한 원래 작성자만 올릴 수 있다.
  const parentId = new URLSearchParams(location.search).get('parent') || '';
  let parent = null;
  const versionReady = ready;
  if (parentId && versionReady) {
    document.getElementById('submit-title').textContent = '새 버전 올리기';
    document.title = '새 버전 올리기 · AI개발모임';
    document.getElementById('changes-box').hidden = false;
    loadProjects().then((list) => {
      parent = list.find((p) => String(p.id) === parentId) || null;
      if (!parent) { fail('원래 결과물을 찾지 못했어요. 주소를 확인해 주세요.'); return; }
      const f = form.elements;
      f.title.value = parent.title;
      f.summary.value = parent.summary;
      f.author.value = parent.author;
      f.category.value = parent.category;
      f.url.value = parent.url;
      f.description.value = parent.description || '';
      if (f.images) f.images.value = (parent.images || []).join('\n');
      const lead = document.querySelector('.page-head p');
      lead.textContent = '"' + parent.title + '"의 v' + ((parent.version || 1) + 1) + '를 올려요. 바뀐 내용을 고치고, 바뀐 점을 적어 주세요. 방과 공개 범위는 처음 버전을 따라가요.';
    }).catch(() => fail('원래 결과물을 불러오지 못했어요. 잠시 뒤에 새로고침해 주세요.'));
  }

  // 사진 주소. 결과물 폼에 "사진 주소" 질문이 있을 때만 보여 준다.
  const imagesBox = document.getElementById('images-box');
  imagesBox.hidden = false;
  function imageUrls() {
    return form.elements.images.value.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
  }

  // 그룹과 공개 범위. 결과물 폼에 두 질문이 있고 그룹 기능이 켜져 있을 때만 보여 준다.
  const G = globalThis.Groups;
  const groupBox = document.getElementById('group-box');
  const groupReady = Boolean(G && G.enabled);
  function syncVisibility() {
    const hasGroup = Boolean(form.elements.group.value);
    form.querySelectorAll('input[name="visibility"]').forEach((r) => {
      r.disabled = !hasGroup && r.value === '비공개';
      if (!hasGroup && r.value === '공개') r.checked = true;
    });
  }
  if (groupReady && !parentId) {
    G.load().catch(() => null).then((data) => {
      const mine = G.myGroups(data);
      const select = form.elements.group;
      select.replaceChildren(
        el('option', { value: '', text: '방 없이 올리기' }),
        ...mine.map((g) => el('option', { value: g.id, text: g.name }))
      );
      const wanted = new URLSearchParams(location.search).get('group');
      if (wanted && mine.some((g) => g.id === wanted)) select.value = wanted;
      groupBox.hidden = false;
      syncVisibility();
    });
    form.elements.group.addEventListener('change', syncVisibility);
  }

  function el(tag, attrs) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') node.textContent = v; else node.setAttribute(k, v); });
    return node;
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
    if (parentId) {
      const me0 = account && account.current();
      if (!parent) return fail('원래 결과물을 불러오는 중이에요. 잠시 뒤에 다시 눌러 주세요.');
      if (!me0 || me0.owner !== parent.owner) return fail('새 버전은 처음 올린 사람이 같은 구글 계정으로 로그인해야 올릴 수 있어요.');
      if (!form.elements.changes.value.trim()) return fail('바뀐 점을 적어 주세요.', form.elements.changes);
    }
    const images = imageUrls();
    if (images.length > 5) return fail('사진 주소는 5개까지 넣을 수 있어요.', form.elements.images);
    if (images.some((u) => !/^https:\/\//.test(u) || !isWebUrl(u))) return fail('사진 주소는 https:// 로 시작하는 주소로 한 줄에 하나씩 적어 주세요.', form.elements.images);

    const me = account && account.current();
    const payload = Object.assign({}, data, { images: images });
    if (parentId && parent) {
      payload.parent = String(parent.id);
      payload.changes = form.elements.changes.value.trim().slice(0, 1000);
    }
    if (groupReady && form.elements.group.value) {
      payload.group = form.elements.group.value;
      payload.private = form.querySelector('input[name="visibility"]:checked').value === '비공개';
    }

    send.disabled = true;
    send.textContent = '보내는 중';
    try {
      const newId = await DB.call('submit_project', { p: payload });
      open.hidden = true;
      done.hidden = false;
      doneMine.hidden = !me;
      const view = document.getElementById('done-view');
      if (view) view.href = 'project.html?id=' + encodeURIComponent(parent ? parent.id : newId);
      document.getElementById('done-title').focus();
    } catch (err) {
      fail(err.message || '보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      send.disabled = false;
      send.textContent = '등록하기';
    }
  });

  document.getElementById('again').addEventListener('click', () => {
    form.reset();
    if (groupReady) syncVisibility();
    done.hidden = true;
    open.hidden = false;
    form.elements.title.focus();
  });
})();
