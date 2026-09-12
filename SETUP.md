# MOA 실제 운영 설정

## Vercel 환경변수

필수:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- CREDENTIALS_ENCRYPTION_KEY
- APP_URL

Instagram:
- META_APP_ID
- META_APP_SECRET
- META_GRAPH_VERSION
- META_WEBHOOK_VERIFY_TOKEN

네이버 로컬 수집기:
- COLLECTOR_SHARED_SECRET

AI 답변 추천:
- OPENAI_API_KEY
- AI_MODEL

채널톡 Webhook:
- CHANNEL_TALK_WEBHOOK_SECRET

## 서비스별 인증 위치

### Instagram
MOA 웹 > 채널 연결 > Instagram > **Instagram 인증**

아이디/비밀번호를 MOA에 저장하지 않고 OAuth로 연결합니다.

### 네이버 블로그
MOA 웹 > 채널 연결 > 네이버 블로그 > **블로그 ID / 수집기 설정**

비밀번호는 MOA에 입력하지 않습니다.
`tools/naver-collector`를 PC에서 실행하고 Playwright 브라우저에서 직접 로그인합니다.

### 카카오톡 채널
카카오 상담톡을 채널톡에 먼저 연결한 뒤,
MOA 웹 > 채널 연결 > 카카오 상담톡 > **OpenAPI 키 설정**

채널톡에서 발급한 Access Key / Access Secret을 입력합니다.

## 보안

앱 내부 로그인은 제거되어 있습니다.
따라서 Vercel 프로젝트 자체의 Deployment Protection 또는 접근 제한을 사용하는 것을 권장합니다.
SUPABASE_SERVICE_ROLE_KEY와 기타 Secret은 브라우저 코드에 노출하지 않습니다.
