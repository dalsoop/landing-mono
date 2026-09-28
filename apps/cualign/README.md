# cualign

cuAlign을 소개하는 영어 정적 랜딩 페이지입니다. 빌드 단계 없이 이 폴더의 파일을 그대로 서빙하고, <https://cualign.external.kr> 에서 열립니다.

- `index.html`, `styles.css`, `app.js`: 메인 페이지와 인터랙션(스크롤 등장, 기능 탭, 워크플로 진행 표시, 단계 슬라이더, 실행 전 EULA 동의 창)
- `hero3d.js`: 히어로의 3D 치열. three.js 0.160.0 을 cdnjs 에서 받아 샘플 케이스 000131 의 확장 계획을 단계 0부터 끝까지 반복 재생합니다. WebGL 이 없거나 동작 줄이기 설정이면 `app.js` 가 이 모듈을 부르지 않고 `assets/hero-poster.webp` 만 보여 줍니다.
- `eula.html`: 연구용 프로토타입 최종 사용자 사용권 계약. 문구를 바꾸면 `app.js` 의 `EULA_VERSION` 을 함께 올려야 동의를 다시 받습니다.
- `assets/`: 로고(cuAlign 저장소의 `static/logo.png`)와 v2 화면(`/ui/v2/`, 샘플 케이스 000001·000131) 캡처. 제품 화면은 캡처할 때만 화면의 한국어 문구를 영어로 바꿔서 찍었습니다(cuAlign 코드는 그대로입니다).
- `assets/hero-case.json`: v2 서버의 `/api/cases/poseidon-000131/mesh` 와 통과한 확장 계획(`/api/plans/<id>`)에서 좌표를 소수 셋째 자리로 줄이고 쓰는 필드만 남긴 데이터

내용은 cuAlign 저장소(<https://github.com/dalsoop/nvidia-hackaton-2026-one>)의 `apps/cualign-prototype` README, `docs/OVERVIEW.md`, `docs/NVIDIA_STACK.md` 에 적힌 사실만 옮깁니다. 그 문서의 범위나 한계가 바뀌면 이 페이지도 함께 고칩니다.
