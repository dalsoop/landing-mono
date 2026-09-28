# cualign

cuAlign을 소개하는 영어 정적 랜딩 페이지입니다. 빌드 단계 없이 이 폴더의 파일을 그대로 서빙하고, <https://cualign.external.kr> 에서 열립니다.

- `index.html`, `styles.css`, `app.js`: 메인 페이지와 인터랙션(스크롤 등장, 히어로 처방 입력 타이핑, 에이전트 대화 데모 재생·다시 보기, 단계 슬라이더, 실행 전 EULA 동의 창)
- `hero3d.js`: 히어로의 3D 치열. 끌어서 돌릴 수 있습니다. three.js 0.160.0 을 cdnjs 에서 받아 샘플 케이스 000097 의 발치 계획을 반복 재생합니다. 발치할 두 치아(14·24)를 색 변화 없이 위로 빼면서 흐리게 한 뒤, 나머지 치아가 단계별로 공간을 메웁니다. 치아는 아이보리, 잇몸은 분홍, 조명은 중립 흰색입니다.
- `hero-fx.js`: 히어로 3D 위에 얹는 투명 교정장치 트레이 효과. 27단계를 트레이 6개로 나눠, 다음 단계 모양의 트레이(치아 표면을 0.5mm 부풀린 셸)가 씌워지고 치아가 그 안으로 움직인 뒤 벗겨집니다. 새 트레이마다 흰 반사 띠가 한 번 지나갑니다. `hero3d.js` 는 `createFx()` 가 돌려준 `playS`·`update` 로 이 효과를 부릅니다. WebGL 이 없거나 동작 줄이기 설정이면 `app.js` 가 이 모듈을 부르지 않고 3D 자리를 비워 둡니다. 로딩용 포스터 이미지는 두지 않습니다.
- `robots.txt`, `sitemap.xml`: 검색 엔진용 파일. 페이지 경로가 바뀌면 `sitemap.xml` 도 고칩니다.
- `assets/og.png`: 공유 미리보기 이미지(1200×630). 히어로 3D 를 투명 배경으로 캡처해 로고·문구와 합성했습니다. `favicon.svg`, `favicon-32.png`, `favicon.png`, `apple-touch-icon.png` 는 파비콘 세트입니다.
- `request/`, `forms.json`: 데모 요청 양식 페이지와 감사 페이지, 그리고 router 의 `/_forms/<양식>` 이 받을 필드·필수 항목·선택지·길이 제한·되돌아갈 주소를 정한 설정입니다.
- `eula.html`: 연구용 프로토타입 최종 사용자 사용권 계약. 문구를 바꾸면 `app.js` 의 `EULA_VERSION` 을 함께 올려야 동의를 다시 받습니다.
- `assets/`: 로고(cuAlign 저장소의 `static/logo.png`)와 v2 화면(`/ui/v2/`, 샘플 케이스 000001·000131) 캡처. 제품 화면은 캡처할 때만 화면의 한국어 문구를 영어로 바꿔서 찍었습니다(cuAlign 코드는 그대로입니다).
- `assets/hero-case.json`: cuAlign main 의 `cualign plan "14번과 24번 발치로" --case poseidon-000097`(발치안 27단계, 규칙 통과) 결과와 `/api/cases/poseidon-000097/mesh` 에서 좌표를 소수 셋째 자리로 줄이고 쓰는 필드만 남긴 데이터. `removed` 에 뺀 치아(Universal 5·12)를 적습니다.

내용은 cuAlign 저장소(<https://github.com/dalsoop/nvidia-hackaton-2026-one>)의 `apps/cualign-prototype` README, `docs/OVERVIEW.md`, `docs/NVIDIA_STACK.md`, `docs/VERIFICATION.md`, `evals/` 에 적힌 사실만 옮깁니다. 그 문서의 범위나 한계가 바뀌면 이 페이지도 함께 고칩니다.
