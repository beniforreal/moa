# MOA 연결 설정 가이드

이 문서는 MOA를 실제 운영 데이터 기반으로 연결할 때 필요한 설정을 정리합니다.

## 1. 현재 구조

MOA는 단일 운영자용입니다.

- 앱 내부 로그인 없음
- 가상/데모 데이터 없음
- Next.js 서버가 Supabase에 직접 접근
- 브라우저에는 Supabase 관리자 키를 노출하지 않음
- Instagram: OAuth
- 네이버 블로그: 로컬 브라우저 수집기
- 카카오톡 채널: 채널톡 OpenAPI/Webhook 기반

## 2. Supabase

현재 MOA Supabase 프로젝트 URL:

```text
https://putirvwsqonalnqqebuy.supabase.co
```

현재 생성된 운영 테이블:

- clients
- integrations
- posts
- inbox_items
- outbox_jobs
- notifications
- audit_logs

### Vercel에 반드시 넣을 환경변수

#### SUPABASE_URL

```text
SUPABASE_URL=https://putirvwsqonalnqqebuy.supabase.co
```

#### SUPABASE_SECRET_KEY 권장

Supabase Dashboard:

```text
moa 프로젝트
→ Settings
→ API Keys
→ Publishable and secret API keys
```

에서 서버용 Secret Key(`sb_secret_...`)를 생성/복사합니다.

Vercel에는:

```text
SUPABASE_SECRET_KEY=sb_secret_...
```

형태로 등록합니다.

이 키는 절대로 GitHub, 브라우저 코드, NEXT_PUBLIC_* 환경변수에 넣지 않습니다.

### 기존 service_role 키도 지원

아직 legacy 키를 쓰는 경우:

```text
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

도 지원합니다.

다만 새 설정에서는 `SUPABASE_SECRET_KEY` 사용을 권장합니다.

## 3. Vercel 환경변수 등록 위치

```text
Vercel Dashboard
→ moa-social-workspace 프로젝트
→ Settings
→ Environment Variables
```

최소한 아래 2개가 있어야 고객사 추가/조회가 작동합니다.

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

환경변수를 추가하거나 수정한 뒤 반드시 새 Deployment를 실행해야 합니다.

```text
Deployments
→ 최신 Deployment
→ ...
→ Redeploy
```

## 4. 암호화 키

Instagram 토큰, 채널톡 Secret 같은 인증정보를 저장하려면 다음 값도 필요합니다.

```text
CREDENTIALS_ENCRYPTION_KEY
```

Windows PowerShell에서 32바이트 랜덤 Base64 키 생성:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

출력된 문자열을 Vercel의 `CREDENTIALS_ENCRYPTION_KEY` 값으로 저장합니다.

GitHub에는 저장하지 않습니다.

## 5. APP_URL

OAuth callback과 외부 Webhook을 위해 실제 운영 주소를 등록합니다.

예:

```text
APP_URL=https://실제-moa-도메인.vercel.app
```

Production URL을 사용합니다.

## 6. Instagram

Vercel 환경변수:

```text
META_APP_ID
META_APP_SECRET
META_GRAPH_VERSION
META_WEBHOOK_VERIFY_TOKEN
APP_URL
CREDENTIALS_ENCRYPTION_KEY
```

MOA:

```text
채널 연결
→ 고객사
→ Instagram
→ Instagram 인증
```

Instagram ID/비밀번호는 MOA에 저장하지 않습니다.

## 7. 네이버 블로그

네이버 비밀번호는 Vercel/Supabase/MOA에 저장하지 않습니다.

MOA:

```text
채널 연결
→ 네이버 블로그
→ 블로그 ID / 수집기 설정
```

PC 로컬 수집기:

```text
tools/naver-collector/
```

Vercel에는 다음 값을 등록합니다.

```text
COLLECTOR_SHARED_SECRET=임의의_긴_비밀문자열
```

로컬 수집기의 `.env`에는 동일한 값을:

```text
COLLECTOR_SECRET=동일한_값
```

으로 설정합니다.

네이버 로그인은 Playwright가 연 브라우저에서 직접 진행합니다.

## 8. 카카오톡 채널 / 채널톡

카카오 상담톡을 채널톡에 연결한 뒤 MOA에서는 채널톡 OpenAPI를 사용합니다.

MOA:

```text
채널 연결
→ 카카오 상담톡
→ OpenAPI 키 설정
```

입력:

```text
Access Key
Access Secret
```

Webhook을 사용할 경우 Vercel:

```text
CHANNEL_TALK_WEBHOOK_SECRET
```

을 추가합니다.

## 9. AI 답변 추천

Vercel 환경변수:

```text
OPENAI_API_KEY
AI_MODEL
```

MOA는 자동 답변을 바로 보내지 않고:

```text
AI 추천 → 사람 승인 → 전송
```

흐름을 사용합니다.

## 10. 현재 고객사 추가 오류

화면에:

```text
Supabase 설정이 필요합니다.
```

가 뜨면 Vercel 런타임에 Supabase 환경변수가 없는 상태입니다.

가장 먼저 아래 두 값만 등록하면 됩니다.

```text
SUPABASE_URL=https://putirvwsqonalnqqebuy.supabase.co
SUPABASE_SECRET_KEY=Supabase에서 발급한 sb_secret_... 키
```

등록 후 Redeploy하면 고객사 추가 기능이 Supabase의 `clients` 테이블을 사용합니다.

## 11. 보안 주의

다음 값은 GitHub에 커밋하지 않습니다.

- SUPABASE_SECRET_KEY
- SUPABASE_SERVICE_ROLE_KEY
- CREDENTIALS_ENCRYPTION_KEY
- META_APP_SECRET
- OPENAI_API_KEY
- CHANNEL_TALK_WEBHOOK_SECRET
- COLLECTOR_SHARED_SECRET

앱 내부 로그인을 제거했으므로 Vercel Deployment Protection 또는 별도 접근 제한 사용을 권장합니다.
