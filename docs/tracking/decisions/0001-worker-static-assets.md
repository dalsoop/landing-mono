# 0001. Cloudflare Pages 대신 Worker 정적 자산으로 배포한다

- 날짜: 2026-09-28
- 상태: 유효
- 근거 커밋: `e8aad82`

## 배경

처음 구성(`1cc5f0f`, `72a90e7`)은 사이트를 Cloudflare Pages 프로젝트 `landing-mono`로 배포하고 `_worker.js`로 호스트별 폴더를 고르는 방식이었다. 그러나 저장소 시크릿으로 쓸 수 있는 Cloudflare 토큰은 Workers 권한만 있고 Pages 권한이 없었다(`e8aad82` 커밋 메시지). Pages 방식으로 돈 첫 두 배포 실행은 시크릿이 아직 등록되기 전이라 시크릿 검사 단계에서 멈췄으므로, Pages 권한 부족은 실행 기록이 아니라 커밋 메시지로만 남아 있다.

## 결정

Pages를 쓰지 않고 Worker `landing-mono` 하나에 모든 사이트를 정적 자산(`ASSETS` 바인딩, `run_worker_first: true`)으로 올린다. 사이트마다 `<사이트>.external.kr/*` Worker 라우트를 붙여 해당 호스트의 요청만 Worker가 받게 한다. 라우팅 코드는 `router/_worker.js`에서 `router/worker.js`로 옮겼다.

## 대안

- **Cloudflare Pages 유지**: 토큰에 Pages 권한이 없어 배포가 실패했다. Pages를 쓰려면 권한이 다른 토큰을 새로 받아야 했다.

## 결과

- 배포 토큰에는 `Workers Scripts: Edit`(계정)과 `Workers Routes: Edit`(external.kr zone)만 있으면 된다.
- 라우트가 사이트 이름을 정확히 지정하므로 다른 서브도메인의 트래픽은 Worker를 거치지 않는다.
- 정적 자산이 스스로 만드는 `.html` 리다이렉트와 404 처리가 `/<사이트>/` 접두어와 부딪혀, Worker가 리다이렉트 `Location`에서 접두어를 떼고 404 페이지를 직접 골라야 한다(`2a40146`).
- 양식 엔드포인트처럼 서버 동작이 필요한 기능을 같은 Worker에 붙일 수 있게 되었고, R2 바인딩 `FORMS`가 여기에 더해졌다.
- Pages의 미리보기 배포(브랜치별 URL)는 없다. PR의 변경은 합치기 전까지 운영과 같은 환경에서 볼 수 없다.
