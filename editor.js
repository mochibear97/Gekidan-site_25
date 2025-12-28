/**
 * =========================================================
 * editor.js（劇団サイト 更新GUI）
 * =========================================================
 * やりたいこと：
 * 1) 入力フォームで内容を編集
 * 2) content/site.json としてダウンロード
 *
 * 重要：
 * - このGUIは「Gitを触らせない」ことを目的にしているので
 *   編集者は “JSONを出力して渡すだけ” の運用が可能です。
 *
 * 想定オペレーション（編集者）：
 * - editor.html を開く
 * - 文章や日程を編集
 * - 「JSONを書き出す」を押して site.json を保存
 * - 管理者に site.json を送る（Slack/Google Drive/メール等）
 *
 * 管理者（あなた）の作業：
 * - 受け取った site.json を repo の content/site.json に上書き
 * - 公開（GitHub Pagesなら push するだけ）
 * =========================================================
 */


/* =========================================================
 * 🔰 JavaScript初心者向け：このファイルの読み方（C/C++しか触ってない前提）
 * ---------------------------------------------------------
 * まず“単語”だけ押さえると読みやすくなります。
 *
 * ■ const / let
 *  - const: “再代入しない”変数。C++でいう const 変数っぽい。
 *  - let  : “再代入する”変数。C++でいう通常の変数っぽい。
 *
 * ■ Arrow Function（=>）
 *  - const f = (a) => a+1; みたいな短い関数定義。
 *  - C++のラムダに近い（[](){}）。
 *
 * ■ DOM / querySelector
 *  - HTMLの要素（タグ）を JS から掴むのが DOM 操作。
 *  - querySelector("cssセレクタ") は、CSSと同じ書き方で要素を1つ取る。
 *  - querySelectorAll(...) は複数取る（NodeList）→ Array.from で配列にする。
 *
 * ■ addEventListener
 *  - “クリック/入力/送信”などのイベントに処理を登録する。
 *  - C++でいうコールバック登録に近い。
 *
 * ■ JSON
 *  - テキスト形式のデータ。ここでは「サイトの文章や日程」を全部 JSON に入れる。
 *  - editor.html は “JSONを作る道具”、index.html は “JSONを読む側”。
 *
 * ■ このGUIの設計思想（重要）
 *  - 編集者：GUIで入力 → JSONを書き出して送るだけ（Git不要）
 *  - 管理者：受け取った JSON を content/site.json に上書きして push
 * ========================================================= */

// =========================================================
// 0) DOMショートカット
// =========================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ↑ $ / $$ は “DOMショートカット”。
//   - $(...) は 1個だけ取る（見つからなければ null）
//   - $$(...) は 複数取る → Array.from で “本物の配列” にしている
//   - root = document は “デフォルト引数”。指定しなければページ全体から探す


// =========================================================
// 1) 初期テンプレ（「新規作成」用）
//    ※ main.js が読める形に合わせています
// =========================================================
const TEMPLATE = {
  meta: {
    siteTitle: "劇団〇〇｜公式サイト",
    description: "劇団〇〇の公式サイト。最新公演情報、予約、お知らせ、劇団紹介、メンバー、SNS、お問い合わせ。",
    themeColor: "#0b0d12",
  },
  branding: {
    troupeNameJp: "劇団〇〇",
    troupeNameEn: "GEKIDAN XX",
  },
  hero: {
    badge: "次回公演",
    title: "『作品タイトル』",
    lead: "キャッチコピー（1〜2行）。\n例：笑って、泣いて、最後に少しだけ救われる話。",
    metaCards: [
      { label: "日程", value: "2026.02.14–02.16" },
      { label: "会場", value: "〇〇シアター" },
      { label: "料金", value: "前売 ¥3,500" },
    ],
    reserve: { label: "チケット予約", url: "#reserve" },
    note: "※公演詳細はSNSを確認推奨",
    keyVisual: { src: "", alt: "『作品タイトル』メインビジュアル" },
  },
  news: [
    { date: "2025.12.27", title: "次回公演の情報を公開しました", text: "予約開始日・会場などを更新。", link: "" },
  ],
  schedule: {
    sub: "今後の公演予定",
    note: "※ スケジュールは変更になる場合があります。",
    items: [
      { date: "2026.02.14–02.16", title: "第x回公演『作品タイトル』", body: "会場：〇〇シアター\n備考：チケット発売中", link: "" },
    ],
  },
  about: {
    sub: "「何を大事にする劇団か」を一言で。",
    conceptTitle: "コンセプト",
    concept: "例：日常のすぐ横にある感情を、静かに、でも確かな言葉で立ち上げる。",
    historyTitle: "沿革",
    history: [
      { year: "2023", text: "劇団結成" },
      { year: "2024", text: "第1回公演『〇〇』" },
    ],
  },
  members: [
    { name: "〇〇", role: "座長", photo: "", note: "一言コメント。", snsLabel: "個人SNS", snsUrl: "" },
  ],
  socials: {
    sub: "稽古場の空気感や最新情報はSNSで更新しています",
    items: [
      { enabled: true, label: "X", title: "最新情報", text: "公演情報・告知・当日案内", url: "" },
      { enabled: true, label: "YouTube", title: "映像（👷準備中👷）", text: "ダイジェスト・トレーラー", url: "" },
    ],
  },
  contact: {
    sub: "出演依頼・公演のご相談・取材など",
    email: "info@example.com",
  },
  footer: {
    brand: "劇団〇〇",
    small: "© 2025 Gekidan XX. All rights reserved.",
  },
};

