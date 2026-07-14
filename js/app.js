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
  document.title = `${APP_NAME} - ${APP_TAGLINE}`;

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) return;
  fetch(manifestLink.href)
    .then((res) => res.json())
    .then((base) => {
      const manifest = { ...base, name: `${APP_NAME} - ${APP_TAGLINE}`, short_name: APP_NAME };
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

  initRouter(root, "#/home");
  initExitGuard();
  checkDraftRecovery();
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
