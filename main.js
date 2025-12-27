/**
 * =========================================================
 * main.js（劇団サイト）
 * - スマホメニュー（Drawer）制御
 * - ナビの現在地ハイライト（ScrollSpy）
 *
 * ✅ 運用メモ：
 * - HTML/CSSを触らずに挙動を調整したい場合は
 *   「CONFIG」だけ触ればOKにしてあります。
 * =========================================================
 */

/* =========================================================
 * CONFIG（ここだけ触れば大体調整できる）
 * ========================================================= */
const CONFIG = {
  // ===== ScrollSpy（現在地ハイライト） =====
  // 画面の「どの位置」を基準に現在地を決めるか（体感調整ポイント）
  // 0.33：画面の上から1/3付近 → “見えてきたら切り替わる”体感
  spyRatio: 0.33,

  // spyRatio で決めた基準線が大きくなりすぎるのを防ぐ上限（px）
  // 大画面で暴れる場合は小さく（例 200）、切り替えを早めたいなら大きく（例 280）
  spyMaxPx: 240,

  // stickyヘッダ分の補正（px）
  // headerの高さ + これ（余白）だけ下に基準線をずらす
  headerExtraOffset: 12,

  // ===== Drawer（スマホメニュー） =====
  // Drawerが開いたときの背景スクロールを止めるか
  lockBodyScroll: true,
};

/* =========================================================
 * ユーティリティ（触らなくてOK）
 * ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * requestAnimationFrame でスクロール処理を間引く（軽量化）
 * - スクロールのたびに重い処理を走らせないため
 */
const rafThrottle = (fn) => {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fn(...args);
    });
  };
};

/* =========================================================
 * 1) Drawer（スマホメニュー）制御
 * ========================================================= */
(() => {
  // --- HTML側の想定 ---
  // ボタン:  <button id="navToggle" aria-expanded="false">...</button>
  // ドロワ:  <div id="navDrawer" hidden> ... </div>
  const toggle = $("#navToggle");
  const drawer = $("#navDrawer");

  // Drawerが存在しない場合（PCだけ/未実装）でも落ちないようにする
  if (!toggle || !drawer) return;

  // 「閉じる」トリガー（背景クリック・×ボタンなど）に data-close-drawer を付ける想定
  const closeEls = $$("[data-close-drawer]", drawer);

  // Drawer内リンク（押したら閉じる）
  const drawerLinks = $$("a", drawer);

  function openDrawer() {
    drawer.hidden = false;
    toggle.setAttribute("aria-expanded", "true");

    // ===== 編集ポイント：背景スクロール禁止 =====
    if (CONFIG.lockBodyScroll) document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (CONFIG.lockBodyScroll) document.body.style.overflow = "";
  }

  // トグルボタン：開閉
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    expanded ? closeDrawer() : openDrawer();
  });

  // 背景/×ボタンなど：閉じる
  closeEls.forEach((el) => el.addEventListener("click", closeDrawer));

  // Drawer内リンク：押したら閉じる（遷移の邪魔をしない）
  drawerLinks.forEach((a) => a.addEventListener("click", closeDrawer));

  // ESCキーで閉じる（プロ仕様）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) closeDrawer();
  });
})();

/* =========================================================
 * 2) ScrollSpy（現在地ハイライト）
 * =========================================================
 * 目的：
 * - 「Schedule見てるのにNewsがアクティブ」のような違和感をなくす
 *
 * 方式：
 * - 画面内の「基準線（spyLine）」を超えた一番下のセクションを active にする
 *   ※ “最も見えてる”判定より、体感が安定しやすい
 * ========================================================= */
(() => {
  // PCナビ（上部ヘッダ）
  const pcLinks = $$('.nav a[href^="#"]');

  // Drawerナビ（スマホ）
  // ※HTMLによっては .drawer__links が無い場合もあるので安全に拾う
  const drawerRoot = $(".drawer__links") ?? $("#navDrawer") ?? document;
  const drawerLinks = $$('.drawer__links a[href^="#"]', document).length
    ? $$('.drawer__links a[href^="#"]', document)
    : $$('a[href^="#"]', drawerRoot);

  // 両方まとめて一括制御（同じ挙動になる）
  const allLinks = [...pcLinks, ...drawerLinks].filter(Boolean);

  // ナビが無いなら何もしない
  if (allLinks.length === 0) return;

  /**
   * href="#news" → document.querySelector("#news") のように対応付け
   * - 存在しないid（ミス）を除外
   * - 重複を除外
   */
  const sections = Array.from(
    new Set(
      allLinks
        .map((a) => $(a.getAttribute("href")))
        .filter((el) => el && el.id)
    )
  );

  // セクションが0なら何もしない
  if (sections.length === 0) return;

  /**
   * active付与処理
   * - .is-active を付ける（CSSで下線が出る想定）
   * - aria-current を付ける（アクセシビリティ）
   */
  const setActive = (id) => {
    allLinks.forEach((a) => {
      const on = a.getAttribute("href") === `#${id}`;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  /**
   * 基準線（spyLine）のY座標を計算
   * - ヘッダの高さ分ズラす
   * - 画面上から spyRatio の位置に基準線を置く（上限 spyMaxPx）
   */
  const getSpyLineY = () => {
    // headerクラスが無い構成でも動くようにfallback
    const headerH = $(".header")?.offsetHeight ?? 64;

    // ヘッダ直下から少し余白を足す（見た目の体感調整）
    const offset = headerH + CONFIG.headerExtraOffset;

    // 画面上の基準線位置（上限あり）
    const spy = Math.min(CONFIG.spyMaxPx, window.innerHeight * CONFIG.spyRatio);

    // “ページ全体のY”に変換
    return window.scrollY + offset + spy;
  };

  /**
   * 現在地のセクションIDを計算
   * - spyLineを超えた中で一番下のsectionを current とする
   */
  const computeActive = () => {
    const y = getSpyLineY();

    // 一番下に近いときは最後を強制（末尾で変な揺れが出るのを防ぐ）
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
      return sections[sections.length - 1]?.id;
    }

    // デフォルトは先頭
    let current = sections[0]?.id;

    for (const sec of sections) {
      if (sec.offsetTop <= y) current = sec.id;
      else break; // secは上から順に並んでいる想定なので、超えたら終了
    }
    return current;
  };

  /**
   * スクロール時に更新（rafThrottleで軽量化）
   */
  const onScroll = rafThrottle(() => {
    const id = computeActive();
    if (id) setActive(id);
  });

  // クリック直後に即反映（スクロール前でも体感が良い）
  allLinks.forEach((a) => {
    a.addEventListener("click", () => {
      const href = a.getAttribute("href");
      if (href && href.startsWith("#")) setActive(href.slice(1));
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // 初期表示：URLに #hash が付いている場合はそれを優先
  if (location.hash) setActive(location.hash.replace("#", ""));

  // 初回判定
  onScroll();
})();