// =========================================================
// 2) 状態（ここに編集内容が入る）
// =========================================================
// state は “今フォームで編集している最新データ” を入れる箱。
// structuredClone(...) は “深いコピー（deep copy）”。
// - TEMPLATE をそのまま使うと、編集で TEMPLATE 自体が壊れる危険がある
// - C++でいう「テンプレの構造体を丸ごと複製して別インスタンスにする」イメージ
let state = structuredClone(TEMPLATE);

// =========================================================
// 2.5) 画像アップロード状態（ZIPに同梱するため）
// 重要：
// - ブラウザ上のGUIなので「PCのフォルダへ自動保存」はできません
// - 代わりに「ZIPを書き出す」時に、選んだ画像を ZIP にまとめます
// - 画像は assets/uploads/ 配下に入る想定（運用で変更OK）
// =========================================================
// uploads は「この editor.html が今認識している“画像の一覧”」です。
// ここに入るのは “ファイルを選択した時だけ”。
// - id        : GUI内での識別用（連番やUUID的なもの）
// - name      : 元ファイル名（表示用）
// - path      : サイト側で参照するパス文字列（assets/uploads/xxx.jpg）← JSONに入れるのはこれ
// - file      : ブラウザが持っている File オブジェクト（生データ）
// - bytes     : ZIPを書き出す時に必要なバイナリ（Uint8Array）
// - objectUrl : プレビュー表示用の一時URL（blob:...）
//
// C++的に言うと「メタ情報 + バッファをまとめた構造体配列」です。
let uploads = [];
// uploads: [{ id, name, path, file, bytes(Uint8Array), objectUrl }]

// =========================================================
// 2.6) 既存画像ライブラリ（assets/uploads 参照用）
// - “フォルダの中身を自動で読む”ことはブラウザではできません（セキュリティ）
// - 代わりに、管理者が assets/uploads/manifest.json を用意しておくと
//   その一覧を読み込み、GUIのプルダウン候補として使えます。
// - ここに入る画像は「すでにリポジトリに存在する前提」なので、ZIP書き出しには同梱しません。
// =========================================================
let libraryPaths = []; // 例: ["assets/uploads/a.jpg", "assets/uploads/b.png"]

// =========================================================
// 3) 共通：フォーム <-> state の同期
// =========================================================
function bindText(idPath, opts = {}) {
  // idPath: "meta.siteTitle" のようなパス
  const el = $(`[data-bind="${idPath}"]`);
  if (!el) return;

  // 表示（state -> form）
  const v = getByPath(state, idPath) ?? "";
  el.value = v;

  // 入力（form -> state）
  el.addEventListener("input", () => {
    setByPath(state, idPath, el.value);
    renderPreview(); // 右側プレビュー更新
  });
}

// パス操作（"a.b.c"）

// =========================================================
// パス操作（"a.b.c"）の考え方
// ---------------------------------------------------------
// data-bind="meta.siteTitle" のように、入力フォームは “ドット区切りの道” で
// state の中の値を指定します。
// 例： state.meta.siteTitle にアクセスしたい → "meta.siteTitle"
//
// getByPath: 文字列パス → 値を取り出す
// setByPath: 文字列パス → 値を書き込む（途中が無ければ作る）
//
// JSの ??= は「もし左が null/undefined なら右を代入」。
// C++でいう「未初期化なら new しておく」みたいな保険です。
// =========================================================
function getByPath(obj, path) {
  return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
}
function setByPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((acc, k) => (acc[k] ??= {}), obj);
  target[last] = value;
}

