// ===== ここは基本触らなくてOK（スマホメニューの制御） =====
const toggle = document.getElementById("navToggle");
const drawer = document.getElementById("navDrawer");

// クリックで閉じる対象（背景/×ボタン）
const closeEls = drawer.querySelectorAll("[data-close-drawer]");

// メニュー内リンク（押したら閉じる）
const links = drawer.querySelectorAll("a");

function openDrawer() {
  drawer.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden"; // 背景スクロール禁止（プロ感）
}

function closeDrawer() {
  drawer.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = ""; // 戻す
}

// ===== 編集ポイント：ここは通常変更不要 =====
toggle.addEventListener("click", () => {
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  expanded ? closeDrawer() : openDrawer();
});

closeEls.forEach((el) => el.addEventListener("click", closeDrawer));
links.forEach((a) => a.addEventListener("click", closeDrawer));

// ESCキーで閉じる（プロ仕様）
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !drawer.hidden) closeDrawer();
});
