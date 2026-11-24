-- 구글 시트에서 옮겨 온 기존 데이터 (2026-11-24)
insert into public.projects (id,title,summary,author,category,url,description,owner,group_id,is_private,images,parent,changes,created_at) values ('sd9633ae8','스페이스X (이름 미정)','일론 머스크의 세계 정복 일지','김태현','게임','https://claude.ai/artifact/6pDVA4RGPF7huNmstbNgFh','스페이스X 스타쉽의 첫 궤도비행 성공 후 착륙을 보고 영감을 받아서 만듦.
초기에 우주선을 직접 발사 및 조종해서 투자금을 받고, (1-5분)
필요한 수화물을 운송하여 돈을 벌고, (5-10분)
자원을 가져와서 연료를 확보하고 우주선을 업그레이드 하고, (10-30분)
나중에는 우주로 자원을 운송하여 건설 및 확장하는 게임. (1시간 이상)',null,null,false,'{}',null,'','2026-11-20T14:28:12.000Z') on conflict (id) do nothing;
insert into public.projects (id,title,summary,author,category,url,description,owner,group_id,is_private,images,parent,changes,created_at) values ('sc55bea00','Composition Assistant (demo)','sns에 올릴 사진 구도 추천해주는 사이트입니다.','준영','사이트','https://claude.ai/artifact/SXKjkvCbeSL9aAthd7UY88','SNS시대에 사진을 업로드 하는 것은 일상이 되었으며 보정 어플이 만연하게 되었습니다. 그러나 실제로 사진의 실력을 판가름 하는 것은 구도이며 이는 시간을 투자하여 학습해야 하는 분야입니다. 본 사이트는 사진을 업로드 하면  자주 이용되는 20여가지의 구도중에 가장 적합한 구도를 찾아 적용시키는 것을 목적으로 합니다. # 현재 진행중입니다. 제가 갖고 있는 사진들을 학습시키며 오류를 고쳐나가는 중입니다.',null,null,false,'{}',null,'','2026-11-22T07:44:49.000Z') on conflict (id) do nothing;
insert into public.views (target, voter, day) values ('sc55bea00','d8d441b2dc0b2325d','2026-11-24') on conflict do nothing;
