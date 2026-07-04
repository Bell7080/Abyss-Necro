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

## 구현 우선 사실(2026-07-04 기준)
- **전투 근간은 "사령 레인 러시"로 재설계됨** — 합의 스펙·밸런스 초안은 `COMBAT_REDESIGN.md`, 구현 요약은 `DEV_LOG.md` (40) 참고. 아래 전투 관련 사실은 이 재설계 반영본이다.
- 메인 화면 골격 구현됨: 3D로 기울인 중앙 보드판(좌측 본진 1칸 + **4열×3행** 적 그리드=3레인(가로 4칸 깊이), 칸 210px, `--board-tilt` CSS 변수), 하단 손패 부채꼴, 우측 하단 유물 인벤토리, 우측 상단 도감 런처, **플레이어 카드 좌측 벌집 스킬 헥스 4종 + 세로 사령 게이지**(`SkillHive`). 그리드 크기는 `WaveSystem`/`DefenderSystem`의 `ROWS/COLS`와 `BoardRenderer`의 `GRID_ROWS/GRID_COLS/CELL_SIZE`가 공유하고, `constellationSvg`는 이 값으로 임의 행×열을 그린다.
- `IntroOverlay`: 게임 진입 시 어두운 비네틱 화면이 2.4초에 걸쳐 밝아지며 보드를 드러내고, 중앙에 "시작하기" 버튼이 페이드인된다. 버튼을 눌러야 `WaveSystem.start()`/`AbilitySystem.start()`가 호출되어 웨이브 스폰·이동·게이지 트리클이 시작된다 — 그 전까지 보드는 비어 있고 웨이브 HUD도 정지해 있다.
- `WaveSystem`(레인 러시): 각 그리드 행이 레인(3레인, 각 레인 가로 4칸 깊이). 웨이브는 여러 레인에 분산 스폰(랜덤 시작 레인부터 라운드로빈)되어 매 틱(1.3초) **자기 레인을 따라 무조건 왼쪽 전진**(배회 없음) — 밀물처럼 압박한다. 아군이 있는 칸에선 전진을 멈추고 교전(그게 레인 막기). `enemyCountForWave`(1/2/3/3/3/4), 적 체력 웨이브 스케일 `enemyHpForWave`(8+웨이브당 2), 적 공격은 `EnemyToken.attack`(기본 1, 없으면 폴백)으로 개별화돼 클래시·플레이어 피격에 반영. 30초마다 강제 푸시, 필드 클리어 시 3초 숨고르기 후 푸시. **3웨이브마다 체크포인트** — 소강 먼저, 해당 웨이브는 `resumeFromCheckpoint()`에서 도착. 클래시 해소는 이동 900ms 뒤, `BoardRenderer`는 880ms 내 런지 스킵. 조준/스킬 arm 0.3배속은 `TickManager.setRate`+`WaveSystem.setTimeScale`.
- **보스(클라이맥스) + 1차 엔딩**: 런은 5라운드(라운드당 3웨이브) 구성. 1~4라운드는 각각 체크포인트 리워드(상점/유물)로 끝나고, **5라운드 첫 웨이브(`BOSS_WAVE`=13)** 시작 시 중앙 레인에 **엘리트 해파리** 보스를 스폰(`WaveSystem.spawnBoss`, `EnemyToken.isBoss`/`label`/`attack`, 체100·공4·해파리 아트). 보드에선 `board-token.is-boss`로 카드가 더 크고 보라 오라가 숨쉰다. 포획 임계는 `EnemyToken.isBoss` 기준(보스 ≤10% / 일반 ≤25%, `WaveSystem.captureThreshold`)이며 `isCapturable`/`captureFrontEnemy`는 셀이 아닌 적으로 판정한다. **보스 처치(`EncounterResult.isBoss`) 또는 포획(`captureFrontEnemy`가 `isBoss` 반환) 시 `Game.handleVictory`**가 월드를 멈추고 700ms 뒤 **1차 엔딩 승리 오버레이(`VictoryOverlay`, 보라-금 새벽 톤 검은 반투명+블러, "승리 / 이제 모두 내 친구들이야! / 오늘 하루 재밌었지? / 처음으로")**를 띄운다(한 번만, `runWon` 래치). 패배는 기존 디펜스 실패(플레이어 HP 0→`DefeatOverlay`). 두 오버레이는 큰 볼드 문구 + 뒤 보드가 흐릿하게 비치는 반투명 블러. 아직 5종 보스 로스터·전용 아트는 미구현(단일 엘리트만).
- **도감(`CodexOverlay`)**: 우측 상단 책 런처(Unmelting `compendium-btn` hover 이식 — 아이콘 발광·라벨 페이드). 클릭 시 반투명 짙은 청색 창이 떠오르고, **크리처 1종당 한 슬라이드**로 큰 풀 일러스트 **적(before, 좌) → 사령 → 사령된 아군(after, 우)** + 공격/체력 스탯 칩 + 설명을 보여준다(냉기 청색 링 → 온기 보라/오렌지 링). 하단 위/아래 셰브런 + `n / N` 카운터, `scroll-snap`으로 한 몹씩 넘긴다("내리면 다음 몹"). 스탯은 적 기본(공1/체8)·아군 1성(`tierStats(1)` 4/7, 꽃게 +4)로 표기. 표시 전용, 상태 변경 없음. 적 설명은 `CreatureDefinition.enemyDesc`.
- 드롭: 처치 시 **25% 온전한 손패 카드(그 크리처 사령) / 75% 유해**(`CorpseSystem`) + 별빛 1개 확정 + 사령 게이지 +2. 1웨이브 처치는 카드 확정(튜토리얼). 유해는 급조 대상이거나 방치 시 3.8초 뒤 75%로 묘지 조각. 아이템/에픽 카드는 이제 **상점에서만** 획득(처치 드롭에서 제외). 아이템(`ItemCardDefinitions`): 심연 파동(전체 1피해)/치유 물결(칸 아군 3회복). 에픽(`EpicCardDefinitions`) 5종: 함정별/증가별(아군 공격 +1)/심연의 심장(최대체력 +2)/벼려진 저주(기본공격 +1)/과부하 문양(**최대 사령 게이지 +2**). 아이템/에픽은 합성 제외, 즉시 소모.
- 심연 상점(`ShopOverlay`): 일반 체크포인트마다 중앙에서 반짝이며 전개 — 랜덤 3슬롯(사령 45/아이템 35/에픽 20%), 가격 ✦2/✦2/✦6, 별빛으로 구매(`CoinSystem.spend`) 후 손패로 버블 전달. 3번째 체크포인트는 유물 3택(`RewardOverlay`) 유지. 유물탭은 항상 보이는 우측 하단 고정 독(`.relic-dock`).
- 트리플 머지(1→2→3성): 같은 크리처·**같은 등급** 카드 3장이 모이면 손패 좌측 "합성" 버튼(`MergeButton`) → 젤리 머지 → 한 등급 위 카드 1장(`HandSystem.findTriple`은 `creatureId:tier` 키로 매칭, 3성이 캡). 등급 스탯은 `data/Tiers.ts`(급조 2/1 → 1성 7/4 → 2성 25/14 → 3성 88/49, ×3.5 등비). 손패는 성(★) 개수로, 보드는 금색 오라(`is-tier2`/`is-tier3`)로 등급 표시.
- 조준 모드: 손패 카드 선택 중 화면 전체 어둠(aim-dim, 보드만 z-index로 부상) + 배치 칸 beckon 펄스 + 0.3배속 + **우측** 카드 인스펙터(`CardInspector`, Unmelting 거점 인스펙터 해부도 우측 미러). 유물 독은 우하단 고정이되 z-index 96으로 인스펙터 위에 겹쳐 항상 보인다.
- 인스펙터는 조준 중이 아닐 때 보드 hover 인스펙션도 담당한다(`Game.handleCellHover`/`buildCellInspect`, `BoardRenderer`의 칸/플레이어 셀 mouseenter/leave → `onCellHover`): 앞 적 > 앞 아군 > 플레이어 > 칸 버프 순으로, 유닛은 공격/체력 칩 + 고유 패시브, 함정별 칸은 버프 라인을 보여준다. `CardInspector.render(InspectorData)`가 스탯 칩/패시브/버프까지 렌더하는 제네릭이고 `show(card)`도 이를 쓴다.
- 크리처 패시브(`CreatureDefinition.passiveId`, 아군 형태 작동): **감전 점막**(해파리)=그 칸 적 피해 +1(중첩, `DefenderHooks.getDamageAmp`→`WaveSystem.damageEnemy` 가산 + 시안 스파크), **폭신 도약**(바다토끼)=처치 시 인접 칸 아군 2 회복(초록 힐), **단단한 등껍질**(꽃게)=배치 시 체력 6으로 등장(`DefenderSystem.place`의 crab-guard 분기 + 앰버 실드 블라스트). `PassiveEvent`를 `WaveSystem.onPassive`/`DefenderSystem.onPassive`로 emit → `Game.handlePassive`→`BlastManager.passiveBurst(spark|heal|shield)`. 현재 크리처 3종(해파리/바다토끼/꽃게, `en_001~003`/`al_001~003`).
- 칸 3배치 합성: 한 칸에 같은 크리처·같은 등급 아군 3기 → 칸 위 금색 버튼(`CellMergeButton`) → 한 등급 위 1기(`DefenderSystem.mergeCellTriple`, `data/Tiers.ts` 스탯, 1→2→3성). 급조 언데드는 합성 제외. 손패 3장 합성과는 별개 경로.
- 성운 묘지(`GraveyardSystem`/`CosmosLayer`): 좌측 별 패널 폐기. 소울을 크리처별 **조각/파편**으로 누적해 화면 전역에 크리처별 색 별로 흩뿌린다(위치는 소울 id 해시로 안정, 조각 작게/파편 크게). **사망 복귀 사다리**(가치의 1/3이 한 단계 아래로): 급조→조각, 1성→파편(둘 다 성운으로 비행), 2성→1성 카드, 3성→2성 카드(손패 즉시 복귀). 방치 유해 조각도 성운으로. 소강 이탈(`resumeRun`) 시 `cascade()`가 같은 크리처 조각3→파편, 파편3→온전한 1성 카드로 응결해 손패로 날아간다.
- 칸 효과 일렁임: 효과가 걸린 칸은 `.board-cell::before`가 `--cell-tint-a/-b` 두 색(함정별=크림슨, 감전 점막 아우라=시안)을 screen 블렌드로 느리게 일렁인다(`BoardRenderer.syncCellEffect`).
- 보드 비주얼: 칸은 "#" 별자리(별빛 선 + 위상차 트윙클 별, `constellationSvg`)와 은은한 그림자 웅덩이. 카드 진영 발광 — 적 적색/아군 청색/플레이어 보라(`--card-ring`/`--card-glow`), 적 카드에도 이름 표기, 피격 시 붉은 점멸(`.is-hit`), 하단 타원 접지 그림자. 유해는 연보라 어두운 마커(`board-corpse`), 급조 언데드는 연보라 일렁 그림자(`board-figure.is-raised`). 기본공격 투사체는 직선 버블 화살 + 착탄 폭죽(`BubbleBolt`). 플레이어 카드 250px·이름 타이틀급.
- `PlayerSystem`(hp 10, 회복 없음)/`DefeatOverlay`: 플레이어 방에 도달한 적은 아군 디펜더가 있으면 그와 싸우고, 없으면 매 틱 선두 1기가 넥슈를 직접 공격한다(`WaveSystem.onPlayerHit`, 플레이어 카드 체력바 실시간 반영). hp 0이 되면 `TickManager.stop()`+`WaveSystem.halt()`로 월드가 정지하고 패배 오버레이("패배 / 심해는 무서워! / 다음에 다시 올래. / 다시하기", 리로드)가 반투명 블러로 덮인다.
- `SkillHive`(플레이어 카드 좌측): 벌집 헥스 4종(공격/급조/기상/포획) + 세로 사령 게이지. 게이지 fill은 `AbilitySystem.getSmoothGauge()`를 rAF로 매 프레임 읽고, 헥스 disabled/armed 상태는 `render()`/`setArmed()`. 급조/포획 arm 시 앰버 발광 + 화면 슬로우, 기본공격 헥스는 항상 켜진 기본 상태.
- `AbilitySystem`(사령 게이지): 통합 게이지(최대10, 처치당 +2 충전 + 2.5초당 +1 트리클 바닥). 능력 4종 `ABILITY_COST` — 기본공격 1(단일 칸 클릭, `BubbleBolt` 발사→착탄 시 `WaveSystem.applyDamage`)/급조부활 2(arm→칸, 유해 전부 기립)/전체부활 10(즉발, 필드 유해 전부)/포획 10(arm→저격, HP≤25%(보스≤10%) 즉사+확정 카드). 과부하 문양 에픽이 `increaseMaxGauge`로 최대치 상향. 클릭 모드 중재는 `Game`: 손패 선택=배치 / 스킬 arm=대상선택 / 그 외=기본공격. 임시 소환수 실험(`DefenderSystem.summon`/`stepSummons`)은 어느 능력에도 연결 안 됨(코드만 보존).
- `TickManager`(`src/core`): `WaveSystem`의 이동 틱과 `AbilitySystem`의 코스트 회복이 각자 `setInterval`을 갖는 대신 이 매니저에 `register(callback, intervalMs)`로 등록하고, `Game.startRun()`이 `tickManager.start()`를 호출하는 한 지점에서 실제로 째깍이기 시작한다(`stop()`으로 전체 게임 시계 정지도 가능). 웨이브 푸시처럼 정지/재개로 지연이 바뀌는 타이머는 여전히 해당 시스템의 로컬 `setTimeout` 체인.
- `BlastManager`(`src/ui/effects`): `Game.ts`가 `BubbleBurst`/`CoinDrop`을 직접 호출하지 않고 `travelDrop`/`coinDrop`/`clashBurst`로 소스 rect·목적지 좌표·onArrive 콜백만 넘긴다. 실제 상태 변경(카드/아이템/코인/유물 획득)은 그대로 호출부의 onArrive 콜백에 남는다. `BubbleBurst` 자체는 Unmelting `SquareBurst`와 같은 스냅 이징/확대-안착 스케일 곡선/바깥 편향 거리 분포를 쓰는 단색 원형 조각.
- `FontManager`(`src/ui`): `@font-face` 등록과 전역 폰트 지정을 한 곳에서 관리. `Griun Simsimche`(`src/assets/fonts/griun_simsimche.woff2`)를 부팅 시 로드해 `body` 기본 폰트로 적용. `<button>`은 폰트를 상속하지 않으므로 `board.css`의 전역 `button { font: inherit }`가 필수이고, JS 주입 스타일은 하드코딩 대신 `var(--font-family-primary)` 폴백을 쓴다.
- 손패 부채꼴(`CardHand.fanTransform`): 카드 144×192px. 개수 비례 폭이 아니라 고정 스텝(74px, 총폭 620px 캡) 방식이라 몇 장 없을 때는 겹쳐 모이고, 부채 각도(7°×장수, 36° 상한)·호 깊이도 장수 비례 — 2장이면 거의 똑바로 선다. `getNextSlotPoint`가 같은 함수를 공유해 드롭 버블 조준이 렌더와 항상 일치한다.
- `IntroOverlay` 시작 버튼은 플레이버 문구("심연이 그대를 기다린다") + 대형 링리스 버튼(radial 어둠 웅덩이 + 드롭 섀도우, 호버 시 폰트 25→29px 확대 + 텍스트 글로우) 구성으로, 숨쉬기 발광 `intro-breathe`(2.6s)는 text-shadow로 표현한다. 인트로 오버레이는 버튼 밖 클릭을 통과시키므로 `Game.runStarted` 게이트가 시작 전 모든 시전(칸 클릭/스킬)을 차단한다.
- 스타일 문법(Unmelting 이식): HUD 패널/칸/카드/오르브는 **하드 보더 없이** 어둠 그라디언트 워시 + `inset 0 0 0 1px` 위스퍼 링으로 표현하고, 상태(적/아군/호버/타게팅/선택)는 보더 색이 아니라 글로우·링 강도로 말한다. 엔티티 카드 링/글로우는 `--card-ring`/`--card-glow` 변수로 변형 처리. `AbyssAmbience`(`src/ui`)가 가장자리 비네틱 + 코스틱 시트 3장(블롭 2 + 대각 god-ray sway 1, transform 전용 드리프트, `screen` 블렌드, z-index 90)으로 물결 일렁임을 깐다 — 이펙트(220~240)/오버레이(300~500)는 그 위.
- `DefenderSystem`: 손패 카드를 선택해 칸(적이 있어도 무관, 칸당 최대 3기)에 배치하면 **정식 아군 디펜더(1성, `data/Tiers.ts` 7/4)**가 된다. `placeRaised`는 유해에서 **급조 언데드(체2/공1, 무패시브, `raised` 플래그)**를 세우고, `purgeRaised`가 소강마다 이를 소멸시킨다(→ 조각). 패시브/합성은 급조 제외. 전투는 적과 아군이 같은 칸에 있을 때만 매 틱 피해 교환.
- `CoinSystem`/`CoinPanel`(좌상단, 표기명 "별빛"): 적 처치 시 100% 확정으로 코인 1개가 드롭된다. `CoinDrop` 이펙트가 처치 지점 위에서 곡사포 형태로 짧게 낙하해 착지한 뒤, 그 자리에서 `BubbleBurst.travelTo`로 좌상단 패널까지 날아가 카운트가 오른다. 패널은 Unmelting `score-panel-total` 해부도를 심연 청록(#7fe8ff)으로 재해석하되 **뒤판 없이** 정리 — 배경 완전 투명, 위·아래 두 발광 라인(`::before`/`::after`, 양끝 페이드 청록 그라디언트 + 글로우)만으로 경계, 숫자 40px. 획득 시 숫자에 Unmelting `score-slot-pop` 이식(스쿼시-스트레치 바운스 + 밝기 플래시)과 좌우 대각으로 흩어지는 '✦ ✧ ✦' 2줄 반짝이(`coin-sparks`/`coin-sparks-mirror`). 별빛은 체크포인트 심연 상점(`ShopOverlay`)에서 카드 구매에 소모한다(`CoinSystem.spend`).
- 모든 보드 개체(적/아군/플레이어)는 `EntityCard`로 렌더링 — 풀 일러스트 카드 프레임(적/아군 160px, 플레이어 190px 폭) + 하단 심해 색 체력바(숫자 없음). `CreatureDefinitions.ts`에 등록된 크리처(현재 해파리/바다토끼/꽃게 3종 + 플레이어)는 실제 원화를 `object-fit: cover`로 표시한다. `EnemyToken`/`AllyToken`/`HandCard`가 `creatureId`를 스폰→처치→카드→배치 전 구간에 들고 다녀 같은 크리처의 before(적)/after(사령된 아군) 원화가 일관되게 이어지며, 손패 카드 자체는 배치 시 실제로 얻을 사령 후(after) 모습을 미리 보여준다.
- GitHub Actions(`/.github/workflows/deploy.yml`)로 `main` 푸시마다 Vite 빌드를 GitHub Pages에 자동 배포한다(Electron 바이너리 다운로드는 CI에서 스킵). `upload-pages-artifact`가 아티팩트를 덮어쓰지 않아 같은 run을 재시도하면 확정 실패하는 문제가 있어, 업로드 전 기존 `github-pages` 아티팩트를 지우는 정리 스텝을 추가해뒀다.
- 카드 3합성(1→2→3성)은 구현됨(스탯 사다리 `data/Tiers.ts`). 보스 포획·도감 비포/애프터는 단일 엘리트 해파리 기준으로 1차 구현됨. **아직 미구현**: 진화체 고유 아트/로스터 연결(현재 2·3성은 원본 아트 + 금색 오라 표시), 보스 5종 로스터·전용 아트·승리 조건, 40종 적·40종 카드·20종 진화체 데이터 테이블 — `Abyss_Necro_Game_Concept.md`·`COMBAT_REDESIGN.md` 기준으로 다음 세션에서 구현한다. 밸런스 수치(등급 스탯/게이지/적 스케일/보스 스탯)는 시작값이라 플레이로 조정 대상.

## 코드 규칙
- TypeScript only, import 주변 try/catch 금지.
- 새 코드에는 의도 중심의 짧은 주석만 포함(자명한 문법 설명 금지).
- 상태 변경은 systems/entities에 두고 ui는 표시/애니메이션만 담당.
- 테스트/더미/과거 실험 잔여 코드는 남기지 말고 제거 또는 보고.

## 문서 규칙
- 장문 패치노트 누적 금지. `CLAUDE.md`는 "현재 사실/규칙"만 유지.
- 날짜별 진행 기록은 `DEV_LOG.md`에 남기고 이 문서로 옮기지 않는다.
- 아트 방향 상세는 `CONCEPT_ART.md`, 게임 소개/기획 원문은 `Abyss_Necro_Game_Concept.md`에 유지해 추후 PDF 소개서 제작 시 그대로 발췌할 수 있게 한다.
