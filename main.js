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
/* =========================================================
 * 🔰 main.js の読み方（初心者向け）
 * ---------------------------------------------------------
 * main.js は「content/site.json を読み込む」→「画面に反映する」役です。
 *
 * 重要キーワード：
 * - fetch(): サーバ（またはローカルのLive Server）からファイルを取得
 * - async/await: “非同期処理” を同期っぽく書く構文（待ち合わせ）
 * - DOM操作: document.querySelector(...) で要素を掴んで textContent などを書き換える
 *
 * GitHub Pages では、リポジトリ上の content/site.json がそのまま配信されるので
 * それを fetch できる → HTMLを編集しなくても中身を更新できる、という仕組みです。
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
 * 3) Content Loader（HTMLを触らずに“中身”だけ差し替える）
 * =========================================================
 * 目的：
 * - 編集者が index.html を触らずに、content/site.json だけ更新すれば
 *   サイトの文章・日付・メンバー・SNSなどが反映されるようにする。
 *
 * 運用：
 * - 編集者は「editor.html」で入力 → site.json を出力
 * - あなた（管理者）が content/site.json を差し替えて公開（GitHub Pages等）
 *
 * 注意：
 * - GitHub Pages / Live Server（http://～）で動きます。
 * - file:// で直接開くと fetch が制限されることがあります（ブラウザ仕様）。
 * ========================================================= */
