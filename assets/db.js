// Supabase 연결. config.js 의 supabaseUrl 과 supabaseKey(공개 키)가 있어야 켜진다.
// 공개 키로는 표를 직접 고칠 수 없다. 읽기는 서버의 읽기 규칙(RLS)을 따르고, 쓰기는 서버 함수(rpc)로만 한다.
(function () {
  var config = globalThis.SITE_CONFIG || {};
  var client = null;
  if (config.supabaseUrl && config.supabaseKey && globalThis.supabase && globalThis.supabase.createClient) {
    client = globalThis.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'korai-auth' }
    });
  }

  // 서버 함수가 보낸 오류 코드를 화면에 쓸 문장으로 바꾼다.
  var MESSAGES = {
    login_required: '먼저 구글로 로그인해 주세요.',
    not_member: '이 방에 들어간 사람만 할 수 있어요.',
    not_owner: '처음 올린 사람(같은 구글 계정)만 할 수 있어요.',
    not_manager: '매니저만 할 수 있어요.',
    name_taken: '같은 이름의 방이 이미 있어요. 다른 이름을 적어 주세요.',
    short_password: '비밀번호는 6자 이상으로 정해 주세요.',
    too_many_attempts: '비밀번호를 너무 많이 틀렸어요. 10분 뒤에 다시 해 주세요.',
    parent_not_found: '원래 결과물을 찾지 못했어요.'
  };
  function errorText(err, fallback) {
    var m = String((err && (err.message || err.details)) || '');
    var code = Object.keys(MESSAGES).find(function (k) { return m.indexOf(k) !== -1; });
    return code ? MESSAGES[code] : (fallback || '서버와 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.');
  }

  // rpc 를 부르고, 실패하면 화면에 쓸 문장을 담은 오류를 던진다.
  function call(name, args) {
    if (!client) return Promise.reject(new Error('아직 준비 중이에요.'));
    return client.rpc(name, args || {}).then(function (res) {
      if (res.error) { var e = new Error(errorText(res.error)); e.code = res.error.message; throw e; }
      return res.data;
    });
  }

  function select(table, columns) {
    return client.from(table).select(columns || '*').then(function (res) {
      if (res.error) throw new Error('목록을 불러오지 못했어요.');
      return res.data || [];
    });
  }

  globalThis.DB = { enabled: Boolean(client), client: client, call: call, select: select, errorText: errorText };
})();
