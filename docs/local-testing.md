# 로컬 1:1 테스트

운영 배포, 운영 DB 변경, Git 푸시 없이 실행한다.

1. Docker Desktop을 실행한다.
2. `supabase start -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor`
3. `node scripts/setup-local-testing.mjs`
4. `npm run dev`를 재시작한다.
5. `http://localhost:3000/login`에서 테스트 계정 A/B와 `.local-testing.json`의 각 암호로 로그인한다.

한 컴퓨터에서는 일반 창과 시크릿 창 또는 서로 다른 브라우저를 사용한다. 같은 브라우저의 두 탭은 쿠키를 공유하므로 서로 다른 계정으로 테스트할 수 없다.
두 계정이 같은 시간제를 골라 대기열에 들어가면 매칭된다. 전적과 기보는 로컬 DB에만 저장된다.

## 외부 상대

`cloudflared tunnel --url http://localhost:3000`으로 나온 HTTPS 주소를 두 사람 모두 사용한다.
상대에게는 그 주소와 테스트 계정 B 암호만 별도 전달한다. 개발용 서버와 테스트 데이터가 외부에 공개되므로 신뢰하는 상대와 짧게 테스트한 후 터널을 종료한다.
DB/인증 서버 포트는 터널로 열지 않는다. Realtime 대신 5초 폴링으로 상대 수가 갱신되므로 운영 Realtime 성능 테스트와는 다르다.
외부 호스트가 개발 서버에서 거절되면 출력된 정확한 터널 호스트 하나만 Vite allowedHosts에 추가한다. `allowedHosts: true`는 사용하지 않는다.

테스트 로그인은 production 빌드에서 차단된다. 개발 서버에서도 명시적 플래그와 127.0.0.1의 지정 DB/인증 포트가 모두 일치해야 한다.
`.dev.vars`와 `.local-testing.json`에는 로컬 전용 키와 암호가 있으므로 Git에 포함하지 않는다.
종료는 개발 서버/터널에서 Ctrl+C, DB는 `supabase stop`을 사용한다. 데이터 삭제 옵션은 사용하지 않는다.
