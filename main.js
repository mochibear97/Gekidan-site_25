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


/* =========================================================
 * DEF / INI Loader（content/site.def を読み込んで画面反映）
 *
 * ✅ 目的：
 * - HTMLを触らずに、site.def だけで内容を更新できる
 * - 初心者は「1行 = 1項目（key = value）」を編集するだけ
 *
 * ✅ 運用：
 * - GitHub Pages でも動く（静的に fetch で読むだけ）
 * - site.def は index.html と同じ階層に置くのが一番ラク
 *
 * ⚠ 注意：
 * - Drive画像は「共有設定：リンクを知っている全員が閲覧可」
 * - Driveの共有URLはそのまま貼ってOK（JS側で表示用URLに変換する）
 * ========================================================= */

function normalizeImageUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  const m1 = s.match(/\/file\/d\/([^\/]+)\//);
  if (m1 && m1[1]) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(m1[1])}`;
  const m2 = s.match(/[?&]id=([^&]+)/);
  if (s.includes("drive.google.com/open") && m2 && m2[1]) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(m2[1])}`;
  }
  if (s.includes("drive.google.com/uc?") && s.includes("id=")) return s;
  return s;
}

function parseDef(text) {
  const root = {};

  const coerce = (v) => {
    const s = String(v ?? "").trim();
    const lower = s.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    return s;
  };

  const setByPath = (obj, key, value) => {
    const parts = key.split(".").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    let cur = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const next = parts[i + 1];
      const nextIsIndex = next != null && /^\d+$/.test(next);

      if (/^\d+$/.test(part)) {
        const idx = Math.max(0, parseInt(part, 10) - 1);
        while (cur.length <= idx) cur.push({});
        if (isLast) cur[idx] = value;
        else {
          if (cur[idx] == null || typeof cur[idx] !== "object") cur[idx] = {};
          cur = cur[idx];
        }
        continue;
      }

      if (isLast) {
        cur[part] = value;
        return;
      }

      if (nextIsIndex) {
        if (!Array.isArray(cur[part])) cur[part] = [];
      } else {
        if (cur[part] == null || typeof cur[part] !== "object" || Array.isArray(cur[part])) cur[part] = {};
      }
      cur = cur[part];
    }
  };

  const lines = String(text ?? "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(";") || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    setByPath(root, key, coerce(value));
  }

  return normalizeState(root);
}

