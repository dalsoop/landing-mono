# 0004. 사이트를 `<폴더>.ranode.usercontent.kr` 로 옮긴다

- 날짜: 2026-11-10
- 상태: 유효
- 근거: 소유자 결정(2026-11-10, 코디네이터 세션 m5m1-da) "진행해 가이긴 한데 ranode 로 붙어서 나가" — cuAlign 소개 사이트를 내용 전용 도메인 `usercontent.kr` 의 ranode 아래(`cualign.ranode.usercontent.kr`)로 옮긴다. 도메인 규칙은 gujoai/infra/host-infra 결정 0010(이름 꼴 `<서비스>.<조직>.<도메인>`)과 0014(로그인 없는 우리 소개 사이트는 `<서비스>.ranode.usercontent.kr` 에 둘 수 있다)

## 배경

- 사이트는 `<폴더>.external.kr` 이었다(0002). 우리 도메인 규칙은 `external.kr` 이름을 `<서비스>.<조직>.external.kr` 꼴로 짓고, 2026-11-08 에 와일드카드 `*.external.kr` 레코드가 지워져 `cualign.external.kr` 만 따로 레코드를 받았다.
- 옛 호스팅 프로토타입 `cualign-proto.external.kr`(Basic 인증)은 와일드카드가 가리키던 사무실 주소가 2026-11-08 이전부터 응답하지 않았고(시간 초과), 와일드카드 삭제 뒤로는 이름도 없다.

## 결정

- 루트 도메인을 `ranode.usercontent.kr` 로 바꾼다. 폴더 `apps/<폴더>/` 는 `https://<폴더>.ranode.usercontent.kr` 이다.
- 두 단계 이름이라 영역의 무료 인증서(`*.usercontent.kr`)가 덮지 못한다. 그래서 라우트가 아니라 Worker 사용자 도메인(Custom Domain)으로 붙인다. Cloudflare 가 그 이름의 DNS 레코드(AAAA `100::`, 프록시)와 인증서를 만든다.
- 옛 이름 `<폴더>.external.kr` 은 라우트를 남기고 Worker 가 같은 경로·질의의 새 주소로 301 을 돌려준다. 2026-12-10 에 워크플로의 `LEGACY_ROOT_DOMAIN`, Worker 의 넘겨주기, Cloudflare 의 `cualign.external.kr` DNS 레코드를 지운다.
- `usercontent.kr` 은 올린 HTML 과 같은 등록 도메인이다. 그래서 Worker 는 모든 응답에 `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` 을 붙이고 `Set-Cookie` 를 지운다. 사이트는 쿠키를 쓰지 않는다. 양식은 지금처럼 `Origin` 이 자기 origin 과 같을 때만 저장한다.
- 응답하는 프로토타입이 없으므로 `app.js` 의 `LAUNCH_URL` 을 비우고, 비어 있으면 "Launch prototype" 버튼과 "Access required" 표시를 숨긴다. 문서의 프로토타입 주소도 지운다. 데모 요청 양식은 그대로 둔다.

## 대안

- **라우트 + 영역 고급 인증서(Advanced Certificate Manager)**: 영역마다 월 요금이 든다. 사용자 도메인은 이름마다 인증서를 따로 받아 요금이 없다.
- **옛 이름을 Cloudflare 페이지 규칙으로 넘겨주기**: 저장소 밖 설정이 생기고, 지우는 날을 코드에서 볼 수 없다. Worker 넘겨주기는 PR 하나로 지운다.

## 결과

- 새 사이트는 여전히 `apps/<이름>/index.html` 하나로 열린다. 첫 배포 때 인증서 발급에 몇 분이 걸릴 수 있다.
- 배포 토큰은 usercontent.kr 사용자 도메인과(넘겨주기 기간) external.kr 라우트를 붙일 수 있어야 한다.
- 로그인·세션이 필요하거나 쿠키를 쓰는 사이트는 이 저장소에 둘 수 없다. 그런 사이트는 다른 자리(예: `external.kr`)로 간다.
