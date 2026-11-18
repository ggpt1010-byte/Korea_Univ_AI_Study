# AI개발모임

모임원이 만든 AI 프로젝트를 올리고 서로 써보는 사이트입니다. 빌드 과정이 없는 정적 사이트라서 GitHub Pages에 그대로 올라갑니다.

## 구성

- `index.html` 결과물 목록, `project.html` 결과물 상세, `submit.html` 결과물 등록(준비 중)
- `data/projects.json` 결과물 데이터
- `shots/` 체험 링크의 첫 화면 이미지. `data/projects.json`이 바뀌면 GitHub Actions가 자동으로 찍어 넣습니다.
- `scripts/capture.mjs` 첫 화면을 찍는 스크립트

## 내 컴퓨터에서 보기

```
python3 -m http.server 8000
```

그다음 브라우저에서 http://localhost:8000 을 엽니다.

## 결과물 데이터 형식

```json
{
  "id": "영문-숫자-하이픈",
  "title": "프로젝트 이름",
  "summary": "한 줄 소개",
  "author": "만든 사람",
  "category": "챗봇 | 도구 | 이미지 | 게임 | 기타",
  "url": "https://체험-링크",
  "description": "자세한 설명 (선택)",
  "howto": ["쓰는 방법 (선택)"],
  "tools": ["만드는 데 쓴 것 (선택)"],
  "image": "직접 올린 대표 이미지 주소 (선택, 없으면 첫 화면을 자동으로 찍음)",
  "createdAt": "2026-11-18"
}
```
