// app.js
import * as state from "./core/state.js";
import { applyTheme } from "./core/theme.js";
import { APP_NAME, APP_TAGLINE } from "./core/appConfig.js";
import { SEED_EXERCISES } from "./data/seedExercises.js";
import { registerRoute, initRouter, navigate } from "./ui/router.js";
import { initExitGuard } from "./ui/exitGuard.js";
import { el } from "./ui/dom.js";
import { openModal } from "./ui/components/modal.js";
import { renderHome } from "./ui/screens/home.js";
import { renderWorkout } from "./ui/screens/workout.js";
import { renderRoutineList } from "./ui/screens/routineList.js";
import { renderRoutineEditor } from "./ui/screens/routineEditor.js";
import { renderExercisePicker } from "./ui/screens/exercisePicker.js";
import { renderExerciseForm, renderExerciseEdit } from "./ui/screens/exerciseForm.js";
import { renderExerciseManage } from "./ui/screens/exerciseManage.js";
import { renderChallengeCandidate } from "./ui/screens/machineCandidate.js";
import { renderNotificationCenter } from "./ui/screens/notificationCenter.js";
import { renderSettings } from "./ui/screens/settings.js";
import { renderHistory } from "./ui/screens/history.js";

// 앱 이름은 core/appConfig.js 한 곳에서만 관리합니다. 이 함수가 그 값을
// 문서 제목과 PWA manifest(name/short_name)에 실행 시점에 반영합니다.
function applyAppIdentity() {
  document.title = `${APP_NAME} — ${APP_TAGLINE}`;

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) return;
  fetch(manifestLink.href)
    .then((res) => res.json())
    .then((base) => {
      const manifest = { ...base, name: `${APP_NAME} — ${APP_TAGLINE}`, short_name: APP_NAME };
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      manifestLink.href = URL.createObjectURL(blob);
    })
    .catch((e) => console.warn("[app] manifest 동적 반영 실패, 정적 manifest.json을 그대로 사용합니다.", e));
}

// v2.3.0: 운동 진행 상태(Draft) 복구. 어떤 화면이 그려지든(라우터가 결정한 화면 위에 오버레이) 앱 실행 시
// 1회만 확인합니다. 자동 복구는 하지 않고(요구사항), 사용자가 명시적으로 선택하게 합니다.
function checkDraftRecovery() {
  const draft = state.loadDraft();
  if (!draft) return;

  const content = el("div", { class: "duration-modal" }, [
    el("div", { class: "duration-title", text: "운동을 이어서 진행하시겠습니까?" }),
    el("div", { class: "btn-row" }, [
      el("button", {
        class: "btn btn-ghost",
        text: "새 운동 시작",
        onclick: () => {
          state.clearDraft();
          close();
        },
      }),
      el("button", {
        class: "btn btn-primary",
        text: "이어하기",
        onclick: () => {
          window.__draftSession = draft;
          close();
          navigate("#/workout");
        },
      }),
    ]),
  ]);
  const close = openModal(content, { dismissible: false });
}

// v3.1.2: Splash 최소 노출 시간 관리. 실제 부트스트랩(state.init~initRouter 첫 렌더링)은 이미 동기적으로
// 끝나 있으므로, 이 타이머는 "앱 실행을 지연"시키는 게 아니라 이미 준비된 화면 위에 떠 있는 splash를
// 최소 1초는 유지했다가 치우는 순수 연출용 지연입니다. 로딩이 1초보다 오래 걸리는 경우(느린 기기 등)에는
// remaining이 0이 되어 추가 대기 없이 즉시 제거됩니다 — 실제 로딩보다 길게 강제 대기하지 않습니다.
const SPLASH_MIN_MS = 1000;
const splashStartedAt = performance.now();

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const remaining = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStartedAt));
  setTimeout(() => {
    splash.classList.add("splash-hide");
    setTimeout(() => splash.remove(), 260); // CSS transition(.25s) 종료 후 DOM에서 완전히 제거
  }, remaining);
}

function bootstrap() {
  const data = state.init();

  if (data.exercises.length === 0) {
    SEED_EXERCISES.forEach((ex) => state.addExercise(ex));
  }

  applyTheme(data.settings.themeId);
  applyAppIdentity();

  const root = document.getElementById("app");

  registerRoute("/home", renderHome);
  registerRoute("/workout", renderWorkout);
  registerRoute("/routine-list", renderRoutineList);
  registerRoute("/routine/:day", renderRoutineEditor);
  registerRoute("/exercise-picker/:day", renderExercisePicker);
  registerRoute("/exercise-form/:day", renderExerciseForm);
  registerRoute("/exercise-form", renderExerciseForm); // 종목 관리 화면에서 day 없이 생성 진입(2-1)
  registerRoute("/exercise-edit/:id", renderExerciseEdit);
  registerRoute("/exercise-manage", renderExerciseManage);
  registerRoute("/machine-candidate", renderChallengeCandidate);
  registerRoute("/notification-center", renderNotificationCenter);
  registerRoute("/settings", renderSettings);
  registerRoute("/history", renderHistory);

  // v3.0.0: 최초 도입 시에는 initExitGuard()를 initRouter()보다 먼저 호출했습니다(콜드 스타트 시
  // 중복 history 항목 방지 목적). 그런데 v3.0.1에서 initRouter()에 "hash 검증 후 Home 보정"(설치형
  // PWA 재실행 시 남아있는 hash를 replaceState로 Home으로 되돌리는 처리)이 추가되면서, exitGuard가
  // router보다 먼저 실행되면 아직 보정되기 전의(예: #/settings) hash를 보고 isHome()을 판단하게 되어
  // Home 진입 시 자동으로 쌓여야 할 종료 방지용 더미 history 항목이 생성되지 않는 문제가 생깁니다.
  // 순서를 다시 router 먼저로 되돌립니다 — initRouter()의 hash 보정(replaceState)은 동기적으로
  // location.hash를 갱신하므로, 뒤이어 실행되는 initExitGuard()의 최초 isHome() 판단은 항상 보정된
  // hash를 기준으로 이뤄집니다. v3.0.0에서 막았던 "중복 history 항목" 문제는 armGuard()가 이미
  // idempotent하게(history.state에 __exitGuard가 있으면 재실행하지 않도록) 수정되어 있어, 이 순서로
  // 되돌려도 재발하지 않습니다.
  initRouter(root, "#/home");
  initExitGuard();
  checkDraftRecovery();
  hideSplash();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}

// PWA: 서비스 워커 등록 (오프라인 지원)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((e) => console.warn("[sw] 등록 실패", e));
  });
}
