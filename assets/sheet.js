// 구글 시트(CSV)를 결과물 목록으로 바꾼다.
// 브라우저와 GitHub Actions(Node)에서 같은 코드를 쓰기 위해 globalThis 에 올린다.
(function (root) {
  // 구글 폼의 "분류" 선택지와 똑같이 맞춘다.
  var CATEGORIES = ['사이트', '게임', '기타'];

  // 따옴표와 줄바꿈이 들어간 칸도 처리하는 CSV 읽기.
  function parseCsv(text) {
    var rows = [], row = [], cell = '', quoted = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
        } else { cell += ch; }
      } else if (ch === '"') { quoted = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else { cell += ch; }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // 같은 글에는 늘 같은 id 가 나오도록 등록 시각으로 만든다 (FNV-1a).
  function hashId(value) {
    var h = 0x811c9dc5;
    var s = String(value);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 's' + ('0000000' + h.toString(16)).slice(-8);
  }

  function findColumn(headers, keywords) {
    for (var i = 0; i < headers.length; i++) {
      var name = String(headers[i]).toLowerCase().replace(/\s+/g, '');
      for (var k = 0; k < keywords.length; k++) {
        if (name.indexOf(keywords[k]) !== -1) return i;
      }
    }
    return -1;
  }

  function webUrl(value) {
    try {
      var url = new URL(String(value).trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (err) { return null; }
  }

  function clip(value, max) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function isoDate(stamp) {
    var m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(String(stamp));
    if (!m) return '';
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }

  // rows: parseCsv 결과. 첫 줄은 질문 이름이다.
  function rowsToProjects(rows) {
    if (!rows.length) return [];
    var head = rows[0];
    var col = {
      stamp: findColumn(head, ['타임스탬프', 'timestamp']),
      title: findColumn(head, ['프로젝트이름', '이름']),
      summary: findColumn(head, ['한줄소개', '소개']),
      author: findColumn(head, ['만든사람']),
      category: findColumn(head, ['분류']),
      url: findColumn(head, ['체험링크', '링크']),
      description: findColumn(head, ['자세한설명', '설명']),
      hidden: findColumn(head, ['숨김'])
    };
    if (col.title === -1 || col.url === -1) {
      throw new Error('시트에서 "프로젝트 이름"과 "체험 링크" 열을 찾지 못했어요.');
    }
    if (col.stamp === -1) col.stamp = 0;

    var seen = {};
    var list = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var get = function (index) { return index === -1 || r[index] == null ? '' : r[index]; };
      if (clip(get(col.hidden), 10)) continue;          // "숨김" 열에 글자가 있으면 보여 주지 않는다.
      var title = clip(get(col.title), 80);
      var url = webUrl(get(col.url));
      if (!title || !url) continue;                      // 이름이나 올바른 링크가 없으면 건너뛴다.
      var stamp = clip(get(col.stamp), 60);
      var id = hashId(stamp || title + '|' + url);
      while (seen[id]) id = hashId(id + '+');
      seen[id] = true;
      var category = clip(get(col.category), 20);
      list.push({
        id: id,
        title: title,
        summary: clip(get(col.summary), 160),
        author: clip(get(col.author), 40) || '이름 없음',
        category: CATEGORIES.indexOf(category) !== -1 ? category : '기타',
        url: url,
        description: clip(get(col.description), 3000),
        createdAt: isoDate(stamp),
        row: i
      });
    }
    return list;
  }

  root.SheetData = { parseCsv: parseCsv, rowsToProjects: rowsToProjects, hashId: hashId };
})(globalThis);