// =========================================================
// 4) 反復アイテム（News / Schedule / Members / History / Socials）
// =========================================================
function renderList(rootSel, items, itemTitleFn, fields, addFn) {
  const root = $(rootSel);
  if (!root) return;

  // 既存の中身を全部消して、state から毎回描画し直す（シンプルで壊れにくい）
  root.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "items";

  // ---------------------------------------------------------
  // 画像候補（assets/uploads/）
  // - editor.html の「画像アップロード」で読み込んだものが並ぶ
  // - 既存JSONにだけ存在するパスもあるので、手入力欄は残す
  // ---------------------------------------------------------
  const getImageCandidates = () => {
    // 画像候補が“空”になる典型パターン：
    // - editor.html 側で画像をまだ読み込んでいない
    // - 画像一覧（manifest）が無い / 読み込みに失敗している
    //
    // この関数は「今 editor に認識されている画像のパス一覧」を返すだけです。
    // なので、まず editor の“画像アップロードUI”で画像を選択 → 候補が増える、という流れになります。

    const fromUploads = (uploads || []).map((u) => u.path).filter(Boolean);
    // 今後 manifest.json 方式にするなら、ここに外部リストを足す
    // const fromManifest = (manifestPaths || []);
    const all = [...fromUploads];
    // 重複除去
    return Array.from(new Set(all));
  };

  
  // resolvePreviewSrc は “プレビューに何を表示するか” を決める関数。
  // - 画像を file input で読み込むと、ブラウザが一時URL（blob:...）を作れる → objectUrl
  // - それがあれば「ローカルの editor.html だけ」でも画像が表示できる
  // - objectUrl が無い場合は、単純に path をそのまま img.src に入れる
  //   ※ その場合、Live Server などで “サイトとして配信” されている必要があることが多い
  const resolvePreviewSrc = (path) => {
    if (!path) return "";
    // 1) 今この editor で読み込んだ画像なら objectUrl で表示（file://でも見える）
    const u = (uploads || []).find((x) => x.path === path);
    if (u?.objectUrl) return u.objectUrl;
    // 2) それ以外はパスをそのまま（Live Server で開いていると表示できる）
    return path;
  };

  items.forEach((item, idx) => {
    const box = document.createElement("div");
    box.className = "item";

    // ===== 見出し（例：Newsのタイトル / メンバー名 など） =====
    const head = document.createElement("div");
    head.className = "itemHead";

    const title = document.createElement("b");
    title.textContent = itemTitleFn ? itemTitleFn(item, idx) : `Item ${idx + 1}`;

    const actions = document.createElement("div");
    actions.className = "itemActions";

    // 上へ / 下へ / 削除
    const up = document.createElement("button");
    up.className = "smallBtn";
    up.type = "button";
    up.textContent = "↑";
    up.title = "上へ";
    up.disabled = idx === 0;
    up.addEventListener("click", () => {
      if (idx === 0) return;
      const tmp = items[idx - 1];
      items[idx - 1] = items[idx];
      items[idx] = tmp;
      renderAll();
    });

    const down = document.createElement("button");
    down.className = "smallBtn";
    down.type = "button";
    down.textContent = "↓";
    down.title = "下へ";
    down.disabled = idx === items.length - 1;
    down.addEventListener("click", () => {
      if (idx === items.length - 1) return;
      const tmp = items[idx + 1];
      items[idx + 1] = items[idx];
      items[idx] = tmp;
      renderAll();
    });

    const del = document.createElement("button");
    del.className = "smallBtn";
    del.type = "button";
    del.textContent = "削除";
    del.addEventListener("click", () => {
      if (!confirm("削除しますか？")) return;
      items.splice(idx, 1);
      renderAll();
    });

    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);

    head.appendChild(title);
    head.appendChild(actions);

    // ===== 入力フォーム（fields 定義を元に生成） =====
    const body = document.createElement("div");

    fields.forEach((f) => {
      const field = document.createElement("div");
      field.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label || f.key;

      // -------------------------------------------------------
      // NEW：画像フィールド
      // - select（候補から選ぶ） + input（手入力） + プレビュー
      // -------------------------------------------------------
      if (f.type === "image") {
        // 🔰 ここは “画像の扱い” の一番大事な前提：
        // --------------------------------------------------
        // このGUIは「画像そのもの（バイナリ）」は保存しません。
        // JSONに入るのは “画像パス文字列” だけです。
        //
        // つまり…
        // - 画像ファイル（jpg/png/webp）は、別途 assets/uploads/ に置く
        // - JSONには "assets/uploads/xxx.jpg" のような文字列だけ入れる
        //
        // なぜ？：
        // - JSONはテキストなので画像を入れると巨大化＆壊れやすい
        // - GitHub Pagesは “静的配信” なので、画像もファイルとして置くのが自然

        // 画像は “パス文字列” を保存するだけ（JSONにバイナリは入れない）
        const row = document.createElement("div");
        row.className = "row";

        const selectWrap = document.createElement("div");
        selectWrap.className = "field";
        selectWrap.style.flex = "1";

        const selLabel = document.createElement("label");
        selLabel.textContent = "画像を選択（assets/uploads/）";

        const sel = document.createElement("select");
        const optEmpty = document.createElement("option");
        optEmpty.value = "";
        optEmpty.textContent = "（なし）";
        sel.appendChild(optEmpty);

        // いま editor に読み込まれている画像候補を入れる
        getImageCandidates().forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p;
          opt.textContent = p.replace(/^assets\/uploads\//, "");
          sel.appendChild(opt);
        });

        // 手入力欄（既存のパスを貼れる）
        const inputWrap = document.createElement("div");
        inputWrap.className = "field";
        inputWrap.style.flex = "1";

        const inLabel = document.createElement("label");
        inLabel.textContent = "画像パス（手入力OK）";

        const inp = document.createElement("input");
        inp.value = item[f.key] ?? "";
        inp.placeholder = f.placeholder || "assets/uploads/xxx.jpg";

        // プレビュー（小さめ）
        const pv = document.createElement("img");
        pv.className = "imgPreviewSmall";
        pv.alt = "preview";
        pv.loading = "lazy";

        const syncPreview = (path) => {
          const src = resolvePreviewSrc(path);
          if (!src) {
            pv.removeAttribute("src");
            pv.style.display = "none";
            return;
          }
          pv.src = src;
          pv.style.display = "block";
        };

        // 初期同期：select が候補にあれば合わせる
        const current = String(item[f.key] ?? "");
        if (current) {
          const has = Array.from(sel.options).some((o) => o.value === current);
          if (has) sel.value = current;
          inp.value = current;
        }
        syncPreview(current);

        // 選んだら：state を更新 → input/preview を同期
        sel.addEventListener("change", () => {
          item[f.key] = sel.value;
          inp.value = sel.value;
          syncPreview(sel.value);
          renderPreview();
        });

        // 手入力したら：state を更新 → select/preview を同期
        inp.addEventListener("input", () => {
          item[f.key] = inp.value;
          const v = inp.value;
          const has = Array.from(sel.options).some((o) => o.value === v);
          sel.value = has ? v : "";
          syncPreview(v);
          renderPreview();
        });

        // 画像候補が0件でも “手入力” できるようにする
        selectWrap.appendChild(selLabel);
        selectWrap.appendChild(sel);

        inputWrap.appendChild(inLabel);
        inputWrap.appendChild(inp);

        // row: [select][input][preview]
        row.appendChild(selectWrap);
        row.appendChild(inputWrap);

        // プレビューは横に置く（スマホでは縦に落ちる）
        const pvWrap = document.createElement("div");
        pvWrap.style.flex = "0 0 auto";
        pvWrap.appendChild(pv);
        row.appendChild(pvWrap);

        field.appendChild(label);
        field.appendChild(row);
        body.appendChild(field);
        return;
      }

      // -------------------------------------------------------
      // 通常のテキスト/textarea
      // -------------------------------------------------------
      let input;
      if (f.type === "textarea") {
        input = document.createElement("textarea");
      } else {
        input = document.createElement("input");
      }

      input.value = item[f.key] ?? "";
      if (f.placeholder) input.placeholder = f.placeholder;

      // 入力が入るたびに state を更新して、右側のJSONも更新
      input.addEventListener("input", () => {
        item[f.key] = input.value;
        renderPreview();
      });

      field.appendChild(label);
      field.appendChild(input);
      body.appendChild(field);
    });

    box.appendChild(head);
    box.appendChild(body);
    wrap.appendChild(box);
  });

  // ===== 「追加」ボタン =====
  const add = document.createElement("button");
  add.className = "smallBtn";
  add.type = "button";
  add.textContent = "＋ 追加";
  add.addEventListener("click", () => {
    items.push(addFn());
    renderAll();
  });

  root.appendChild(wrap);
  root.appendChild(add);
}

