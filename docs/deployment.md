# Docker 및 self-hosted runner 배포

## 구조

```text
Internet → TLS/WAF → gateway
                     ├─ /      → frontend
                     └─ /api/* → backend → PostgreSQL
```

- 호스트에는 gateway 포트만 공개합니다.
- Backend와 PostgreSQL은 Docker 내부 네트워크에서만 접근합니다.
- Frontend는 DB에 직접 연결하지 않습니다.
- 가상 회원 10명은 `demo01@example.test`부터 `demo10@example.test`까지 생성됩니다.

## 로컬 실행

```powershell
Copy-Item .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://127.0.0.1:7070/api/health/ready
```

`.env`의 모든 placeholder를 서로 다른 긴 비밀번호로 변경하고 Git에 commit하지 마세요.

## GitHub 설정

Self-hosted runner 요구사항:

- Linux x64
- Docker Engine과 Docker Compose plugin
- runner label: `self-hosted`, `linux`, `x64`, `login-system`
- GitHub로 outbound HTTPS 허용

Repository 또는 production Environment variables:

- `PUBLIC_ORIGIN`
- `APP_BIND_ADDRESS`
- `APP_PORT`
- `POSTGRES_DB`
- `POSTGRES_ADMIN_USER`

Environment secrets:

- `POSTGRES_ADMIN_PASSWORD`
- `APP_DB_PASSWORD`
- `DEMO_USER_PASSWORD`

`main` push 시 GitHub-hosted runner가 테스트·audit·Compose 검증을 수행합니다. 검증과 production environment 승인을 통과하면 self-hosted runner가 commit SHA 이미지들을 빌드하고 Compose를 갱신합니다. readiness 실패 시 이전 애플리케이션 이미지로 되돌립니다.

## 운영 전 필수 작업

- 실제 이메일 검증, OTP, 복구 링크와 Outbox Worker
- OIDC 공급자 연동
- managed PostgreSQL HA, TLS, PITR와 복원 시험
- 운영 TLS/WAF 및 외부 rate limit
- 개인정보 보존·삭제와 변경 방지 감사 정책
- 부하·보안·장애 전환 시험

현재 구성은 개발·검증용이며 위 항목 승인 전에는 실제 회원정보를 받지 않습니다.
