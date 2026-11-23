// 사이트 설정. 구글 폼과 시트를 바꾸면 이 파일만 고치면 된다.
globalThis.SITE_CONFIG = {
  // 구글 시트를 "웹에 게시"해서 받은 CSV 주소. 비어 있으면 등록된 결과물을 불러오지 않는다.
  sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmKPd2pGDH_A4gQ2LpQopjaAYF50CE4us0tAJyy8tiz2evXk3i_mS6znWJAoW8Pt5EcK9-KRtY8Zfm/pub?gid=197632755&single=true&output=csv',
  // 구글 폼의 응답 주소 (https://docs.google.com/forms/d/e/<폼 ID>/formResponse). 비어 있으면 등록 양식을 닫아 둔다.
  formAction: 'https://docs.google.com/forms/d/e/1FAIpQLSfPgvQD1RAFrj3nOx_RSeDHmKpnheEo6lJCMMd7jLmeM_JfSw/formResponse',
  // 구글 폼 질문별 입력 이름 (entry.숫자)
  formFields: {
    title: 'entry.2139255545',
    summary: 'entry.912478157',
    author: 'entry.1105255090',
    category: 'entry.397329402',
    url: 'entry.1675608440',
    description: 'entry.1512553475',
    owner: 'entry.2112092626', // 계정 번호(구글 로그인한 사람만, 알아볼 수 없게 바꾼 값)
    group: 'entry.604167476',      // "그룹 번호" 질문 (단답형). 비어 있으면 그룹에 올리기와 공개 범위 고르기를 숨긴다.
    visibility: 'entry.1275904896'  // "공개 범위" 질문 (단답형, 공개 또는 비공개)
  },
  // 비밀번호 그룹. 결과물 폼과 다른 "그룹 폼"을 하나 더 쓴다. 셋 다 채워야 그룹 기능이 열린다.
  // 그룹 폼 응답 시트를 "웹에 게시"한 CSV 주소
  groupSheetCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrM8SpnQCGcm0iAbmbEJjvv5tpapldrxN3DUaRQPSuAg-Rlke7lGXdkhKm-J3NLRSobcTGEqIKgJvu/pub?gid=1592204593&single=true&output=csv',
  // 그룹 폼의 응답 주소 (https://docs.google.com/forms/d/e/<폼 ID>/formResponse)
  groupFormAction: 'https://docs.google.com/forms/d/e/1FAIpQLSdZ5FtcFwDLDfsL9IQ9JulLaRK5ZgzJJLdANHivQiCkbxe9Ag/formResponse',
  // 그룹 폼 질문별 입력 이름 (entry.숫자). 질문은 모두 단답형.
  groupFormFields: {
    kind: 'entry.1701457613',    // 기록 종류 (그룹 만들기, 검증, 검증 취소)
    group: 'entry.742319868',   // 그룹 번호
    name: 'entry.959786557',    // 그룹 이름
    intro: 'entry.1090802173',   // 그룹 소개
    pass: 'entry.171515780',    // 비밀번호 값 (비밀번호를 알아볼 수 없게 바꾼 값)
    target: 'entry.1827549241',  // 대상 결과물
    voter: 'entry.2061482021'    // 누른 사람 (알아볼 수 없게 바꾼 값)
  },
  // 검증한 사람이 이만큼 모이면 "검증됨" 표시가 붙는다.
  verifyGoal: 3,
  // 구글 로그인 키 (....apps.googleusercontent.com). 넣으면 오른쪽 위에 로그인과 내 정보 메뉴가 생기고,
  // 로그인한 사람의 이름이 "만든 사람" 칸에 자동으로 들어간다. 비어 있으면 로그인 없이 직접 적는다.
  googleClientId: '961375734681-0kf78dhibbk59tqaf31adjlt50lhgi1m.apps.googleusercontent.com',
  // 피드백(utterances)이 쌓이는 저장소. 비어 있으면 피드백 창을 띄우지 않는다.
  feedbackRepo: 'ggpt1010-byte/Korea_Univ_AI_Study'
};
