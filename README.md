# Abyss-Necro

심연의 존재들을 막아서는 단 하나의 군단을 그린 이야기.

몽글몽글 심연 디펜스 — 네크로맨서가 심연의 적을 처치해 사령 카드로 모으고, 3장을 합쳐 진화시키고, 보스마저 사령해 도감의 비포/애프터로 확인하는 탑뷰 디펜스 프로토타입. 넥슨 재밌넥 시험 제출용 3일 버티컬 슬라이스.

## 문서
- `CLAUDE.md` — 현재 코드 기준 개발 규칙/의도 요약 (항상 최신 유지)
- `Abyss_Necro_Game_Concept.md` — 게임 기획 원안 (PDF 소개서 소스)
- `CONCEPT_ART.md` — 아트 디렉션/팔레트/캐릭터 컨셉
- `DEV_LOG.md` — 날짜별 개발 일지

## 실행
```bash
npm install
npm run dev              # 브라우저에서 렌더러만 개발
npm run electron:dev     # Electron 창으로 실행(개발)
npm run type-check
npm run test
npm run build             # 렌더러 프로덕션 빌드
npm run dist              # electron-builder로 Windows exe 패키징
```