// renderAll：リスト描画 + JSONプレビュー更新
function renderAll() {
  renderAllLists();
  renderPreview();
  renderUploads();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderAllLists() {
  // News
  renderList(
    "#newsList",
    state.news,
    (n, i) => `${n.date || "日付"}｜${n.title || "タイトル"}`,
    [
      { key: "date", label: "日付（例 2025.12.27）", placeholder: "2025.12.27" },
      { key: "title", label: "タイトル", placeholder: "お知らせのタイトル" },
      { key: "text", label: "本文（短め）", placeholder: "短い説明（1〜2行）", multiline: true },
      { key: "link", label: "リンク（任意）", placeholder: "https://..." },
    ],
    () => ({ date: "", title: "", text: "", link: "" })
  );

  // Schedule
  renderList(
    "#scheduleList",
    state.schedule.items,
    (s, i) => `${s.date || "日付"}｜${s.title || "タイトル"}`,
    [
      { key: "date", label: "日付（例 2026.02.14–02.16）", placeholder: "2026.02.14–02.16" },
      { key: "title", label: "タイトル", placeholder: "第x回公演『作品タイトル』" },
      { key: "body", label: "本文（改行OK）", placeholder: "会場：...\n備考：...", multiline: true },
      { key: "link", label: "リンク（任意）", placeholder: "https://..." },
    ],
    () => ({ date: "", title: "", body: "", link: "" })
  );

  // About > History
  renderList(
    "#historyList",
    state.about.history,
    (h) => `${h.year || "年"}｜${h.text || "内容"}`,
    [
      { key: "year", label: "年（例 2025）", placeholder: "2025" },
      { key: "text", label: "内容", placeholder: "第2回公演『〇〇』" },
    ],
    () => ({ year: "", text: "" })
  );

  // Members
  renderList(
    "#membersList",
    state.members,
    (m) => `${m.name || "名前"}｜${m.role || "役割"}`,
    [
      { key: "name", label: "名前", placeholder: "〇〇" },
      { key: "role", label: "役割（座長/役者など）", placeholder: "役者" },
      { key: "photo", label: "メンバー写真（任意）", placeholder: "assets/uploads/xxx.jpg", type: "image" },
      { key: "note", label: "一言コメント", placeholder: "自己紹介の短い文章", multiline: true },
      { key: "snsLabel", label: "SNSラベル（任意）", placeholder: "個人SNS" },
      { key: "snsUrl", label: "SNS URL（任意）", placeholder: "https://..." },
    ],
    () => ({ name: "", role: "", photo: "", note: "", snsLabel: "個人SNS", snsUrl: "" })
  );

  // Socials
  renderList(
    "#socialsList",
    state.socials.items,
    (s) => `${s.label || "SNS"}｜${s.title || "タイトル"}`,
    [
      { key: "enabled", label: "表示する？（true/false）※文字でOK", placeholder: "true" },
      { key: "label", label: "ラベル（X / YouTube など）", placeholder: "X" },
      { key: "title", label: "タイトル", placeholder: "最新情報" },
      { key: "text", label: "説明文（短め）", placeholder: "公演情報・告知・当日案内", multiline: true },
      { key: "url", label: "URL", placeholder: "https://..." },
    ],
    () => ({ enabled: true, label: "X", title: "", text: "", url: "" })
  );

  // Socials.enabled を “true/falseの文字” で入れても動くように補正
  state.socials.items.forEach((s) => {
    if (typeof s.enabled === "string") {
      s.enabled = s.enabled.trim().toLowerCase() !== "false";
    }
  });
}

// =========================================================
// 5) 右側：JSONプレビュー
// =========================================================
function renderPreview() {
  const pre = $("#preview");
  if (!pre) return;
  pre.textContent = JSON.stringify(state, null, 2);
}


// =========================================================
// 5.5) 画像アップロード（editor.html から差し替え）
// =========================================================

// 文字化け・危険文字を避けるための “安全なファイル名”
// - スペース → _
// - 日本語は残しても動くが、OS/環境差を避けたいなら英数字推奨
function safeName(name) {
  const base = String(name || "image")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-ぁ-んァ-ヶ一-龠ー]/g, "_"); // ざっくり安全化
  // ドットだけ/空は避ける
  return base.replace(/^_+/, "") || "image";
}

