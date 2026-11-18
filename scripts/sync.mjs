// 구글 시트에 쌓인 등록 내용을 받아 data/submissions.json 으로 저장한다.
// 사이트는 시트를 바로 읽지만, 시트를 못 읽을 때는 이 사본을 대신 보여 준다.
import '../assets/config.js';
import '../assets/sheet.js';
import { readFile, writeFile } from 'node:fs/promises';

const url = process.env.SHEET_CSV_URL || globalThis.SITE_CONFIG.sheetCsvUrl;
if (!url) {
  console.log('시트 주소가 아직 설정되지 않았어요. 할 일이 없어요.');
  process.exit(0);
}

const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) {
  console.error(`시트를 읽지 못했어요 (${res.status}).`);
  process.exit(1);
}
const { parseCsv, rowsToProjects } = globalThis.SheetData;
const list = rowsToProjects(parseCsv(await res.text()));
const next = JSON.stringify(list, null, 2) + '\n';
const prev = await readFile('data/submissions.json', 'utf8').catch(() => '');
if (next === prev) {
  console.log(`바뀐 내용이 없어요 (등록 ${list.length}개).`);
} else {
  await writeFile('data/submissions.json', next);
  console.log(`등록 ${list.length}개를 저장했어요.`);
}