function normalizeState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};

  state.hero = state.hero || {};
  const metaCards = [];
  for (let i = 1; i <= 3; i++) {
    const key = `meta${i}`;
    const m = state.hero[key];
    if (m && typeof m === "object") metaCards.push({ label: String(m.label ?? "").trim(), value: String(m.value ?? "").trim() });
  }
  if (Array.isArray(state.hero.metaCards) && state.hero.metaCards.length) {
    state.hero.metaCards = state.hero.metaCards.map((c) => ({ label: String(c?.label ?? "").trim(), value: String(c?.value ?? "").trim() }));
  } else state.hero.metaCards = metaCards;

  state.hero.reserve = state.hero.reserve || {};
  state.hero.detail = state.hero.detail || {};
  state.hero.keyVisual = state.hero.keyVisual || {};

  state.about = state.about || {};
  const history = Array.isArray(state.history) ? state.history : [];
  state.about.history = history.filter((h) => h && typeof h === "object").map((h) => ({ year: String(h.year ?? "").trim(), text: String(h.text ?? "").trim() }));

  state.news = Array.isArray(state.news) ? state.news : [];
  state.news = state.news.filter((n) => n && typeof n === "object").map((n) => ({
    date: String(n.date ?? "").trim(),
    title: String(n.title ?? "").trim(),
    text: String(n.text ?? "").trim(),
    url: String(n.url ?? "").trim(),
  })).filter((n) => n.date || n.title || n.text || n.url);

  state.schedule = state.schedule && typeof state.schedule === "object" ? state.schedule : {};
  state.schedule.items = Array.isArray(state.schedule.items) ? state.schedule.items : [];
  if (Array.isArray(raw?.schedule)) state.schedule.items = raw.schedule;
  state.schedule.items = state.schedule.items.filter((x) => x && typeof x === "object").map((x) => ({
    date: String(x.date ?? "").trim(),
    title: String(x.title ?? "").trim(),
    place: String(x.place ?? "").trim(),
    note: String(x.note ?? "").trim(),
    url: String(x.url ?? "").trim(),
  })).filter((x) => x.date || x.title || x.place || x.note || x.url);

  state.members = Array.isArray(state.members) ? state.members : [];
  state.members = state.members.filter((m) => m && typeof m === "object").map((m) => ({
    enabled: m.enabled === false ? false : true,
    name: String(m.name ?? "").trim(),
    role: String(m.role ?? "").trim(),
    note: String(m.note ?? "").trim(),
    photo: String(m.photo ?? "").trim(),
    snsLabel: String(m.snsLabel ?? "").trim(),
    snsUrl: String(m.snsUrl ?? "").trim(),
  })).filter((m) => m.name || m.role || m.note || m.photo || m.snsUrl);

  state.socials = state.socials && typeof state.socials === "object" ? state.socials : {};
  state.socials.items = Array.isArray(state.socials.items) ? state.socials.items : [];
  if (Array.isArray(raw?.socials)) state.socials = { sub: "", items: raw.socials };
  state.socials.items = (state.socials.items || []).filter((s) => s && typeof s === "object").map((s) => ({
    enabled: s.enabled === true || s.enabled === "true" || s.enabled === 1 || s.enabled === "1",
    label: String(s.label ?? "").trim(),
    title: String(s.title ?? "").trim(),
    text: String(s.text ?? "").trim(),
    url: String(s.url ?? "").trim(),
  })).filter((s) => s.label || s.title || s.text || s.url);

  state.meta = state.meta || {};
  state.branding = state.branding || {};
  state.contact = state.contact || {};
  state.footer = state.footer || {};

  const toStr = (obj, k) => { if (obj && obj[k] != null) obj[k] = String(obj[k]).trim(); };
  ["siteTitle","description","themeColor","ogTitle","ogDescription","ogImage","ogUrl"].forEach(k => toStr(state.meta,k));
  ["troupeNameJp","troupeNameEn"].forEach(k => toStr(state.branding,k));
  ["sub","conceptTitle","concept","historyTitle"].forEach(k => toStr(state.about,k));
  ["sub","note"].forEach(k => toStr(state.schedule,k));
  ["sub","email"].forEach(k => toStr(state.contact,k));
  ["brand","small"].forEach(k => toStr(state.footer,k));
  if (state.hero.reserve) { toStr(state.hero.reserve, "label"); toStr(state.hero.reserve, "url"); }
  if (state.hero.detail) { toStr(state.hero.detail, "label"); toStr(state.hero.detail, "url"); }
  if (state.hero.keyVisual) { toStr(state.hero.keyVisual, "src"); toStr(state.hero.keyVisual, "alt"); }

  return state;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyStateToDom(state) {
  if (state.meta?.siteTitle) document.title = state.meta.siteTitle;

  const setMeta = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el && value != null && String(value).trim() !== "") el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', "content", state.meta?.description);

  if (state.meta?.themeColor) {
    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.setAttribute("name", "theme-color");
      document.head.appendChild(theme);
    }
    theme.setAttribute("content", state.meta.themeColor);
  }

  setMeta('meta[property="og:title"]', "content", state.meta?.ogTitle);
  setMeta('meta[property="og:description"]', "content", state.meta?.ogDescription);
  setMeta('meta[property="og:image"]', "content", state.meta?.ogImage);
  setMeta('meta[property="og:url"]', "content", state.meta?.ogUrl);

  const brandJp = document.querySelector(".brand__jp");
  const brandEn = document.querySelector(".brand__en");
  if (brandJp && state.branding?.troupeNameJp) brandJp.textContent = state.branding.troupeNameJp;
  if (brandEn && state.branding?.troupeNameEn) brandEn.textContent = state.branding.troupeNameEn;

  const heroBadge = document.querySelector(".hero .badge");
  const heroTitle = document.querySelector(".hero__title");
  const heroLead = document.querySelector(".hero__lead");
  const heroNote = document.querySelector(".hero__note");
  const heroActions = document.querySelector(".hero__actions");
  const heroMetaCards = Array.from(document.querySelectorAll(".hero__meta .metaCard"));

  if (heroBadge && state.hero?.badge) heroBadge.textContent = state.hero.badge;
  if (heroTitle && state.hero?.title) heroTitle.textContent = state.hero.title;
  if (heroLead && state.hero?.lead != null) heroLead.innerHTML = String(state.hero.lead || "").replace(/\n/g, "<br />");

  if (heroMetaCards.length && Array.isArray(state.hero?.metaCards)) {
    state.hero.metaCards.slice(0, heroMetaCards.length).forEach((m, i) => {
      const card = heroMetaCards[i];
      const labelEl = card.querySelector(".metaCard__label");
      const valueEl = card.querySelector(".metaCard__value");
      if (labelEl && m.label) labelEl.textContent = m.label;
      if (valueEl && m.value) valueEl.textContent = m.value;
    });
  }

  if (heroActions) {
    heroActions.innerHTML = "";
    const addBtn = (label, url, primary) => {
      if (!label || !url) return;
      const a = document.createElement("a");
      a.className = primary ? "btn btn--primary" : "btn btn--ghost";
      a.href = url;
      if (/^https?:\/\//.test(url)) { a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = label;
      heroActions.appendChild(a);
    };
    addBtn(state.hero?.reserve?.label, state.hero?.reserve?.url, true);
    addBtn(state.hero?.detail?.label, state.hero?.detail?.url, false);
  }

  if (heroNote && state.hero?.note != null) heroNote.textContent = String(state.hero.note || "");

  const visual = document.querySelector(".hero__visual");
  if (visual) {
    const src = state.hero?.keyVisual?.src ? normalizeImageUrl(state.hero.keyVisual.src) : "";
    const alt = state.hero?.keyVisual?.alt || state.hero?.title || "";
    if (src) {
      const ph = visual.querySelector(".hero__visualPlaceholder");
      if (ph) ph.remove();
      let img = visual.querySelector("img");
      if (!img) { img = document.createElement("img"); visual.appendChild(img); }
      img.src = src;
      img.alt = alt;
    }
  }

  const newsGrid = document.querySelector("#news .newsGrid");
  if (newsGrid && Array.isArray(state.news)) {
    newsGrid.innerHTML = "";
    state.news.forEach((n) => {
      const art = document.createElement("article");
      art.className = "card card--hover";
      art.innerHTML = `
        <p class="news__date">${escapeHtml(n.date)}</p>
        <h3 class="card__title">${n.url ? `<a class="link" href="${escapeHtml(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a>` : escapeHtml(n.title)}</h3>
        <p class="card__text">${escapeHtml(n.text)}</p>
      `.trim();
      newsGrid.appendChild(art);
    });
  }

  const scheduleGrid = document.querySelector("#schedule .scheduleGrid");
  if (scheduleGrid && Array.isArray(state.schedule?.items)) {
    const sub = document.querySelector("#schedule .section__sub");
    if (sub && state.schedule?.sub != null) sub.textContent = state.schedule.sub;

    scheduleGrid.innerHTML = "";
    state.schedule.items.forEach((it) => {
      const lines = [];
      if (it.place) lines.push(`会場：${it.place}`);
      if (it.note) lines.push(`備考：${it.note}`);
      const body = lines.map((s) => `${escapeHtml(s)}<br />`).join("").replace(/<br \/>\s*$/, "");

      const art = document.createElement("article");
      art.className = "card";
      art.innerHTML = `
        <p class="news__date">${escapeHtml(it.date)}</p>
        <h3 class="card__title">${it.url ? `<a class="link" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a>` : escapeHtml(it.title)}</h3>
        <p class="card__text">${body}</p>
      `.trim();
      scheduleGrid.appendChild(art);
    });

    const existNote = document.querySelector("#schedule [data-schedule-note]");
    if (existNote) existNote.remove();
    if (state.schedule?.note) {
      const p = document.createElement("p");
      p.className = "note";
      p.setAttribute("data-schedule-note", "true");
      p.textContent = state.schedule.note;
      scheduleGrid.parentElement?.appendChild(p);
    }
  }

  const aboutSec = document.querySelector("#about");
  if (aboutSec) {
    const sub = aboutSec.querySelector(".section__sub");
    if (sub && state.about?.sub != null) sub.textContent = state.about.sub;

    const cards = Array.from(aboutSec.querySelectorAll(".card"));
    if (cards[0] && state.about?.conceptTitle) { const h3 = cards[0].querySelector(".card__title"); if (h3) h3.textContent = state.about.conceptTitle; }
    if (cards[1] && state.about?.historyTitle) { const h3 = cards[1].querySelector(".card__title"); if (h3) h3.textContent = state.about.historyTitle; }
    if (cards[0] && state.about?.concept != null) { const p = cards[0].querySelector(".card__text"); if (p) p.textContent = state.about.concept; }
    if (cards[1]) {
      const ul = cards[1].querySelector("ul.list");
      if (ul && Array.isArray(state.about?.history)) {
        ul.innerHTML = "";
        state.about.history.forEach((h) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="list__key">${escapeHtml(h.year)}</span><span class="list__val">${escapeHtml(h.text)}</span>`;
          ul.appendChild(li);
        });
      }
    }
  }

  const membersGrid = document.querySelector("#members .grid");
  if (membersGrid && Array.isArray(state.members)) {
    membersGrid.innerHTML = "";
    state.members.filter((m) => m.enabled !== false).forEach((m) => {
      const src = m.photo ? normalizeImageUrl(m.photo) : "";
      const sns = m.snsUrl ? `<a class="link" href="${escapeHtml(m.snsUrl)}" target="_blank" rel="noopener">${escapeHtml(m.snsLabel || "SNS")}</a>` : "";
      const avStyle = src ? ` style="background-image:url('${escapeHtml(src)}')"` : "";
      const avClass = src ? "avatar has-photo" : "avatar";
      const art = document.createElement("article");
      art.className = "card member card--hover";
      art.innerHTML = `
        <div class="${avClass}" aria-hidden="true"${avStyle}></div>
        <h3 class="member__name">${escapeHtml(m.name)}</h3>
        <p class="member__role">${escapeHtml(m.role)}</p>
        <p class="member__note">${escapeHtml(m.note)}</p>
        ${sns}
      `.trim();
      membersGrid.appendChild(art);
    });
  }

  const socialsGrid = document.querySelector("#follow .grid");
  if (socialsGrid && Array.isArray(state.socials?.items)) {
    const sub = document.querySelector("#follow .section__sub");
    if (sub && state.socials?.sub != null) sub.textContent = state.socials.sub;
    socialsGrid.innerHTML = "";
    state.socials.items.filter((s) => s.enabled).forEach((s) => {
      const a = document.createElement("a");
      a.className = "social card card--hover";
      a.href = s.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `
        <p class="social__label">${escapeHtml(s.label)}</p>
        <h3 class="social__title">${escapeHtml(s.title)}</h3>
        <p class="card__text">${escapeHtml(s.text)}</p>
        <p class="social__go">見に行く →</p>
      `.trim();
      socialsGrid.appendChild(a);
    });
  }

  const contactSec = document.querySelector("#contact");
  if (contactSec) {
    const sub = contactSec.querySelector(".section__sub");
    if (sub && state.contact?.sub != null) sub.textContent = state.contact.sub;
    const mailA = contactSec.querySelector('a[href^="mailto:"]');
    if (mailA && state.contact?.email) { mailA.href = `mailto:${state.contact.email}`; mailA.textContent = state.contact.email; }
  }

  const fBrand = document.querySelector(".footer__brand");
  const fSmall = document.querySelector(".footer__small");
  if (fBrand && state.footer?.brand) fBrand.textContent = state.footer.brand;
  if (fSmall && state.footer?.small) fSmall.textContent = state.footer.small;
}

async function loadAndApplyDef() {
  const candidates = ["./site.def", "./content/site.def"];
  let text = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      text = await res.text();
      break;
    } catch (e) {}
  }
  if (!text) {
    console.warn("[site.def] が見つからないため、HTMLの静的内容を表示します。");
    return;
  }
  try {
    const state = parseDef(text);
    applyStateToDom(state);
  } catch (e) {
    console.error(e);
    console.warn("[site.def] の解析に失敗しました。defの書式（key = value）を確認してください。");
  }
}

loadAndApplyDef();
