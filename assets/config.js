// 사이트 설정. 구글 폼과 시트를 바꾸면 이 파일만 고치면 된다.
globalThis.SITE_CONFIG = {
  // 구글 시트를 "웹에 게시"해서 받은 CSV 주소. 비어 있으면 등록된 결과물을 불러오지 않는다.
  sheetCsvUrl: '',
  // 구글 폼의 응답 주소 (https://docs.google.com/forms/d/e/<폼 ID>/formResponse). 비어 있으면 등록 양식을 닫아 둔다.
  formAction: '',
  // 구글 폼 질문별 입력 이름 (entry.숫자)
  formFields: {
    title: '',
    summary: '',
    author: '',
    category: '',
    url: '',
    description: ''
  },
  // 피드백(utterances)이 쌓이는 저장소. 비어 있으면 피드백 창을 띄우지 않는다.
  feedbackRepo: 'ggpt1010-byte/Korea_Univ_AI_Study'
};
