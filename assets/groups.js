// 비밀번호 그룹(방), 검증, 좋아요, 조회, 평가 기록. 모두 Supabase 서버에서 확인한다.
// - 그룹 비밀번호는 서버에서만 확인한다(bcrypt). 맞히면 그 구글 계정이 방 멤버로 등록된다.
// - 비공개 결과물과 그 방의 검증 기록은 서버가 멤버에게만 내려 준다.
// - 좋아요와 조회는 로그인했으면 계정당, 아니면 브라우저당 하나로 센다.
(function () {
  var config = globalThis.SITE_CONFIG || {};
  var DB = globalThis.DB || { enabled: false };
  var enabled = Boolean(DB.enabled);
  var DEVICE_KEY = 'korai.device.v1';
  var GOAL = Number(config.verifyGoal) > 0 ? Number(config.verifyGoal) : 3;
  var EMPTY = function () { return { groups: [], members: [], votes: {}, valueEvents: [], likes: {}, views: {}, managers: [] }; };

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function time(v) { var t = Date.parse(v); return Number.isFinite(t) ? t : 0; }

  var loading = null;
  var last = EMPTY();
  function load(force) {
    if (!enabled) return Promise.resolve(EMPTY());
    if (loading && !force) return loading;
    loading = Promise.all([
      DB.select('groups', 'id,name,intro,owner,created_at'),
      DB.select('group_members', 'group_id'),
      DB.select('votes', 'group_id,target,voter'),
      DB.select('value_events', 'kind,target,by_owner,value,improved,memo,at,id'),
      DB.select('likes', 'target,voter'),
      DB.call('view_counts'),
      DB.select('managers', 'owner')
    ]).then(function (r) {
      var out = EMPTY();
      out.groups = r[0].slice().sort(function (a, b) { return time(a.created_at) - time(b.created_at); })
        .map(function (g) { return { id: g.id, name: g.name, intro: g.intro || '', owner: g.owner || '' }; });
      out.members = r[1].map(function (m) { return m.group_id; });
      r[2].forEach(function (v) {
        var bucket = out.votes[v.group_id] = out.votes[v.group_id] || {};
        (bucket[v.target] = bucket[v.target] || []).push(v.voter);
      });
      out.valueEvents = r[3].slice().sort(function (a, b) { return a.id - b.id; }).map(function (e) {
        return { kind: e.kind, target: e.target, by: e.by_owner, at: time(e.at), value: e.value == null ? null : Number(e.value), improved: e.improved == null ? null : Number(e.improved), memo: e.memo || '' };
      });
      r[4].forEach(function (l) { (out.likes[l.target] = out.likes[l.target] || []).push(l.voter); });
      (r[5] || []).forEach(function (v) { out.views[v.target] = Number(v.n) || 0; });
      out.managers = r[6].map(function (m) { return m.owner; });
      last = out;
      return out;
    });
    loading.catch(function () { loading = null; });
    return loading;
  }
  // 로그인 상태가 바뀌면 볼 수 있는 내용도 바뀌므로 다시 불러온다.
  if (globalThis.Account && globalThis.Account.onChange) globalThis.Account.onChange(function () { loading = null; });

  function isMember(id, data) { return ((data || last).members || []).indexOf(id) !== -1; }
  function myGroups(data) {
    var d = data || last;
    return d.groups.filter(function (g) { return isMember(g.id, d); });
  }
  // 예전 코드와 맞추기 위한 것: { 그룹 번호: { name } }
  function memberships(data) {
    var out = {};
    myGroups(data).forEach(function (g) { out[g.id] = { name: g.name }; });
    return out;
  }

  function join(id, password) {
    return DB.call('join_group', { gid: id, pass: String(password) }).then(function (ok) {
      if (ok) { loading = null; if (last.members.indexOf(id) === -1) last.members.push(id); }
      return Boolean(ok);
    });
  }
  function leave(id) {
    return DB.call('leave_group', { gid: id }).then(function () { loading = null; });
  }
  function setPassword(id, password) {
    return DB.call('set_group_password', { gid: id, pass: String(password) }).then(function () { loading = null; });
  }
  function hasPassword(id) { return DB.call('has_password', { gid: id }); }

  // 좋아요와 조회에 쓰는 번호. 구글 로그인을 했으면 계정 번호, 아니면 이 브라우저의 무작위 번호.
  function voterId() {
    var me = globalThis.Account && globalThis.Account.current();
    if (me && me.owner) return me.owner;
    return deviceId();
  }
  function deviceId() {
    var id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (err) { id = ''; }
    if (!/^d[0-9a-f]{16}$/.test(id)) {
      id = 'd' + hex(crypto.getRandomValues(new Uint8Array(8)));
      try { localStorage.setItem(DEVICE_KEY, id); } catch (err) { /* 무시 */ }
    }
    return id;
  }

  // 방은 구글 로그인한 사람만 만들 수 있고, 만든 사람이 방장이 된다.
  function createGroup(name, intro, password) {
    var id = SheetData.groupKey(name);
    return DB.call('create_group', { p_id: id, p_name: name, p_intro: intro, p_pass: String(password) })
      .then(function () { loading = null; return id; });
  }

  function toggle(list, who, on) {
    var at = list.indexOf(who);
    if (on && at === -1) list.push(who);
    if (!on && at !== -1) list.splice(at, 1);
  }

  function votersFor(data, groupId, target) {
    return (((data || last).votes[groupId] || {})[target] || []).slice();
  }
  function vote(groupId, target, on) {
    return DB.call('vote', { gid: groupId, p_target: target, p_on: Boolean(on) }).then(function () {
      var bucket = last.votes[groupId] = last.votes[groupId] || {};
      toggle(bucket[target] = bucket[target] || [], voterId(), on);
    });
  }

  function likersFor(data, target) { return (((data || last).likes || {})[target] || []).slice(); }
  function like(target, on) {
    return DB.call('like_project', { p_target: target, p_on: Boolean(on), p_device: deviceId() }).then(function () {
      toggle(last.likes[target] = last.likes[target] || [], voterId(), on);
    });
  }

  // 조회: 상세 화면을 열 때 이 브라우저에서 그날 처음이면 한 번 보낸다(서버도 하루 한 번만 센다).
  var VIEW_KEY = 'korai.views.v1';
  function today() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  function view(target) {
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') || {}; } catch (err) { seen = {}; }
    var day = today();
    Object.keys(seen).forEach(function (k) { if (seen[k] !== day) delete seen[k]; });
    var first = seen[target] !== day;
    seen[target] = day;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(seen)); } catch (err) { /* 무시 */ }
    if (first) DB.call('record_view', { p_target: target, p_device: deviceId() }).catch(function () {});
    return first;
  }
  function viewsFor(data, target) { return (((data || last).views || {})[target] || 0); }

  // 평가 기록(분석 시작, 분석 취소, 가치 평가). 서버가 매니저나 방장인지 확인한다.
  var valueReady = enabled;
  function record(values) {
    return DB.call('record_value', {
      p_kind: values.kind, p_target: values.target,
      p_value: values.value == null || values.value === '' ? null : Number(values.value),
      p_improved: values.improved == null || values.improved === '' ? null : Number(values.improved),
      p_memo: values.memo || ''
    });
  }

  globalThis.Groups = {
    enabled: enabled,
    valueReady: valueReady,
    record: record,
    likersFor: likersFor,
    like: like,
    view: view,
    viewsFor: viewsFor,
    goal: GOAL,
    load: load,
    join: join,
    leave: leave,
    setPassword: setPassword,
    hasPassword: hasPassword,
    isMember: isMember,
    myGroups: myGroups,
    memberships: memberships,
    createGroup: createGroup,
    votersFor: votersFor,
    vote: vote,
    voterId: voterId
  };
})();
