// 사이트 설정. 구글 폼과 시트를 바꾸면 이 파일만 고치면 된다.
globalThis.SITE_CONFIG = {
  // 구글 시트를 "웹에 게시"해서 받은 CSV 주소. 비어 있으면 등록된 결과물을 불러오지 않는다.
  sheetCsvUrl: '',
  // 구글 폼의 응답 주소 (https://docs.google.com/forms/d/e/<폼 ID>/formResponse). 비어 있으면 등록 양식을 닫아 둔다.
  formAction: 'https://docs.google.com/forms/d/e/1FAIpQLSfPgvQD1RAFrj3nOx_RSeDHmKpnheEo6lJCMMd7jLmeM_JfSw/formResponse',
  // 구글 폼 질문별 입력 이름 (entry.숫자)
  formFields: {
    title: '',
    summary: '',
    author: '',
    category: '',
    url: '',
    description: ''
  },
  // 구글 로그인 키 (....apps.googleusercontent.com). 넣으면 등록 양식에 구글 로그인 버튼이 생기고,
  // 로그인한 사람의 이름이 "만든 사람" 칸에 자동으로 들어간다. 비어 있으면 버튼 없이 직접 적는다.
  googleClientId: '',
  // 피드백(utterances)이 쌓이는 저장소. 비어 있으면 피드백 창을 띄우지 않는다.
  feedbackRepo: 'ggpt1010-byte/Korea_Univ_AI_Study'
};
