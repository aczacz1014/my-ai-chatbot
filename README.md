# 모아 AI 챗봇

HTML, CSS, JavaScript와 Node.js/Express로 만든 간단한 한국어 AI 챗봇입니다. OpenAI의 `gpt-4o-mini`를 사용합니다.

## 로컬 실행

Node.js 24.x가 필요합니다.

```sh
npm install
cp .env.example .env
```

`.env`의 `OPENAI_API_KEY` 값을 본인의 OpenAI API 키로 변경한 다음 실행하세요. API 키를 프런트엔드 파일에 넣거나 Git에 커밋하지 마세요.

```sh
npm run dev
```

브라우저에서 http://localhost:3000 을 여세요. 일반 실행은 `npm start`입니다.

## Vercel 배포

1. 이 프로젝트를 GitHub 등 Git 저장소에 올립니다. `.env`와 `node_modules`는 제외됩니다.
2. Vercel에서 **Add New → Project**로 저장소를 가져옵니다.
3. 프로젝트 루트를 이 폴더로 지정하고 Framework Preset은 **Express**를 사용합니다. `vercel.json`에도 설정되어 있습니다. 별도 빌드 명령과 Output Directory는 지정하지 않습니다.
4. Environment Variables에 `OPENAI_API_KEY`를 추가합니다. 사용할 환경(Production, Preview 등)에 적용합니다.
5. **Deploy**를 실행합니다. 환경변수를 나중에 변경했다면 재배포합니다.

정적 화면은 Vercel CDN이 `public/`에서 제공하며, Express 앱은 `src/app.js`의 기본 내보내기를 통해 실행됩니다. 로컬에서만 `scripts/start.js`가 포트를 열며, 배포 진입점은 직접 `listen()`을 호출하지 않습니다. CLI로 배포하려면 프로젝트 폴더에서 `npx vercel`을 실행할 수도 있습니다.

### 배포 설정

- `framework: "express"`: Vercel의 기본 Express 지원을 사용합니다. API 요청은 Express 앱으로 전달되고 `public/` 파일은 정적으로 제공됩니다.
- `installCommand: "npm ci"`: 커밋된 `package-lock.json`을 사용해 동일한 버전의 의존성을 설치합니다.
- `functions["src/app.js"].maxDuration: 60`: OpenAI 호출의 45초 제한 이후 오류 응답을 보낼 수 있도록 여유를 둡니다.
- Node.js 버전은 `package.json`에서 `24.x`로 지정합니다.

기존 Vercel 프로젝트의 **Settings → Build and Deployment**에 다른 프레임워크, Build Command 또는 Output Directory 오버라이드가 있으면 제거하고 Express 기본값을 사용하세요. Output Directory를 `public`으로 직접 지정하지 마세요. 정적 사이트로만 배포하면 `/api/chat`이 실행되지 않습니다. CLI는 Express를 지원하는 47.0.5 이상의 버전을 사용하세요.

배포 후 `/`에서 화면이 표시되고 `/styles.css`, `/app.js`가 로드되는지 확인하세요. `POST /api/chat`에 `{"messages":[{"role":"user","content":"안녕"}]}`를 보내면 API 키가 설정된 경우 `{"reply":"..."}`를 반환합니다. 503과 `OPENAI_API_KEY` 안내가 반환되면 Vercel 환경변수 설정과 재배포 여부를 확인하세요. 404가 반환되면 프로젝트 루트와 프레임워크 설정을 확인하세요. `/api/chat`은 POST 전용이므로 주소창에서 GET으로 열면 404가 정상입니다.

## 동작과 제한

- 브라우저 메모리에 사용자/AI 메시지를 보관하고, 매 요청마다 이전 대화 전체와 새 질문을 `/api/chat`에 전달합니다. 서버는 시스템 지침을 추가하여 OpenAI Chat Completions API를 호출합니다.
- 데이터베이스, 파일 저장, localStorage를 사용하지 않습니다. 새로고침, 탭 닫기, **새 대화**를 누르면 기록이 사라집니다. 각 탭의 기록은 독립적입니다.
- API 키는 서버 환경변수에서만 읽습니다. 입력과 답변은 `textContent`로 표시하며 HTML을 실행하지 않습니다.
- 최대 50회 질문, 메시지당 12,000자, 요청의 대화 내용 합계 60,000자 제한입니다. 제한에 도달하면 새 대화를 시작하세요. 오래된 기록을 자동으로 버리지는 않습니다.
- 응답 생성 중 중복 전송을 막고, 오류 시 질문을 입력창에 복원해 다시 전송할 수 있습니다. OpenAI 호출은 45초 후 중단합니다.
- API 요청에 `store: false`를 사용합니다. 앱 자체는 기록을 저장하지 않지만, 메시지는 응답 생성을 위해 OpenAI로 전송됩니다. OpenAI의 데이터 처리 정책은 별도로 적용됩니다.
- 이 간단한 예제에는 사용자 인증과 사용자별 요청 제한이 없습니다. 공개 URL에 접근하는 사람은 API를 호출할 수 있습니다. 공개 서비스로 운영할 때는 인증과 사용량 제한을 추가하세요.

## 테스트

```sh
npm test
```

실제 API 키나 유료 호출 없이 모의 OpenAI 응답으로 대화 전달, 입력 검증, 키 누락, 오류 처리, 정적 파일 제공을 확인합니다. 실제 AI 답변은 유효한 API 키를 설정한 뒤 확인하세요. 예를 들어 “내 이름은 민수야”라고 보낸 뒤 “내 이름이 뭐지?”라고 질문합니다.

## 파일 구조

```text
public/
  index.html       채팅 화면
  styles.css       반응형 스타일
  app.js           대화 기록 및 UI 처리
src/app.js         Express API와 OpenAI 호출
scripts/start.js   로컬 서버 실행
test/chat.test.js  API 테스트
.env.example      환경변수 예시
vercel.json       Vercel Express 설정
```

## 참고 문서

- [OpenAI 공식 Chat Completions 문서](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [Vercel 공식 Express 배포 문서](https://vercel.com/docs/frameworks/backend/express)
