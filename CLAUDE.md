# CLAUDE.md

Abyss-Necro(가제: 몽글몽글 심연 디펜스) 협업용 핵심 요약. **현재 코드 기준**으로만 유지하고, 원형 기획은 `Abyss_Necro_Game_Concept.md`를 필수로 참고한다.

## 프로젝트 목적
- 넥슨 재밌넥 시험 제출용 프로토타입. 개발 기간 3일.
- 기승전결 전체 서사 대신 **가장 재밌는 인게임 클라이맥스 한 구간**만 완성도 있게 보여주는 버티컬 슬라이스.
- **포트폴리오 핵심 메시지**: "AI로 제작한 캐릭터 수"를 자랑하는 게 아니라, "AI로 다양한 캐릭터를 빠르게 제작할 수 있어서 가능한 게임 구조"를 증명하는 것이 목적이다. 단순한 시스템 + 많은 콘텐츠(적 40 / 사령 카드 40 / 진화체 20 / 보스 5)의 조합이 곧 AI 아트 파이프라인의 증거다.

## 프로젝트 요약
- 장르: 탑뷰(top-down) 디펜스.
- 코어 루프: 적 처치 → 사령 카드 획득(1:1, 40종) → 동일 카드 3장 합성 → 진화체(20종) 전환 → 보스도 동일 메카닉으로 사령(5종) → 사령된 카드를 디펜더로 배치해 웨이브 방어 → 도감에서 적(before)/사령(after) 비교. 카드마다 고유 패시브 1개.
- 우선순위: **카드 획득/합성/보스 사령/도감 비포·애프터 시스템이 1순위**(포트폴리오 차별점). 인게임 디펜스(웨이브 진행/배치/전투)는 이 시스템을 보여주는 무대로서 최소 기능을 먼저 갖추고, 폴리싱은 여유 시간에 진행한다.
- 톤: Unmelting과 같은 몽글몽글하고 귀여운 실루엣을 유지하되, 팔레트/소재는 "심연"(어둡고 신비로운 심해·저승)으로 차별화. 사령 전/후는 냉기(청록)→온기(오렌지/보라) 색 대비로 구분한다. 상세는 `CONCEPT_ART.md` 참고.
- UI 레퍼런스: Unmelting의 3열 보드/레일 구조와 거점 화면 좌측 소개·우측 카드 배치 감각을 느슨하게 참고한다(그대로 복제 금지, 레이아웃 비율/톤만 차용).

## 기술 스택
- TypeScript + Vite(렌더러) + Electron(데스크톱 패키징).
- 프레임워크 없는 vanilla TS/DOM·Canvas 렌더링으로 Unity 대비 가벼운 반복 속도를 우선한다.
- 최종 배포는 Electron + electron-builder로 Windows exe(nsis/portable)를 생성한다.

## 실행/검증
```bash
npm install
npm run dev              # 브라우저에서 렌더러만 개발
npm run electron:dev     # Electron 창으로 실행(개발)
npm run type-check
npm run test
npm run build             # 렌더러 프로덕션 빌드
npm run dist              # electron-builder로 exe 패키징
```

## 에셋 규칙
- 일러스트/스프라이트는 **WebP 우선**(Unmelting 실사례: `src/assets/sprites` 215개 전부 webp). 알파 투명 지원 + 용량이 PNG 대비 크게 작아 exe 패키징 용량에 유리하고, 40+40+20+5 규모 콘텐츠를 감당하는 데도 필수적이다.
- PNG는 다음 경우에만 사용: (1) Windows 아이콘 변환 소스(`build/icon.ico` 생성용 1024×1024 PNG), (2) 외부 툴이 webp를 지원하지 않아 임시로 내보낸 원본. 최종 인게임 자산은 webp로 재변환한다.
- 오디오는 mp3, 폰트는 woff2 컨벤션을 Unmelting과 통일한다.

## 폴더 구조(초기 스캐폴드)
- `electron/` — Electron main/preload 프로세스(별도 tsconfig, Node 타깃).
- `src/core` — 게임 루프/부트스트랩.
- `src/systems` — 스폰/사령/합성/웨이브 등 상태 변경 로직.
- `src/entities` — 적/카드/디펜더/투사체 데이터 모델.
- `src/ui` — 보드 렌더러/HUD/도감(표시·애니메이션 전담, 상태 변경 금지).
- `src/data` — 40종 적/40종 카드/20종 진화체/5종 보스 등 밸런스·명단 테이블.
- `src/assets` — sprites(webp)/audio(mp3)/fonts(woff2). `sprites/`는 `enemies/`(적)·`allies/`(사령된 아군)·`backgrounds/`(배경) 하위 폴더로 분리돼 있고, 해파리·바다토끼 2종(`en_001`/`en_002`, `al_001`/`al_002`)과 배경(`bg_001`), 플레이어(`player_001`) 원화가 들어와 있다.
- `src/public` — Vite가 그대로 복사하는 정적 파일(`favicon.png`).
- `build/` — electron-builder 리소스. `icon.png`(1024×1024)가 들어와 있고 `package.json`의 `build.icon`이 이를 가리킨다.

