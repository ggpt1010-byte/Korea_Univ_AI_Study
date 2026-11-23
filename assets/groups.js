// 비밀번호 그룹: 그룹 만들기, 들어가기, 검증 기록.
// 서버가 없는 사이트라서 진짜 보안 기능은 아니다.
// - 비밀번호는 원문 대신 알아볼 수 없게 바꾼 값(PBKDF2-SHA256)만 공개 시트에 남는다.
// - 시트와 저장소는 공개라서, 마음먹으면 비공개 결과물의 내용도 볼 수 있다.
// - 비밀번호를 맞힌 기록은 이 브라우저(localStorage)에만 남는다.
(function () {
  var config = globalThis.SITE_CONFIG || {};
  var fields = config.groupFormFields || {};
  var FIELD_NAMES = ['kind', 'group', 'name', 'intro', 'pass', 'target', 'voter'];
  var enabled = Boolean(config.groupSheetCsvUrl && config.groupFormAction) &&
    FIELD_NAMES.every(function (n) { return fields[n]; });
  var MEMBER_KEY = 'korai.groups.v1';
  var VOTE_KEY = 'korai.votes.v1';
  var DEVICE_KEY = 'korai.device.v1';
  var GOAL = Number(config.verifyGoal) > 0 ? Number(config.verifyGoal) : 3;

  function readJson(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (err) { return {}; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* 저장을 막은 브라우저 */ }
  }
  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // 그룹 번호를 소금으로 써서, 같은 비밀번호라도 그룹마다 다른 값이 나오게 한다.
  function passKey(groupId, password) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('korai-group:' + groupId), iterations: 150000 },
          key, 256);
      })
      .then(hex);
  }

  var loading = null;
  function load(force) {
    if (!enabled) return Promise.resolve({ groups: [], votes: {} });
    if (loading && !force) return loading;
    loading = fetch(config.groupSheetCsvUrl, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('그룹 목록을 불러오지 못했어요 (' + res.status + ')');
        return res.text();
      })
      .then(function (text) { return SheetData.rowsToGroups(SheetData.parseCsv(text)); });
    loading.catch(function () { loading = null; });
    return loading;
  }

  function memberships() { return readJson(MEMBER_KEY); }
  function join(id, name, key) {
    var all = memberships();
    all[id] = { name: String(name).slice(0, 40), key: key, at: Date.now() };
    writeJson(MEMBER_KEY, all);
  }
  function leave(id) {
    var all = memberships();
    delete all[id];
    writeJson(MEMBER_KEY, all);
  }
  // 시트에 아직 안 올라온 새 그룹은, 만든 사람의 브라우저에서는 들어갈 수 있게 둔다.
  function isMember(id, data) {
    var m = memberships()[id];
    if (!m) return false;
    var g = data && data.groups.find(function (x) { return x.id === id; });
    return !g || g.pass === m.key;
  }
  function myGroups(data) {
    var all = memberships();
    return Object.keys(all).filter(function (id) { return isMember(id, data); }).map(function (id) {
      var g = data && data.groups.find(function (x) { return x.id === id; });
      return { id: id, name: g ? g.name : all[id].name, intro: g ? g.intro : '', pending: !g };
    });
  }

  // 검증을 누른 사람 표시. 구글 로그인을 했으면 계정 번호, 아니면 이 브라우저의 무작위 번호.
  function voterId() {
    var me = globalThis.Account && globalThis.Account.current();
    if (me && me.owner) return me.owner;
    var id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (err) { id = ''; }
    if (!/^d[0-9a-f]{16}$/.test(id)) {
      id = 'd' + hex(crypto.getRandomValues(new Uint8Array(8)));
      try { localStorage.setItem(DEVICE_KEY, id); } catch (err) { /* 무시 */ }
    }
    return id;
  }

  function send(values) {
    var body = new URLSearchParams();
    Object.keys(values).forEach(function (n) { if (fields[n]) body.append(fields[n], values[n]); });
    // 구글 폼은 다른 사이트에서 보낸 요청의 결과를 알려 주지 않는다. 요청이 나갔으면 접수된 것으로 본다.
    return fetch(config.groupFormAction, { method: 'POST', mode: 'no-cors', body: body });
  }

  function createGroup(name, intro, password) {
    var id = SheetData.groupKey(name);
    return passKey(id, password).then(function (key) {
      return send({ kind: '그룹 만들기', group: id, name: name, intro: intro, pass: key }).then(function () {
        join(id, name, key);
        return id;
      });
    });
  }

  // 시트에 반영되기 전까지는 내가 누른 것을 이 브라우저에 따로 기억해 숫자에 바로 보이게 한다.
  function votersFor(data, groupId, target) {
    var list = ((data.votes[groupId] || {})[target] || []).slice();
    var mine = readJson(VOTE_KEY)[groupId + '|' + target];
    var me = voterId();
    var has = list.indexOf(me) !== -1;
    if (mine === true && !has) list.push(me);
    if (mine === false && has) list.splice(list.indexOf(me), 1);
    return list;
  }
  function vote(groupId, target, on) {
    var local = readJson(VOTE_KEY);
    local[groupId + '|' + target] = Boolean(on);
    writeJson(VOTE_KEY, local);
    return send({ kind: on ? '검증' : '검증 취소', group: groupId, target: target, voter: voterId() });
  }

  globalThis.Groups = {
    enabled: enabled,
    goal: GOAL,
    load: load,
    passKey: passKey,
    join: join,
    leave: leave,
    isMember: isMember,
    myGroups: myGroups,
    memberships: memberships,
    createGroup: createGroup,
    votersFor: votersFor,
    vote: vote,
    voterId: voterId
  };
})();