function extOf(name) {
  const m = String(name).match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : "";
}

function uniqueUploadName(desired) {
  const existing = new Set(uploads.map(u => u.name));
  if (!existing.has(desired)) return desired;

  const ext = extOf(desired);
  const stem = desired.replace(new RegExp(`${ext.replace(".", "\\.")}$`), "");
  let i = 2;
  while (existing.has(`${stem}-${i}${ext}`)) i++;
  return `${stem}-${i}${ext}`;
}


// =========================================================
// 画像候補（アップロード済み + 既存ライブラリ）をまとめて返す
// - members.photo や hero.keyVisual.src などで使います
// =========================================================
function getAllImagePaths() {
  const a = uploads.map(u => u.path);
  const b = libraryPaths.slice();
  // 重複排除（順序は “アップロード画像が先” → “既存画像”）
  const out = [];
  const seen = new Set();
  [...a, ...b].forEach(p => {
    if (!p) return;
    if (seen.has(p)) return;
    seen.add(p);
    out.push(p);
  });
  return out;
}

// =========================================================
// 既存画像（manifest.json）を読み込む
// - 推奨：assets/uploads/manifest.json を repo に置く
// - 形式は 2種類対応：
//    A) { "base": "assets/uploads/", "files": ["a.jpg","b.png"] }
//    B) ["a.jpg","b.png"]   ← 配列だけでもOK
// =========================================================
function normalizeManifest(data) {
  if (!data) return { base: "assets/uploads/", files: [] };

  // 配列だけの場合
  if (Array.isArray(data)) {
    return { base: "assets/uploads/", files: data };
  }

  // オブジェクトの場合
  const base = (data.base || "assets/uploads/").replace(/\/+$/, "/");
  const files = Array.isArray(data.files) ? data.files : [];
  return { base, files };
}

async function loadUploadsManifestByFetch(url = "assets/uploads/manifest.json") {
  // cache を切って “更新した manifest” を取りやすくする
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  const data = await res.json();
  return normalizeManifest(data);
}

function loadUploadsManifestByFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result || ""));
        resolve(normalizeManifest(data));
      } catch (e) {
        reject(e);
      }
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}

function applyManifestToLibrary(man, opts = {}) {
  const silent = !!opts.silent;
  // files: ["a.jpg"] の場合と ["assets/uploads/a.jpg"] の場合どちらも吸収
  const base = (man.base || "assets/uploads/").replace(/\/+$/, "/");
  const paths = (man.files || []).map(f => {
    if (!f) return "";
    // すでに "assets/..." で始まっているならそれを採用
    if (/^assets\//.test(f)) return f;
    return `${base}${String(f).replace(/^\/+/, "")}`;
  }).filter(Boolean);

  // libraryPaths にマージ（重複排除）
  const seen = new Set(libraryPaths);
  paths.forEach(p => {
    if (!seen.has(p)) {
      libraryPaths.push(p);
      seen.add(p);
    }
  });

  if (!silent) toast(`既存画像を ${paths.length} 件読み込みました ✅`);
  renderUploads();     // 画像一覧を更新（同じ一覧に表示する）
  renderAllLists();    // Members などのプルダウン候補を更新
  renderPreview();
}

// JSON内の文字列（パス）を、古いもの→新しいものに置換する（深い再帰）
function replaceStringDeep(obj, from, to) {
  if (!from || from === to) return;

  const walk = (v) => {
    if (typeof v === "string") return v === from ? to : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      Object.keys(v).forEach((k) => (v[k] = walk(v[k])));
      return v;
    }
    return v;
  };

  walk(obj);
}

// 画像一覧（サムネ / パス / 操作）