## 구현 우선 사실(2026-07-03 기준)
- 메인 화면 골격 구현됨: 3D로 기울인 중앙 보드판(좌측 본진 1칸 + 3×3 적 그리드, `--board-tilt` CSS 변수), 하단 손패 부채꼴, 우측 하단 유물 인벤토리, 좌측 하단 스킬 오르브 2개(기본 공격/스킬).
- `IntroOverlay`: 게임 진입 시 어두운 비네틱 화면이 2.4초에 걸쳐 밝아지며 보드를 드러내고, 중앙에 "시작하기" 버튼이 페이드인된다. 버튼을 눌러야 `WaveSystem.start()`/`AbilitySystem.start()`가 호출되어 웨이브 스폰·이동·코스트 회복이 시작된다 — 그 전까지 보드는 비어 있고 웨이브 HUD도 정지해 있다.
- `WaveSystem`: 적은 그리드 우측 열 바깥 가상 칸에서 슬라이드해 들어와 매 틱(1.3초) 확률적으로 전진 0.4/배회 0.4/대기 0.2로 움직인다. 웨이브 구성은 `enemyCountForWave`(1/1/2, 4~5웨이브 2, 6+ 3마리), 랜덤 행 순서 340~860ms 순차 등장. 웨이브는 30초마다 강제 푸시, 필드 클리어 시 3초 숨고르기 후 푸시(`CLEAR_PUSH_DELAY_MS`). **3웨이브(1라운드)마다 체크포인트** — 소강이 먼저 걸리고 해당 웨이브는 `resumeFromCheckpoint()`에서 도착. 클래시 해소는 이동 900ms 뒤(슬라이드 완료 후), `BoardRenderer`는 880ms 내 이동 토큰의 런지를 스킵. 조준 모드 0.3배속은 `TickManager.setRate`+`WaveSystem.setTimeScale`(푸시 타이머 유효경과 북키핑).
- 드롭: 처치 시 항상 카드 1장 — 에픽 6%, 나머지 사령/아이템 50:50(1웨이브는 사령 확정) + 별빛 1개 확정. 아이템 카드(`ItemCardDefinitions`): 심연 파동(전체 1피해)/치유 물결(칸 아군 3회복, 아군 없으면 미소모). 에픽 시설 카드(`EpicCardDefinitions`) 5종: 함정별(칸 영구 함정 1피해·중첩·✦×n 마커)/증가별(아군 공격 +1 영구·중첩)/심연의 심장(최대체력 +2)/벼려진 저주(기본공격 +1)/과부하 문양(강화공격 +2). 아이템/에픽은 합성 제외, 사용 즉시 소모.
- 심연 상점(`ShopOverlay`): 일반 체크포인트마다 중앙에서 반짝이며 전개 — 랜덤 3슬롯(사령 45/아이템 35/에픽 20%), 가격 ✦2/✦2/✦6, 별빛으로 구매(`CoinSystem.spend`) 후 손패로 버블 전달. 3번째 체크포인트는 유물 3택(`RewardOverlay`) 유지. 유물탭은 항상 보이는 우측 하단 고정 독(`.relic-dock`).
- 트리플 머지: 같은 크리처 기본 카드 3장이 모이면 손패 좌측에 반짝이는 "합성" 버튼(`MergeButton`)이 켜지고, 클릭 시 젤리 머지(`CardHand.playMergeFx`: 탄성 수렴 0.4s → 스쿼시+반짝 0.54s → 모델 교체 pop). 결과는 `tier: 2` 카드 1장 — 보라 링/글로우 **플레이스홀더**, 진화체 로스터 연결 미구현.
- 조준 모드: 손패 카드 선택 중 화면 전체 어둠(aim-dim, 보드만 z-index로 부상) + 배치 칸 beckon 펄스 + 0.3배속 + 좌측 카드 인스펙터(`CardInspector`, Unmelting 거점 인스펙터 해부도 미러 — 제목/태그/설명).
- 보드 비주얼: 칸은 "#" 별자리(별빛 선 + 위상차 트윙클 별, `constellationSvg`)와 은은한 그림자 웅덩이. 카드 진영 발광 — 적 적색/아군 청색/플레이어 보라(`--card-ring`/`--card-glow`), 적 카드에도 이름 표기, 피격 시 붉은 점멸(`.is-hit`), 하단 타원 접지 그림자(`board-figure::before`). 투사체는 꼬리 달린 단색 버블 혜성(`CurseMortar`), 플레이어 카드 250px·이름 타이틀급.
- `PlayerSystem`(hp 10, 회복 없음)/`DefeatOverlay`: 플레이어 방에 도달한 적은 아군 디펜더가 있으면 그와 싸우고, 없으면 매 틱 선두 1기가 넥슈를 직접 공격한다(`WaveSystem.onPlayerHit`, 플레이어 카드 체력바 실시간 반영). hp 0이 되면 `TickManager.stop()`+`WaveSystem.halt()`로 월드가 정지하고 패배 오버레이("심연에 잠기다" + 다시 도전하기=페이지 리로드)가 덮인다.
- `SkillBar` 좌측의 세로 코스트 게이지: `AbilitySystem.getSmoothCost()`(다음 회복 틱까지 진행도 포함 소수 코스트)를 rAF로 매 프레임 읽어 fill 높이에 반영 — 정수 규칙(시전 가능 여부)은 여전히 `getCost()`. 10칸 구분선 + 수면 라인 + 내부 shimmer + 하단 정수 카운터 구성.
- `AbilitySystem`: 코스트 풀(최대10, 1.2초당 +1). 기본 공격(코스트2, 단일 칸 클릭 즉시 발동)과 스킬(코스트10, 생존 적 전체)은 `CurseMortar`로 본진 카드에서 곡선 발사되어 착탄 시에만 실제 피해가 들어간다(`WaveSystem.applyDamage`, 착탄 지점에 `FloatingDamage`). 임시 소환수 실험(`DefenderSystem.summon`/`stepSummons`/`getAttack`, `AllyToken.attack`/`movesLeft`)은 플레이 결과 롤백되어 현재 어느 능력에도 연결돼 있지 않지만, 추후 재사용을 위해 코드는 보존돼 있다.
- `TickManager`(`src/core`): `WaveSystem`의 이동 틱과 `AbilitySystem`의 코스트 회복이 각자 `setInterval`을 갖는 대신 이 매니저에 `register(callback, intervalMs)`로 등록하고, `Game.startRun()`이 `tickManager.start()`를 호출하는 한 지점에서 실제로 째깍이기 시작한다(`stop()`으로 전체 게임 시계 정지도 가능). 웨이브 푸시처럼 정지/재개로 지연이 바뀌는 타이머는 여전히 해당 시스템의 로컬 `setTimeout` 체인.
- `BlastManager`(`src/ui/effects`): `Game.ts`가 `BubbleBurst`/`CoinDrop`을 직접 호출하지 않고 `travelDrop`/`coinDrop`/`clashBurst`로 소스 rect·목적지 좌표·onArrive 콜백만 넘긴다. 실제 상태 변경(카드/아이템/코인/유물 획득)은 그대로 호출부의 onArrive 콜백에 남는다. `BubbleBurst` 자체는 Unmelting `SquareBurst`와 같은 스냅 이징/확대-안착 스케일 곡선/바깥 편향 거리 분포를 쓰는 단색 원형 조각.
- `FontManager`(`src/ui`): `@font-face` 등록과 전역 폰트 지정을 한 곳에서 관리. `Griun Simsimche`(`src/assets/fonts/griun_simsimche.woff2`)를 부팅 시 로드해 `body` 기본 폰트로 적용. `<button>`은 폰트를 상속하지 않으므로 `board.css`의 전역 `button { font: inherit }`가 필수이고, JS 주입 스타일은 하드코딩 대신 `var(--font-family-primary)` 폴백을 쓴다.
- 손패 부채꼴(`CardHand.fanTransform`): 카드 144×192px. 개수 비례 폭이 아니라 고정 스텝(74px, 총폭 620px 캡) 방식이라 몇 장 없을 때는 겹쳐 모이고, 부채 각도(7°×장수, 36° 상한)·호 깊이도 장수 비례 — 2장이면 거의 똑바로 선다. `getNextSlotPoint`가 같은 함수를 공유해 드롭 버블 조준이 렌더와 항상 일치한다.
- `IntroOverlay` 시작 버튼은 플레이버 문구("심연이 그대를 기다린다") + 대형 링리스 버튼(radial 어둠 웅덩이 + 드롭 섀도우, 호버 시 폰트 25→29px 확대 + 텍스트 글로우) 구성으로, 숨쉬기 발광 `intro-breathe`(2.6s)는 text-shadow로 표현한다. 인트로 오버레이는 버튼 밖 클릭을 통과시키므로 `Game.runStarted` 게이트가 시작 전 모든 스킬 시전(칸 클릭/궁극기)을 차단한다.
- 스타일 문법(Unmelting 이식): HUD 패널/칸/카드/오르브는 **하드 보더 없이** 어둠 그라디언트 워시 + `inset 0 0 0 1px` 위스퍼 링으로 표현하고, 상태(적/아군/호버/타게팅/선택)는 보더 색이 아니라 글로우·링 강도로 말한다. 엔티티 카드 링/글로우는 `--card-ring`/`--card-glow` 변수로 변형 처리. `AbyssAmbience`(`src/ui`)가 가장자리 비네틱 + 코스틱 시트 2장(transform 전용 드리프트, `screen` 블렌드, z-index 90)으로 물결 일렁임을 은은하게 깐다 — 이펙트(220~240)/오버레이(300~500)는 그 위.
- `DefenderSystem`: 손패 카드를 선택해 칸(적이 있어도 무관, 칸당 최대 3기)에 배치하면 아군 디펜더(hp3)가 된다. 전투는 적과 아군이 실제로 같은 칸에 있을 때만 시작되어 매 틱 서로 피해를 교환한다.
- `CoinSystem`/`CoinPanel`(좌상단, 표기명 "별빛"): 적 처치 시 100% 확정으로 코인 1개가 드롭된다. `CoinDrop` 이펙트가 처치 지점 위에서 곡사포 형태로 짧게 낙하해 착지한 뒤, 그 자리에서 `BubbleBurst.travelTo`로 좌상단 패널까지 날아가 카운트가 오르며 패널이 살짝 떠올랐다 가라앉고 숫자 위로 '✦ ✧ ✦' 반짝이 솟는다. 패널은 Unmelting `score-panel-total` 해부도(키커 행 + 큰 발광 tabular 숫자 + 보더리스 radial 글로우 뒤판)를 심연 청록(#7fe8ff)으로 재해석. 코인 사용처(소강 정비 단계)는 아직 미구현 — 누적만 된다.
- 모든 보드 개체(적/아군/플레이어)는 `EntityCard`로 렌더링 — 풀 일러스트 카드 프레임(적/아군 160px, 플레이어 190px 폭) + 하단 심해 색 체력바(숫자 없음). `CreatureDefinitions.ts`에 등록된 크리처(현재 해파리/바다토끼 2종 + 플레이어)는 실제 원화를 `object-fit: cover`로 표시하고, 나머지 적 종류는 아직 flat 아이콘 워터마크 실루엣을 사용한다(둘이 혼재 가능). `EnemyToken`/`AllyToken`/`HandCard`가 `creatureId`를 스폰→처치→카드→배치 전 구간에 들고 다녀 같은 크리처의 before(적)/after(사령된 아군) 원화가 일관되게 이어지며, 손패 카드 자체는 배치 시 실제로 얻을 사령 후(after) 모습을 미리 보여준다.
- GitHub Actions(`/.github/workflows/deploy.yml`)로 `main` 푸시마다 Vite 빌드를 GitHub Pages에 자동 배포한다(Electron 바이너리 다운로드는 CI에서 스킵). `upload-pages-artifact`가 아티팩트를 덮어쓰지 않아 같은 run을 재시도하면 확정 실패하는 문제가 있어, 업로드 전 기존 `github-pages` 아티팩트를 지우는 정리 스텝을 추가해뒀다.
- 카드 3합성 진화, 보스 사령, 도감 비포/애프터, 40종 적·40종 카드·20종 진화체·5종 보스 데이터 테이블은 아직 미구현 — `Abyss_Necro_Game_Concept.md`의 코어 루프 정의를 기준으로 다음 세션에서 구현한다.

## 코드 규칙
- TypeScript only, import 주변 try/catch 금지.
- 새 코드에는 의도 중심의 짧은 주석만 포함(자명한 문법 설명 금지).
- 상태 변경은 systems/entities에 두고 ui는 표시/애니메이션만 담당.
- 테스트/더미/과거 실험 잔여 코드는 남기지 말고 제거 또는 보고.

## 문서 규칙
- 장문 패치노트 누적 금지. `CLAUDE.md`는 "현재 사실/규칙"만 유지.
- 날짜별 진행 기록은 `DEV_LOG.md`에 남기고 이 문서로 옮기지 않는다.
- 아트 방향 상세는 `CONCEPT_ART.md`, 게임 소개/기획 원문은 `Abyss_Necro_Game_Concept.md`에 유지해 추후 PDF 소개서 제작 시 그대로 발췌할 수 있게 한다.