(() => {
  // ===== 編集ポイント：JSONのパス（基本は触らない） =====
  const CONTENT_URL = "./content/site.json";

  // ===== 小さなユーティリティ（触らなくてOK） =====
  const setText = (el, text) => {
    if (!el || typeof text !== "string") return;
    el.textContent = text;
  };

  // 改行を <br> に変換して入れたいとき用（heroのリード文など）
  const setTextWithBreaks = (el, text) => {
    if (!el || typeof text !== "string") return;
    const safe = text
      .split("\n")
      .map((line) => line.replace(/</g, "&lt;").replace(/>/g, "&gt;"))
      .join("<br />");
    el.innerHTML = safe;
  };

  const setAttr = (el, name, value) => {
    if (!el || value == null || value === "") return;
    el.setAttribute(name, value);
  };

  const setMeta = (selector, content) => {
    if (typeof content !== "string" || !content) return;

    // 既に meta があれば更新、なければ作る（HTMLを追加で触らなくてOKにする）
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");

      // selector から name 属性を推測（meta[name="description"] 等）
      const m = selector.match(/meta\[name="([^"]+)"\]/);
      if (m) el.setAttribute("name", m[1]);

      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const clear = (el) => {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  };

  const elFromHTML = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  // =========================================================
  // JSONを読み込み
  // =========================================================
  fetch(CONTENT_URL, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("content load failed"))))
    .then((data) => {
      // =====================================================
      // 1) meta / branding
      // =====================================================
      if (data?.meta?.siteTitle) document.title = data.meta.siteTitle;
      if (data?.meta?.description) setMeta('meta[name="description"]', data.meta.description);
      if (data?.meta?.themeColor) setMeta('meta[name="theme-color"]', data.meta.themeColor);

      // ロゴ（ヘッダ & フッタ）
      setText(document.querySelector(".brand__jp"), data?.branding?.troupeNameJp ?? "");
      setText(document.querySelector(".brand__en"), data?.branding?.troupeNameEn ?? "");

      // =====================================================
      // 2) Hero
      // =====================================================
      setText(document.querySelector(".badge"), data?.hero?.badge ?? "");
      setText(document.querySelector(".hero__title"), data?.hero?.title ?? "");
      setTextWithBreaks(document.querySelector(".hero__lead"), data?.hero?.lead ?? "");

      // Hero meta cards（3つ想定。増やすならHTML側のカードも増やす）
      const metaCards = Array.from(document.querySelectorAll(".hero__meta .metaCard"));
      const srcMeta = data?.hero?.metaCards ?? [];
      metaCards.forEach((card, i) => {
        const labelEl = card.querySelector(".metaCard__label");
        const valueEl = card.querySelector(".metaCard__value");
        const m = srcMeta[i];
        if (!m) return;
        setText(labelEl, m.label ?? "");
        setText(valueEl, m.value ?? "");
      });

      // 予約ボタン
      const reserveBtn = document.querySelector('.hero__actions .btn.btn--primary');
      if (reserveBtn) {
        setText(reserveBtn, data?.hero?.reserve?.label ?? reserveBtn.textContent ?? "");
        setAttr(reserveBtn, "href", data?.hero?.reserve?.url ?? reserveBtn.getAttribute("href"));
      }

      // Hero note
      setText(document.querySelector(".hero__note"), data?.hero?.note ?? "");

      // Key Visual（src が入っていれば img を表示）
      const visual = document.querySelector(".hero__visual");
      if (visual) {
        const kvSrc = data?.hero?.keyVisual?.src ?? "";
        const kvAlt = data?.hero?.keyVisual?.alt ?? "";
        const placeholder = visual.querySelector(".hero__visualPlaceholder");
        const imgExisting = visual.querySelector("img");

        if (kvSrc) {
          const img = imgExisting ?? document.createElement("img");
          img.src = kvSrc;
          img.alt = kvAlt || "Key Visual";
          if (!imgExisting) {
            // placeholder より先にimgを入れる
            visual.prepend(img);
          }
          if (placeholder) placeholder.remove();
        } else {
          // srcが空なら既存placeholderを優先（何もしない）
        }
      }

      // =====================================================
      // 3) News（#news）
      // =====================================================
      const newsGrid = document.querySelector("#news .newsGrid");
      if (newsGrid && Array.isArray(data?.news)) {
        clear(newsGrid);

        // ===== 編集ポイント：最大何件表示するか（好み） =====
        const MAX_NEWS = 6;

        data.news.slice(0, MAX_NEWS).forEach((n) => {
          const date = n?.date ?? "";
          const title = n?.title ?? "";
          const text = n?.text ?? "";
          const link = n?.link ?? "";

          const card = elFromHTML(`
            <article class="card card--hover">
              <p class="news__date"></p>
              <h3 class="card__title"></h3>
              <p class="card__text"></p>
            </article>
          `);

          setText(card.querySelector(".news__date"), date);
          setText(card.querySelector(".card__title"), title);
          setText(card.querySelector(".card__text"), text);

          // 任意：リンクがある場合だけ“続きを読む”を出す
          if (link) {
            const a = elFromHTML(`<a class="link" target="_blank" rel="noopener">詳細 →</a>`);
            a.href = link;
            card.appendChild(a);
          }

          newsGrid.appendChild(card);
        });
      }

      // =====================================================
      // 4) Schedule（#schedule）
      // =====================================================
      const schedule = data?.schedule;
      if (schedule) {
        setText(document.querySelector("#schedule .section__sub"), schedule.sub ?? "");

        const scheduleGrid = document.querySelector("#schedule .scheduleGrid");
        if (scheduleGrid && Array.isArray(schedule.items)) {
          clear(scheduleGrid);

          // ===== 編集ポイント：最大件数（好み） =====
          const MAX_SCHEDULE = 8;

          schedule.items.slice(0, MAX_SCHEDULE).forEach((s) => {
            const date = s?.date ?? "";
            const title = s?.title ?? "";
            const body = s?.body ?? "";
            const link = s?.link ?? "";

            const card = elFromHTML(`
              <article class="card">
                <p class="news__date"></p>
                <h3 class="card__title"></h3>
                <p class="card__text"></p>
              </article>
            `);

            setText(card.querySelector(".news__date"), date);
            setText(card.querySelector(".card__title"), title);

            // bodyは複数行OK（\n → <br>）
            setTextWithBreaks(card.querySelector(".card__text"), body);

            if (link) {
              const a = elFromHTML(`<a class="link" target="_blank" rel="noopener">詳細 →</a>`);
              a.href = link;
              card.appendChild(a);
            }

            scheduleGrid.appendChild(card);
          });
        }

        // 末尾の注意書き（※変更になる場合が…）
        const scheduleNote = document.querySelector("#schedule .note");
        if (scheduleNote && typeof schedule.note === "string") {
          scheduleNote.textContent = schedule.note;
        }
      }

      // =====================================================
      // 5) About（#about）
      // =====================================================
      const about = data?.about;
      if (about) {
        setText(document.querySelector("#about .section__sub"), about.sub ?? "");

        // コンセプト
        const aboutCards = Array.from(document.querySelectorAll("#about .card"));
        // 現行HTMLは「コンセプト→沿革」の順想定
        const conceptCard = aboutCards[0];
        if (conceptCard) {
          setText(conceptCard.querySelector(".card__title"), about.conceptTitle ?? "コンセプト");
          const conceptP = conceptCard.querySelector(".card__text");
          if (conceptP) setText(conceptP, about.concept ?? "");
        }

        // 沿革
        const historyCard = aboutCards[1];
        if (historyCard) {
          setText(historyCard.querySelector(".card__title"), about.historyTitle ?? "沿革");
          const ul = historyCard.querySelector(".list");
          if (ul && Array.isArray(about.history)) {
            clear(ul);
            about.history.forEach((h) => {
              const li = elFromHTML(`
                <li><span class="list__key"></span><span class="list__val"></span></li>
              `);
              setText(li.querySelector(".list__key"), h?.year ?? "");
              setText(li.querySelector(".list__val"), h?.text ?? "");
              ul.appendChild(li);
            });
          }
        }
      }

      // =====================================================
      // 6) Members（#members）
      // =====================================================
      const membersGrid = document.querySelector("#members .grid");
      if (membersGrid && Array.isArray(data?.members)) {
        clear(membersGrid);

        // ===== 編集ポイント：最大人数（好み） =====
        const MAX_MEMBERS = 12;

        data.members.slice(0, MAX_MEMBERS).forEach((m) => {
          const name = m?.name ?? "";
          const role = m?.role ?? "";
          const note = m?.note ?? "";
          // ===== 編集ポイント：写真パス（任意） =====
          // - editor.html で画像を追加 → ここに自動で入ります
          // - 例：assets/uploads/member01.jpg
          const photo = m?.photo ?? "";

          const snsUrl = m?.snsUrl ?? "";
          const snsLabel = m?.snsLabel ?? "個人SNS";

          const card = elFromHTML(`
            <article class="card member card--hover">
              <div class="avatar"></div>
              <h3 class="member__name"></h3>
              <p class="member__role"></p>
              <p class="member__note"></p>
            </article>
          `);

          setText(card.querySelector(".member__name"), name);
          setText(card.querySelector(".member__role"), role);
          setText(card.querySelector(".member__note"), note);

          // 写真（任意）
          // - 写真が無い場合は、丸いプレースホルダーのまま
          const av = card.querySelector(".avatar");
          if (av && photo) {
            const img = document.createElement("img");
            img.src = photo;
            img.alt = name ? `${name}の写真` : "member photo";
            img.loading = "lazy";
            av.appendChild(img);
          } else if (av) {
            // 画像が無いときは装飾だけなので読み上げ対象から外す
            av.setAttribute("aria-hidden", "true");
          }

          // SNSリンク（任意）
          if (snsUrl) {
            const a = elFromHTML(`<a class="link" target="_blank" rel="noopener"></a>`);
            a.href = snsUrl;
            a.textContent = snsLabel;
            card.appendChild(a);
          }

          membersGrid.appendChild(card);
        });
      }

      // =====================================================
      // 7) Socials（#follow）
      // =====================================================
      const socials = data?.socials;
      if (socials) {
        setText(document.querySelector("#follow .section__sub"), socials.sub ?? "");

        const socialGrid = document.querySelector("#follow .grid");
        if (socialGrid && Array.isArray(socials.items)) {
          clear(socialGrid);

          socials.items
            .filter((s) => s?.enabled !== false)
            .forEach((s) => {
              const url = s?.url ?? "#";
              const label = s?.label ?? "";
              const title = s?.title ?? "";
              const text = s?.text ?? "";

              const card = elFromHTML(`
                <a class="social card card--hover" target="_blank" rel="noopener">
                  <p class="social__label"></p>
                  <h3 class="social__title"></h3>
                  <p class="card__text"></p>
                  <p class="social__go">見に行く →</p>
                </a>
              `);

              setAttr(card, "href", url);
              setText(card.querySelector(".social__label"), label);
              setText(card.querySelector(".social__title"), title);
              setText(card.querySelector(".card__text"), text);

              socialGrid.appendChild(card);
            });
        }
      }

      // =====================================================
      // 8) Contact（#contact）
      // =====================================================
      const contact = data?.contact;
      if (contact) {
        setText(document.querySelector("#contact .section__sub"), contact.sub ?? "");

        const mailLink = document.querySelector('#contact a[href^="mailto:"]');
        if (mailLink && contact.email) {
          mailLink.href = `mailto:${contact.email}`;
          mailLink.textContent = contact.email;
        }
      }

      // =====================================================
      // 9) Footer
      // =====================================================
      const footer = data?.footer;
      if (footer) {
        setText(document.querySelector(".footer__brand"), footer.brand ?? "");
        setText(document.querySelector(".footer__small"), footer.small ?? "");
      }
    })
    .catch((err) => {
      // JSONが無い/読めない場合は、HTMLに書かれた内容のまま表示（安全）
      console.warn("[Content Loader] skipped:", err);
    });
})();