function renderUploads() {
  const root = $("#imageList");
  if (!root) return;
  root.innerHTML = "";

  const hasNew = uploads.length > 0;
  const hasLib = libraryPaths.length > 0;

  if (!hasNew && !hasLib) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = "（まだ画像は追加されていません）";
    root.appendChild(p);
    return;
  }

  // =========================================================
  // 表示順：
  // 1) upload：このGUIで追加した画像（ZIPに同梱される）
  // 2) library：既存ライブラリ（manifestから読み込んだ、すでにrepoにある画像）
  // =========================================================
  const items = [
    ...uploads.map(u => ({
      kind: "upload",
      name: u.name,
      path: u.path,
      thumb: u.objectUrl || u.path, // objectURL があればそれ優先
      u,
    })),
    ...libraryPaths.map(p => ({
      kind: "library",
      name: (String(p).split("/").pop() || p),
      path: p,
      thumb: p, // 既存画像はパスをそのまま参照（※editor.html をサーバで開いている必要あり）
    })),
  ];

  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "imgRow";

    // ---- サムネ
    const th = document.createElement("div");
    th.className = "imgThumb";

    // 画像が表示できない環境（file://直開き等）でも壊れないように try
    const img = document.createElement("img");
    img.src = it.thumb;
    img.alt = it.name;
    img.onerror = () => {
      th.textContent = "IMG";
      img.remove();
    };
    th.appendChild(img);

    // ---- 右側
    const meta = document.createElement("div");
    meta.className = "imgMeta";

    // ラベル（UPLOAD / LIB）
    const kindTag = document.createElement("div");
    kindTag.className = "imgKind";
    kindTag.textContent = it.kind === "upload" ? "UPLOAD（ZIP同梱）" : "LIB（既存）";

    // 名前（upload は変更可 / library は表示のみ）
    const nameField = document.createElement("div");
    nameField.className = "imgName";

    if (it.kind === "upload") {
      const u = it.u;

      const nameInput = document.createElement("input");
      nameInput.value = u.name;
      nameInput.placeholder = "filename.png";
      nameInput.addEventListener("change", () => {
        // 入力を安全なファイル名に整形
        const next = uniqueUploadName(safeName(nameInput.value || u.name));

        // 表示の揺れを減らす（入力欄は確定した名前に戻す）
        nameInput.value = next;

        // ここでファイル名を変更 → パスも変更
        const oldPath = u.path;
        u.name = next;
        u.path = `assets/uploads/${u.name}`;

        // JSON内で古いパスを使っていたら全部追従
        replaceStringDeep(state, oldPath, u.path);

        renderPreview();
        renderUploads();
        renderAllLists(); // 画像プルダウンの候補も更新
      });

      nameField.appendChild(nameInput);
    } else {
      const label = document.createElement("div");
      label.className = "help";
      label.textContent = `${it.name}（変更不可）`;
      nameField.appendChild(label);
    }

    // パス表示
    const path = document.createElement("div");
    path.className = "imgPath";
    path.textContent = it.path;

    // アクション
    const actions = document.createElement("div");
    actions.className = "imgActions";

    // パスコピー
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "smallBtn smallBtn--tag";
    copyBtn.textContent = "パスをコピー";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(it.path);
        toast("パスをコピーしました ✅");
      } catch {
        // クリップボードが使えない環境向け
        prompt("このパスをコピーしてください", it.path);
      }
    });

    // キービジュアルに設定（hero.keyVisual.src）
    const setKvBtn = document.createElement("button");
    setKvBtn.type = "button";
    setKvBtn.className = "smallBtn";
    setKvBtn.textContent = "キービジュアルにする";
    setKvBtn.addEventListener("click", () => {
      state.hero.keyVisual.src = it.path;

      // 入力欄も即反映（data-bindを使っているのでOK）
      const kvInput = $(`[data-bind="hero.keyVisual.src"]`);
      if (kvInput) kvInput.value = it.path;

      renderPreview();
      toast("キービジュアルを更新しました ✅");
    });

    actions.appendChild(copyBtn);
    actions.appendChild(setKvBtn);

    // 削除：upload は完全削除 / library は “一覧から外す” だけ
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "smallBtn smallBtn--danger";
    delBtn.textContent = it.kind === "upload" ? "削除" : "一覧から外す";

    delBtn.addEventListener("click", () => {
      if (it.kind === "upload") {
        const u = it.u;

        // 参照がこの画像なら空に戻す（最低限）
        if (state?.hero?.keyVisual?.src === u.path) {
          state.hero.keyVisual.src = "";
          const kvInput = $(`[data-bind="hero.keyVisual.src"]`);
          if (kvInput) kvInput.value = "";
        }

        if (u.objectUrl) URL.revokeObjectURL(u.objectUrl);
        uploads = uploads.filter((x) => x.id !== u.id);
      } else {
        // library は “このGUIでの候補から外す” だけ（実ファイルは消えません）
        libraryPaths = libraryPaths.filter(p => p !== it.path);
      }

      renderPreview();
      renderUploads();
      renderAllLists();
      renderAllLists();
    });

    actions.appendChild(delBtn);

    meta.appendChild(kindTag);
    meta.appendChild(nameField);
    meta.appendChild(path);
    meta.appendChild(actions);

    row.appendChild(th);
    row.appendChild(meta);

    root.appendChild(row);
  });
}


