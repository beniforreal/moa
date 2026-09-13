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


## Android APK + 푸시 알림

MOA Android 앱 소스는 `android-app/`에 있고, APK는 Vercel에 올리지 않습니다.
GitHub Actions의 `Build MOA Android APK` 워크플로에서만 빌드하고 결과물 `MOA.apk`를 GitHub Actions Artifact로 받습니다.

### 1) Firebase Android 앱 생성

Firebase Console에서 Android 앱을 만들고 패키지 이름을 아래 값으로 등록합니다.

- `com.moa.app`

다운로드한 `google-services.json` 파일은 저장소에 직접 커밋하지 않습니다.
파일 전체를 base64로 인코딩한 값을 GitHub Repository Secret에 아래 이름으로 저장합니다.

- `GOOGLE_SERVICES_JSON_BASE64`

### 2) GitHub Repository Variable

MOA 실제 운영 주소를 Repository Variable로 추가합니다.

- 이름: `MOA_APP_URL`
- 값 예시: `https://your-moa-domain.example`

반드시 실제 Vercel 운영 주소 또는 연결한 HTTPS 커스텀 도메인을 사용합니다.

### 3) Vercel 서버 환경변수

Firebase Console > Project settings > Service accounts에서 서버용 서비스 계정 JSON을 발급한 뒤
JSON 전체 내용을 Vercel Environment Variable에 한 줄 JSON 문자열로 저장합니다.

- `FIREBASE_SERVICE_ACCOUNT_JSON`

이 값은 APK나 GitHub 저장소에 넣지 않습니다.

### 4) APK 빌드 및 다운로드

GitHub 저장소 > Actions > `Build MOA Android APK` > Run workflow를 실행합니다.
완료 후 해당 실행 화면 하단 Artifacts의 `MOA-Android-APK`를 내려받으면 ZIP 안에 `MOA.apk`가 있습니다.

GitHub Actions Artifact는 현재 30일 보관하도록 설정되어 있습니다.

### 5) 공기계 설치

Android에서 출처를 알 수 없는 앱 설치를 허용한 뒤 `MOA.apk`를 설치합니다.
앱 최초 실행 시 알림 권한을 허용하고 MOA에 로그인하면 FCM 기기 토큰이 서버에 등록됩니다.

새 Instagram 댓글/DM, 네이버 수집 댓글, 카카오 상담톡 항목이 새로 수집될 때 등록된 Android 기기로 푸시를 전송합니다.
