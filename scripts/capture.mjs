// 결과물마다 체험 링크의 첫 화면을 찍어 shots/<id>.jpg 로 저장한다.
// 사용법: node scripts/capture.mjs          (아직 이미지가 없는 결과물만)
//         node scripts/capture.mjs --all    (전부 다시 찍기)
//         node scripts/capture.mjs --check  (찍을 것이 있는지만 확인)
import { readFile, writeFile, mkdir, access, appendFile } from 'node:fs/promises';
import { isIP } from 'node:net';

const all = process.argv.includes('--all');
const checkOnly = process.argv.includes('--check');
const MAX_TRIES = 3; // 계속 실패하는 링크는 세 번까지만 시도한다.
const FAILED_FILE = 'data/capture-failed.json';

const readJson = async (path, fallback) => {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
};
const exists = (path) => access(path).then(() => true, () => false);

// 공개된 웹 주소만 찍는다. 실행하는 컴퓨터 안쪽 주소(localhost, 사설 IP)는 막는다.
// 시험할 때만 ALLOW_LOCAL=1 로 풀 수 있다.
function isPublicWebUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (process.env.ALLOW_LOCAL === '1') return true;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (isIP(host) === 6) return false;
  if (isIP(host) === 4) {
    const [a, b] = host.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

const projects = [
  ...(await readJson('data/projects.json', [])),
  ...(await readJson('data/submissions.json', []))
];
const failed = all ? {} : await readJson(FAILED_FILE, {});

const todo = [];
for (const p of projects) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(p.id))) { console.log(`건너뜀 (id 형식): ${p.id}`); continue; }
  if (p.image) continue;
  if (!isPublicWebUrl(p.url)) { console.log(`건너뜀 (링크 형식): ${p.id}`); continue; }
  if (!all && await exists(`shots/${p.id}.jpg`)) continue;
  if ((failed[p.id] || 0) >= MAX_TRIES) { console.log(`건너뜀 (${MAX_TRIES}번 실패): ${p.id}`); continue; }
  todo.push(p);
}

console.log(`찍을 결과물 ${todo.length}개`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `need=${todo.length > 0}\n`);
if (checkOnly || todo.length === 0) process.exit(0);

const { chromium } = await import('playwright');
await mkdir('shots', { recursive: true });
const browser = await chromium.launch();
let failures = 0;
for (const p of todo) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
  const page = await context.newPage();
  // 페이지가 안쪽 주소로 옮겨 가거나 그런 주소를 불러오는 것도 막는다.
  await page.route('**/*', (route) => (isPublicWebUrl(route.request().url()) ? route.continue() : route.abort()));
  try {
    await page.goto(p.url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000); // 화면이 다 그려질 시간을 준다.
    await page.screenshot({ path: `shots/${p.id}.jpg`, type: 'jpeg', quality: 80 });
    delete failed[p.id];
    console.log(`찍음: ${p.id}`);
  } catch (err) {
    failures += 1;
    failed[p.id] = (failed[p.id] || 0) + 1;
    console.log(`실패: ${p.id} (${err.message.split('\n')[0]})`);
  } finally {
    await context.close();
  }
}
await browser.close();
await writeFile(FAILED_FILE, JSON.stringify(failed, null, 2) + '\n');
console.log(failures ? `${failures}개는 찍지 못했어요. 사이트에는 "준비 중" 문구가 대신 보여요.` : '끝났어요.');