function fileToBytes(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

// 複数ファイルを uploads に追加
async function addUploadFiles(files, { preferName } = {}) {
  const list = Array.from(files || []);
  if (list.length === 0) return;

  for (const f of list) {
    const desired = preferName ? `${preferName}${extOf(f.name) || ""}` : safeName(f.name);
    const name = uniqueUploadName(desired || "image");
    const bytes = await fileToBytes(f);
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const objectUrl = URL.createObjectURL(f);

    uploads.push({
      id,
      name,
      path: `assets/uploads/${name}`,
      file: f,
      bytes,
      objectUrl,
    });
  }

  renderUploads();
}

// =========================================================
// 5.6) ZIP書き出し（画像 + JSON）
// ※ 外部ライブラリ無しで “Store（無圧縮）ZIP” を生成します
// =========================================================

// CRC32（ZIPに必須）
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function u16(n) {
  return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
}
function u32(n) {
  return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
}
function concatBytes(chunks) {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  chunks.forEach((c) => { out.set(c, off); off += c.length; });
  return out;
}
function strBytes(s) {
  // UTF-8
  return new TextEncoder().encode(s);
}

// 最小ZIP（無圧縮）
function buildZip(files) {
  // files: [{path, bytes}]
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((f) => {
    const nameB = strBytes(f.path);
    const dataB = f.bytes;
    const crc = crc32(dataB);

    // ---- Local file header ----
    const local = concatBytes([
      u32(0x04034b50), // signature
      u16(20),         // version needed
      u16(0),          // flags
      u16(0),          // method: 0=store
      u16(0), u16(0),  // time/date (0)
      u32(crc),
      u32(dataB.length),
      u32(dataB.length),
      u16(nameB.length),
      u16(0),          // extra length
      nameB,
      dataB,
    ]);

    localParts.push(local);

    // ---- Central directory ----
    const central = concatBytes([
      u32(0x02014b50), // signature
      u16(20),         // version made by
      u16(20),         // version needed
      u16(0),          // flags
      u16(0),          // method
      u16(0), u16(0),  // time/date
      u32(crc),
      u32(dataB.length),
      u32(dataB.length),
      u16(nameB.length),
      u16(0),          // extra
      u16(0),          // comment
      u16(0),          // disk start
      u16(0),          // internal attrs
      u32(0),          // external attrs
      u32(offset),     // local header offset
      nameB,
    ]);

    centralParts.push(central);
    offset += local.length;
  });

  const centralDir = concatBytes(centralParts);
  const localDir = concatBytes(localParts);

  const end = concatBytes([
    u32(0x06054b50), // EOCD signature
    u16(0), u16(0),  // disk numbers
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(localDir.length),
    u16(0),          // comment length
  ]);

  return concatBytes([localDir, centralDir, end]);
}

function yyyyMMdd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

async function downloadZIP() {
  // 1) site.json
  const jsonText = JSON.stringify(state, null, 2);
  const jsonBytes = new TextEncoder().encode(jsonText);

  // 2) 画像（uploads） - まだ bytes を持ってない場合は生成
  //    ※ 今回は addUploadFiles で bytes を持つので基本不要
  const imageFiles = uploads.map((u) => ({
    path: `assets/uploads/${u.name}`,
    bytes: u.bytes,
  }));

  // 3) 管理者向けメモ
  const readme = `【更新パックの使い方】
1) このZIPを展開
2) 展開した “content/site.json” を、公開用フォルダの同名ファイルに上書き
3) “assets/uploads/” 配下の画像も、公開用フォルダに上書き/追加
4) GitHub Pages運用なら push で反映

※ 編集者はGit不要。ZIPを管理者に渡すだけでOK。
`;
  const readmeBytes = new TextEncoder().encode(readme);

  const files = [
    { path: "content/site.json", bytes: jsonBytes },
    { path: "README_UPDATE.txt", bytes: readmeBytes },
    ...imageFiles,
  ];

  const zipBytes = buildZip(files);
  const blob = new Blob([zipBytes], { type: "application/zip" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `update_pack_${yyyyMMdd()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("ZIPを書き出しました ✅");
}

// =========================================================
// 6) JSONの読み込み/書き出し
// =========================================================
function downloadJSON() {
  // ===== 編集ポイント：ファイル名（固定でOK） =====
  const filename = "site.json";

  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function loadJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state = normalize(parsed);
      initBindings(true);
      renderAllLists();
      renderPreview();
      toast("読み込みました ✅");
    } catch (e) {
      console.error(e);
      toast("JSONの読み込みに失敗しました", true);
    }
  };
  reader.readAsText(file, "utf-8");
}

// 既存JSONが少し欠けてても落ちないように補完
function normalize(obj) {
  const merged = structuredClone(TEMPLATE);

  // 深いマージ（最小実装）
  const deepMerge = (t, s) => {
    Object.keys(s || {}).forEach((k) => {
      if (Array.isArray(s[k])) t[k] = s[k];
      else if (s[k] && typeof s[k] === "object") t[k] = deepMerge(t[k] ?? {}, s[k]);
      else t[k] = s[k];
    });
    return t;
  };

  const out = deepMerge(merged, obj || {});

  // ===== 互換性：古いJSONには members[].photo が無い場合がある =====
  // GUIで写真を選べるよう、無ければ空文字を入れておく
  if (Array.isArray(out.members)) {
    out.members.forEach((m) => {
      if (m && typeof m === "object" && m.photo == null) m.photo = "";
    });
  }

  return out;
}

// =========================================================
// 7) 初期化
// =========================================================
function initBindings(force = false) {
  // bindText は初回だけでOKだが、JSON読み込み後は value を入れ直したい
  const bindings = [
    "meta.siteTitle",
    "meta.description",
    "meta.themeColor",
    "branding.troupeNameJp",
    "branding.troupeNameEn",
    "hero.badge",
    "hero.title",
    "hero.lead",
    "hero.metaCards.0.label",
    "hero.metaCards.0.value",
    "hero.metaCards.1.label",
    "hero.metaCards.1.value",
    "hero.metaCards.2.label",
    "hero.metaCards.2.value",
    "hero.reserve.label",
    "hero.reserve.url",
    "hero.note",
    "hero.keyVisual.src",
    "hero.keyVisual.alt",
    "schedule.sub",
    "schedule.note",
    "about.sub",
    "about.conceptTitle",
    "about.concept",
    "about.historyTitle",
    "socials.sub",
    "contact.sub",
    "contact.email",
    "footer.brand",
    "footer.small",
  ];

  bindings.forEach((p) => bindText(p));
  renderPreview();
}

function toast(msg, isError = false) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.style.borderColor = isError ? "rgba(255,80,80,0.6)" : "rgba(178,58,58,0.55)";
  el.style.opacity = "1";
  setTimeout(() => (el.style.opacity = "0"), 2200);
}

// =========================================================
// 8) 起動
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
  // JSON読み込み
  // =========================================================
  // 既存画像（assets/uploads/manifest.json）読み込み
  // - 通常は管理者が repo に manifest.json を置いておく
  // - 編集者は「読み込む」ボタン1回で、画像候補が出るようになる
  // - file:// 直開きで fetch が動かない場合は「manifest.json を選ぶ」を使う
  // =========================================================
  const loadBtn = $("#loadUploadsBtn");
  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      try {
        const man = await loadUploadsManifestByFetch("assets/uploads/manifest.json");
        applyManifestToLibrary(man);
      } catch (e) {
        console.warn(e);
        toast("読み込み失敗：Live Server で開くか、manifest.json を選んでください");
      }
    });
  }

  const loadFile = $("#loadUploadsFile");
  if (loadFile) {
    loadFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const man = await loadUploadsManifestByFile(file);
        applyManifestToLibrary(man);
      } catch (err) {
        console.warn(err);
        toast("manifest.json の形式が不正です");
      }
      e.target.value = "";
    });
  }

  // 起動時に “静かに” 読み込みを試す（置いてある場合だけ反映）
  // ※ うるさくならないように toast は出しません
  (async () => {
    try {
      const man = await loadUploadsManifestByFetch("assets/uploads/manifest.json");
      applyManifestToLibrary(man, { silent: true });
    } catch {
      // 置いてない/読めないなら何もしない
    }
  })();


  $("#loadJson").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) loadJSONFile(file);
    e.target.value = ""; // 同じファイルを再読み込みできるように
  });

// JSON書き出し（文章だけ更新したい時）
$("#downloadJson").addEventListener("click", downloadJSON);

// 🔰 ブラウザ上の制約（大事）
// ----------------------------------------------------------
// Webページ（editor.html）は、勝手にPCのフォルダへ“上書き保存”できません。
// セキュリティ上、できるのは「ダウンロードさせる」ことまで。
// だからこのGUIは、更新結果を site.json / zip として “ダウンロード” し、
// それを管理者に送る運用になっています。


// ZIP書き出し（画像も同梱：推奨）
const zipBtn = $("#downloadZip");
if (zipBtn) zipBtn.addEventListener("click", downloadZIP);

// キービジュアル画像（選んだら自動でパスを入れる）
const kvInput = $("#kvFile");
if (kvInput) {
  kvInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 既に “keyvisual” 名のアップロードがあるなら差し替え（運用しやすくする）
    // - 差し替えたら、state.hero.keyVisual.src も維持して更新
    // - ファイル名は keyvisual + 拡張子 に固定（後から一覧で変更可能）
    const prefer = "keyvisual";
    await addUploadFiles([file], { preferName: prefer });

    // 最新の “keyvisual” をキービジュアルに設定
    const u = uploads[uploads.length - 1];
    if (u) {
      state.hero.keyVisual.src = u.path;
      const kvPath = $(`[data-bind="hero.keyVisual.src"]`);
      if (kvPath) kvPath.value = u.path;
    }

    renderPreview();
    renderUploads();
    toast("キービジュアル画像を追加しました ✅");

    e.target.value = "";
  });
}

// 画像を追加（複数）
const imgInput = $("#imgFiles");
if (imgInput) {
  imgInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    await addUploadFiles(files);
    renderUploads();
    toast(`画像を追加しました（${files.length}件） ✅`);

    e.target.value = "";
  });
}

  // 新規作成（テンプレに戻す）
  $("#reset").addEventListener("click", () => {
    state = structuredClone(TEMPLATE);
    initBindings(true);
    renderAllLists();
    renderPreview();
    toast("テンプレに戻しました");
  });

  initBindings();
  renderAllLists();
  renderPreview();
});
