// 사이트 설정.
globalThis.SITE_CONFIG = {
  // Supabase 프로젝트 주소와 공개 키(publishable 또는 anon). 공개 키는 사이트에 넣어도 되는 키다.
  // 절대 secret / service_role 키를 넣지 말 것. 둘 다 비어 있으면 등록, 그룹, 좋아요 기능을 닫아 둔다.
  supabaseUrl: 'https://ycvnnwsokjysgunwinma.supabase.co',
  supabaseKey: 'sb_publishable_NVvzHrqlAEqNRAnzD1W2xA_b3Kajgf6',
  // 사이트 매니저의 계정 번호(내 정보 화면 아래쪽의 g로 시작하는 값). 모든 결과물에 예상 가치를 달 수 있다.
  // 서버 권한은 Supabase 의 managers 표가 정한다. 여기는 화면 표시에만 쓰므로 두 곳을 같이 고칠 것.
  // 방장은 따로 적지 않아도 된다. 방을 만든 사람이 그 방의 방장이다.
  managers: [],
  // 방 목록 맨 위(#1)에 둘 방 이름
  featuredGroup: '고려대학교 AI창업 모임',
  // 검증한 사람이 이만큼 모이면 "검증됨" 표시가 붙는다.
  verifyGoal: 3,
  // 구글 로그인 키 (....apps.googleusercontent.com). 넣으면 오른쪽 위에 로그인과 내 정보 메뉴가 생기고,
  // 로그인한 사람의 이름이 "만든 사람" 칸에 자동으로 들어간다. 비어 있으면 로그인 없이 직접 적는다.
  googleClientId: '961375734681-0kf78dhibbk59tqaf31adjlt50lhgi1m.apps.googleusercontent.com',
  // 피드백(utterances)이 쌓이는 저장소. 비어 있으면 피드백 창을 띄우지 않는다.
  feedbackRepo: 'ggpt1010-byte/Korea_Univ_AI_Study'
};
