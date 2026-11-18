// 결과물마다 체험 링크의 첫 화면을 찍어 shots/<id>.jpg 로 저장한다.
// 사용법: node scripts/capture.mjs        (아직 이미지가 없는 결과물만)
//         node scripts/capture.mjs --all  (전부 다시 찍기)
import { chromium } from 'playwright';
import { readFile, mkdir, access } from 'node:fs/promises';

const all = process.argv.includes('--all');
const projects = JSON.parse(await readFile('data/projects.json', 'utf8'));
await mkdir('shots', { recursive: true });

const exists = (path) => access(path).then(() => true, () => false);
const isWebUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

const browser = await chromium.launch();
let failed = 0;
for (const p of projects) {
  // 파일 이름으로 쓰기 안전한 id 만 처리한다.
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(p.id))) { console.log(`건너뜀 (id 형식): ${p.id}`); continue; }
  if (p.image) { console.log(`건너뜀 (직접 올린 이미지 있음): ${p.id}`); continue; }
  if (!isWebUrl(p.url)) { console.log(`건너뜀 (링크 형식): ${p.id}`); continue; }
  const out = `shots/${p.id}.jpg`;
  if (!all && await exists(out)) { console.log(`이미 있음: ${p.id}`); continue; }

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
  const page = await context.newPage();
  try {
    await page.goto(p.url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000); // 화면이 다 그려질 시간을 준다.
    await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
    console.log(`찍음: ${p.id}`);
  } catch (err) {
    failed += 1;
    console.log(`실패: ${p.id} (${err.message.split('\n')[0]})`);
  } finally {
    await context.close();
  }
}
await browser.close();
console.log(failed ? `${failed}개는 찍지 못했어요. 사이트에는 "준비 중" 문구가 대신 보여요.` : '끝났어요.');
