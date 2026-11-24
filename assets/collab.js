// 같이 개선하기: 개선 아이디어, "나도 해볼래요", 기여자. 모두 Supabase 서버 함수로 쓰고 서버가 권한을 확인한다.
// - 아이디어는 처음 버전(v1) 번호에 모인다. AI 평가에서 뽑힌 것(AI), 주인이 적은 것(주인), 다른 사람이 제안한 것(제안)이 있다.
// - "나도 해볼래요"의 이름과 메모는 본인과 결과물 주인만 읽을 수 있고, 다른 사람에게는 숫자만 보인다.
// - 서버에 표가 아직 없으면(collab.sql 을 실행하기 전) ready 가 false 이고, 화면은 이 기능을 닫아 둔다.
(function () {
  var DB = globalThis.DB || { enabled: false };
  var LICENSES = ['모름', 'MIT', 'Apache-2.0', 'GPL-3.0', '기타'];
  var REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
  function empty() { return { ready: false, ideas: [], joins: [], counts: {}, contributors: [] }; }

  var loading = null;
  function load(force) {
    if (!DB.enabled) return Promise.resolve(empty());
    if (loading && !force) return loading;
    loading = Promise.all([
      DB.select('ideas', 'id,target,from_version,body,gain,source,status,done_version,by_owner,created_at'),
      DB.select('idea_joins', 'idea_id,owner,name,note,created_at'),
      DB.call('idea_join_counts'),
      DB.select('contributors', 'version_id,owner,name,idea_id')
    ]).then(function (r) {
      var out = empty();
      out.ready = true;
      out.ideas = r[0].map(function (i) {
        return {
          id: Number(i.id), target: i.target, fromVersion: i.from_version || '', body: i.body, gain: i.gain == null ? null : Number(i.gain),
          source: i.source, status: i.status, doneVersion: i.done_version || '', by: i.by_owner || '', at: Date.parse(i.created_at) || 0
        };
      }).sort(function (a, b) { return a.id - b.id; });
      out.joins = r[1].map(function (j) { return { idea: Number(j.idea_id), owner: j.owner, name: j.name, note: j.note || '', at: Date.parse(j.created_at) || 0 }; });
      (r[2] || []).forEach(function (c) { out.counts[Number(c.idea_id)] = Number(c.n) || 0; });
      out.contributors = r[3].map(function (c) { return { version: c.version_id, owner: c.owner, name: c.name, idea: c.idea_id == null ? null : Number(c.idea_id) }; });
      return out;
    });
    loading.catch(function () { loading = null; });
    return loading;
  }
  if (globalThis.Account && globalThis.Account.onChange) globalThis.Account.onChange(function () { loading = null; });

  function ideasFor(c, rootId) { return (c && c.ideas || []).filter(function (i) { return i.target === String(rootId); }); }
  function joinsFor(c, ideaId) { return (c && c.joins || []).filter(function (j) { return j.idea === ideaId; }); }
  function countFor(c, ideaId) {
    var n = c && c.counts ? c.counts[ideaId] : 0;
    return Math.max(n || 0, joinsFor(c, ideaId).length);
  }
  function myJoin(c, ideaId) {
    var me = globalThis.Account && globalThis.Account.current();
    if (!me) return null;
    return joinsFor(c, ideaId).find(function (j) { return j.owner === me.owner; }) || null;
  }
  function contributorsFor(c, versionId) { return (c && c.contributors || []).filter(function (x) { return x.version === String(versionId); }); }

  function myName() {
    var me = globalThis.Account && globalThis.Account.current();
    return me && me.name ? String(me.name).slice(0, 40) : '';
  }

  // GitHub 새 이슈 화면을 제목과 내용이 채워진 채로 연다(GitHub API를 쓰지 않는다).
  function issueUrl(repo, project, idea) {
    if (!REPO_RE.test(String(repo || ''))) return null;
    var base = String(repo).replace(/\/$/, '');
    var page = location.origin + location.pathname.replace(/[^/]*$/, '') + 'project.html?id=' + encodeURIComponent(project.id);
    var body = 'AI개발모임에서 나온 개선 아이디어예요.\n\n- 아이디어: ' + idea.body +
      (idea.gain ? '\n- 예상 효과: 평가 금액 +' + (globalThis.Manager ? Manager.won(idea.gain) : idea.gain + '원') : '') +
      '\n- 결과물: ' + page + '\n\n같이 해 보실 분은 댓글 남겨 주세요.';
    return base + '/issues/new?title=' + encodeURIComponent('[개선 아이디어] ' + idea.body.slice(0, 80)) + '&body=' + encodeURIComponent(body);
  }

  globalThis.Collab = {
    LICENSES: LICENSES,
    REPO_RE: REPO_RE,
    empty: empty,
    load: load,
    ideasFor: ideasFor,
    joinsFor: joinsFor,
    countFor: countFor,
    myJoin: myJoin,
    contributorsFor: contributorsFor,
    issueUrl: issueUrl,
    setCollab: function (target, open, repo, license, seeking) {
      return DB.call('set_collab', { p_target: String(target), p_open: Boolean(open), p_repo: repo || null, p_license: license || '모름', p_seeking: Boolean(seeking) });
    },
    addAiIdeas: function (versionId, items) {
      return DB.call('add_ai_ideas', { p_version: String(versionId), p_items: (items || []).slice(0, 4) });
    },
    propose: function (target, body) { return DB.call('propose_idea', { p_target: String(target), p_body: String(body) }); },
    setStatus: function (id, status) { return DB.call('set_idea_status', { p_id: id, p_status: status }); },
    join: function (id, on, note) { return DB.call('join_idea', { p_id: id, p_on: Boolean(on), p_name: myName(), p_note: note || '' }); }
  };
})();
