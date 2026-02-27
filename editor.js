// =====================================================
// site.def GUI editor
// - auto form generation (all keys)
// - repeat groups add/remove (news/schedule/members/socials/history)
// - Google Drive thumbnail preview for image URLs
// - Drag & Drop import of site.def (local file)
// - Diff viewer (before/after, changed keys only) + revert
// - live preview via postMessage to iframe (parseDef/applyStateToDom in main.js)
// =====================================================

const PREVIEW_ORIGIN = location.origin;
const frame = document.getElementById("previewFrame");

const btnReload = document.getElementById("btnReload");
const btnDiff = document.getElementById("btnDiff");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");

const dropZone = document.getElementById("dropZone");
const btnPick = document.getElementById("btnPick");
const filePicker = document.getElementById("filePicker");

const diffModal = document.getElementById("diffModal");
const diffBody = document.getElementById("diffBody");
const btnApplyRevertAll = document.getElementById("btnApplyRevertAll");

const formRoot = document.getElementById("formRoot");

// repo の実体は content/site.def
const DEF_CANDIDATES = ["../content/site.def", "../site.def"];

const PREFIX_TO_SECTION_SELECTOR = new Map([
  ["meta", "head"],
  ["branding", "header"],
  ["hero", ".hero"],
  ["news", "#news"],
  ["schedule", "#schedule"],
  ["about", "#about"],
  ["history", "#about"],
  ["members", "#members"],
  ["socials", "#follow"],
  ["contact", "#contact"],
  ["footer", "footer"],
]);

let baseDefText = "";
let stateMap = new Map();     // current
let labelMap = new Map();     // key -> label
let beforeMap = new Map();    // snapshot for diff (loaded from remote or imported file)

// -------------------------
// fetch / parse
// -------------------------
async function fetchDef() {
  for (const url of DEF_CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return await res.text();
    } catch {}
  }
  return "";
}

function parseDefWithLabels(text) {
  const values = new Map();
  const labels = new Map();

  const lines = String(text || "").split(/\r?\n/);
  let lastHumanLabel = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith(";")) {
      const t = line.replace(/^;+/, "").trim();
      if (t) lastHumanLabel = t;
      continue;
    }
    if (line.startsWith("#")) continue;

    const eq = raw.indexOf("=");
    if (eq < 0) continue;

    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (!key) continue;

    values.set(key, value);

    if (lastHumanLabel && !/^[=]+$/.test(lastHumanLabel)) {
      labels.set(key, lastHumanLabel);
    }
    lastHumanLabel = "";
  }
  return { values, labels };
}

function buildDefText(map, originalText) {
  const lines = String(originalText || "").split(/\r?\n/);
  const out = lines.map((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    if (trimmed.startsWith(";") || trimmed.startsWith("#")) return raw;

    const eq = raw.indexOf("=");
    if (eq < 0) return raw;

    const key = raw.slice(0, eq).trim();
    if (!key) return raw;

    if (!map.has(key)) return raw;

    const left = raw.slice(0, eq).replace(/\s+$/, "");
    return `${left} = ${map.get(key) ?? ""}`;
  });

  const existingKeys = new Set();
  for (const raw of lines) {
    const eq = raw.indexOf("=");
    if (eq < 0) continue;
    const key = raw.slice(0, eq).trim();
    if (key) existingKeys.add(key);
  }

  const extras = [];
  for (const [k, v] of map.entries()) {
    if (!existingKeys.has(k) && String(v || "").trim() !== "") {
      extras.push(`${k} = ${v}`);
    }
  }
  if (extras.length) {
    out.push("");
    out.push("; ===== editor から追記 =====");
    out.push(...extras);
  }

  return out.join("\n");
}

// -------------------------
// thumbnails (Google Drive)
// -------------------------
function extractDriveId(url) {
  if (!url) return null;
  const s = String(url);

  let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  m = s.match(/uc\?id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  return null;
}
function toThumbUrl(url) {
  const id = extractDriveId(url);
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w320`;
  return url;
}

// -------------------------
// preview bridge
// -------------------------
function sendToPreview({ focusPrefix } = {}) {
  const defText = buildDefText(stateMap, baseDefText);
  const selector = focusPrefix ? (PREFIX_TO_SECTION_SELECTOR.get(focusPrefix) || null) : null;

  frame.contentWindow?.postMessage(
    { type: "def:update", defText, selector },
    PREVIEW_ORIGIN
  );
}

function installPreviewBridge() {
  const doc = frame.contentDocument;
  if (!doc) return;

  const style = doc.createElement("style");
  style.textContent = `
    .__def_flash__{
      outline: 3px solid rgba(178,58,58,.9) !important;
      box-shadow: 0 0 0 6px rgba(178,58,58,.25) !important;
      border-radius: 12px;
      transition: outline .15s ease, box-shadow .15s ease;
    }
  `;
  doc.head.appendChild(style);

  frame.contentWindow.addEventListener("message", (ev) => {
    if (ev.origin !== PREVIEW_ORIGIN) return;
    const msg = ev.data;
    if (!msg || msg.type !== "def:update") return;

    try {
      const st = frame.contentWindow.parseDef(msg.defText);
      frame.contentWindow.applyStateToDom(st);

      if (msg.selector) {
        const el = doc.querySelector(msg.selector);
        if (el) {
          el.classList.remove("__def_flash__");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          requestAnimationFrame(() => {
            el.classList.add("__def_flash__");
            setTimeout(() => el.classList.remove("__def_flash__"), 900);
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  sendToPreview();
}

// -------------------------
// form generation
// -------------------------
function keyPrefix(key) {
  const i = key.indexOf(".");
  return i >= 0 ? key.slice(0, i) : key;
}

function isRepeatKey(key) {
  return /^(news|schedule|members|socials|history)\.\d+\./.test(key);
}

function repeatMeta(key) {
  const m = key.match(/^(news|schedule|members|socials|history)\.(\d+)\.(.+)$/);
  if (!m) return null;
  return { group: m[1], index: Number(m[2]), field: m[3] };
}

function humanLabelForKey(key) {
  if (labelMap.has(key)) return labelMap.get(key);
  return key;
}

function makeField(key) {
  const label = humanLabelForKey(key);
  const val = stateMap.get(key) ?? "";
  const isLong = String(val).length > 60 || /(\.text|\.lead|description|concept)$/.test(key);

  const wrap = document.createElement("label");
  wrap.className = "field";

  const span = document.createElement("span");
  span.textContent = label;
  wrap.appendChild(span);

  const input = isLong ? document.createElement("textarea") : document.createElement("input");
  if (isLong) input.rows = 3;
  input.value = val;
  input.dataset.key = key;

  input.addEventListener("input", () => {
    stateMap.set(key, input.value);
    sendToPreview({ focusPrefix: keyPrefix(key) });

    if (wrap.__thumbImg) {
      wrap.__thumbImg.src = input.value ? toThumbUrl(input.value) : "";
    }
  });

  const isImageLike = /(photo|ogImage|keyVisual\.src)$/i.test(key);
  if (isImageLike) {
    const row = document.createElement("div");
    row.className = "thumbRow";

    const img = document.createElement("img");
    img.className = "thumb";
    img.alt = "thumbnail";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = val ? toThumbUrl(val) : "";
    wrap.__thumbImg = img;

    row.appendChild(img);
    row.appendChild(input);
    wrap.appendChild(row);
  } else {
    wrap.appendChild(input);
  }

  return wrap;
}

function render() {
  formRoot.innerHTML = "";

  const repeat = {
    news: new Map(),
    schedule: new Map(),
    members: new Map(),
    socials: new Map(),
    history: new Map(),
  };
  const singles = new Map();

  for (const key of Array.from(stateMap.keys()).sort()) {
    if (isRepeatKey(key)) {
      const meta = repeatMeta(key);
      if (!meta) continue;
      if (!repeat[meta.group].has(meta.index)) repeat[meta.group].set(meta.index, []);
      repeat[meta.group].get(meta.index).push(key);
    } else {
      const p = keyPrefix(key);
      if (!singles.has(p)) singles.set(p, []);
      singles.get(p).push(key);
    }
  }

  const makeSection = (title, toolsNode) => {
    const sec = document.createElement("section");
    sec.className = "section";

    const head = document.createElement("div");
    head.className = "section__head";

    const h = document.createElement("h2");
    h.className = "section__title";
    h.textContent = title;

    head.appendChild(h);

    const tools = document.createElement("div");
    tools.className = "section__tools";
    if (toolsNode) tools.appendChild(toolsNode);
    head.appendChild(tools);

    sec.appendChild(head);
    return sec;
  };

  // singles
  for (const [p, keys] of singles.entries()) {
    const sec = makeSection(p.toUpperCase(), null);
    keys.forEach((k) => sec.appendChild(makeField(k)));
    formRoot.appendChild(sec);
  }

  // repeats
  const repeatOrder = ["news", "schedule", "history", "members", "socials"];

  repeatOrder.forEach((group) => {
    const addBtn = document.createElement("button");
    addBtn.className = "btn";
    addBtn.textContent = `+ ${group.toUpperCase()} 追加`;

    const sec = makeSection(group.toUpperCase(), addBtn);

    const items = Array.from(repeat[group].keys()).sort((a, b) => a - b);
    const maxIndex = items.length ? Math.max(...items) : 0;

    function defaultFieldsForGroup(g) {
      if (g === "news") return ["date", "title", "text", "url"];
      if (g === "schedule") return ["date", "title", "place", "note", "url"];
      if (g === "members") return ["enabled", "name", "role", "note", "photo", "snsLabel", "snsUrl"];
      if (g === "socials") return ["enabled", "label", "title", "text", "url"];
      if (g === "history") return ["year", "text"];
      return [];
    }

    addBtn.addEventListener("click", () => {
      const next = maxIndex + 1;
      const fields = defaultFieldsForGroup(group);
      fields.forEach((f) => {
        const k = `${group}.${next}.${f}`;
        if (!stateMap.has(k)) stateMap.set(k, f === "enabled" ? "true" : "");
      });
      render();
      sendToPreview({ focusPrefix: group });
    });

    items.forEach((idx) => {
      const wrap = document.createElement("div");
      wrap.className = "repeatItem";

      const head = document.createElement("div");
      head.className = "repeatItem__head";

      const t = document.createElement("div");
      t.className = "repeatItem__title";
      t.innerHTML = `<span class="badge">${group}.${idx}</span>`;

      const del = document.createElement("button");
      del.className = "btn";
      del.textContent = "削除";
      del.addEventListener("click", () => {
        const keys = repeat[group].get(idx) || [];
        keys.forEach((k) => {
          if (k.endsWith(".enabled")) stateMap.set(k, "false");
          else stateMap.set(k, "");
        });
        sendToPreview({ focusPrefix: group });
        render();
      });

      head.appendChild(t);
      head.appendChild(del);
      wrap.appendChild(head);

      (repeat[group].get(idx) || []).sort().forEach((k) => wrap.appendChild(makeField(k)));
      sec.appendChild(wrap);
    });

    formRoot.appendChild(sec);
  });
}

// -------------------------
// Drag & Drop import
// -------------------------
function setDropActive(active) {
  dropZone.style.outline = active ? "2px solid rgba(178,58,58,.9)" : "";
  dropZone.style.boxShadow = active ? "0 0 0 6px rgba(178,58,58,.25)" : "";
}

async function loadDefText(text, sourceName = "imported") {
  baseDefText = text; // 原本として保持（コメント/並び維持）
  const parsed = parseDefWithLabels(text);
  stateMap = parsed.values;
  labelMap = parsed.labels;

  // diff用 before snapshot を更新（import したものが基準になる）
  beforeMap = new Map(stateMap);

  render();
  sendToPreview();

  console.log(`Loaded def from ${sourceName}`);
}

async function handleFile(file) {
  if (!file) return;
  const text = await file.text();
  await loadDefText(text, file.name);
}

dropZone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  setDropActive(true);
});
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  setDropActive(true);
});
dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  setDropActive(false);
});
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  setDropActive(false);
  const file = e.dataTransfer?.files?.[0];
  await handleFile(file);
});

btnPick.addEventListener("click", (e) => {
  e.preventDefault();
  filePicker.click();
});
filePicker.addEventListener("change", async () => {
  const file = filePicker.files?.[0];
  await handleFile(file);
  filePicker.value = "";
});

// -------------------------
// Diff viewer
// -------------------------
function normalize(v) {
  return String(v ?? "").trim();
}

function computeDiff(before, after) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changed = [];
  keys.forEach((k) => {
    const b = normalize(before.get(k));
    const a = normalize(after.get(k));
    if (b !== a) {
      changed.push({ key: k, before: before.get(k) ?? "", after: after.get(k) ?? "" });
    }
  });
  changed.sort((x, y) => x.key.localeCompare(y.key));
  return changed;
}

function openDiff() {
  const diff = computeDiff(beforeMap, stateMap);

  if (!diff.length) {
    diffBody.innerHTML = `<div style="color:rgba(255,255,255,.7);padding:10px;">差分はありません。</div>`;
  } else {
    diffBody.innerHTML = "";
    const list = document.createElement("div");
    list.className = "diffList";

    diff.forEach((d) => {
      const row = document.createElement("div");
      row.className = "diffRow";

      const key = document.createElement("div");
      key.className = "diffKey";
      key.textContent = d.key;

      const before = document.createElement("pre");
      before.className = "diffVal diffVal--before";
      before.textContent = d.before;

      const after = document.createElement("pre");
      after.className = "diffVal diffVal--after";
      after.textContent = d.after;

      const tools = document.createElement("div");
      tools.className = "diffTools";

      const revert = document.createElement("button");
      revert.className = "btn";
      revert.textContent = "このキーだけ元に戻す";
      revert.addEventListener("click", () => {
        stateMap.set(d.key, d.before);
        render();
        sendToPreview({ focusPrefix: keyPrefix(d.key) });
        openDiff();
      });

      tools.appendChild(revert);

      row.appendChild(key);
      row.appendChild(before);
      row.appendChild(after);
      row.appendChild(tools);

      list.appendChild(row);
    });

    diffBody.appendChild(list);
  }

  diffModal.hidden = false;
}

function closeDiff() {
  diffModal.hidden = true;
}

btnDiff.addEventListener("click", () => openDiff());
diffModal.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.dataset && t.dataset.close === "1") closeDiff();
});

btnApplyRevertAll.addEventListener("click", () => {
  stateMap = new Map(beforeMap);
  render();
  sendToPreview();
  openDiff();
});

// Inject CSS for modal/drop/diff
(function injectDiffCss(){
  const css = `
  .modal{ position:fixed; inset:0; z-index:50; display:grid; place-items:center; }
  .modal__backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.6); }
  .modal__panel{
    position:relative;
    width:min(1100px, 92vw);
    height:min(80vh, 900px);
    background:rgba(18,21,34,.98);
    border:1px solid rgba(255,255,255,.12);
    border-radius:18px;
    overflow:hidden;
    box-shadow: 0 20px 80px rgba(0,0,0,.55);
  }
  .modal__head{
    display:flex; align-items:center; justify-content:space-between;
    gap:10px;
    padding:12px 14px;
    border-bottom:1px solid rgba(255,255,255,.12);
  }
  .modal__title{ font-weight:900; }
  .modal__tools{ display:flex; gap:8px; flex-wrap:wrap; }
  .modal__body{ padding:12px; overflow:auto; height: calc(100% - 54px); }

  .dropZone{
    border:1px dashed rgba(255,255,255,.25);
    border-radius:16px;
    padding:12px;
    background: rgba(255,255,255,0.03);
  }
  .dropZone__title{ font-weight:800; }
  .dropZone__sub{ margin-top:6px; color:rgba(255,255,255,.7); font-size:12px; }
  .btn--mini{ padding:6px 10px; border-radius:10px; font-size:12px; }

  .diffRow{
    border:1px solid rgba(255,255,255,.12);
    border-radius:16px;
    padding:10px;
    margin-bottom:10px;
    background: rgba(255,255,255,0.03);
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:10px;
  }
  .diffKey{
    grid-column: 1 / -1;
    font-weight:800;
    color:rgba(255,255,255,.9);
  }
  .diffVal{
    margin:0;
    padding:10px;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.25);
    white-space:pre-wrap;
    word-break:break-word;
    min-height:44px;
  }
  .diffVal--before{ opacity:.9; }
  .diffVal--after{ outline: 2px solid rgba(178,58,58,.6); }
  .diffTools{
    grid-column: 1 / -1;
    display:flex;
    justify-content:flex-end;
  }
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();

// -------------------------
// clipboard / download
// -------------------------
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// -------------------------
// init
// -------------------------
async function init() {
  const remoteDef = await fetchDef();
  if (!remoteDef) {
    alert("content/site.def が見つかりません。リポジトリに content/site.def があるか確認してください。");
    return;
  }

  await loadDefText(remoteDef, "remote content/site.def");

  frame.addEventListener("load", () => {
    installPreviewBridge();
  });

  btnReload.addEventListener("click", async () => {
    const txt = await fetchDef();
    if (!txt) return;
    await loadDefText(txt, "remote reload");
  });

  btnDownload.addEventListener("click", () => {
    const defText = buildDefText(stateMap, baseDefText);
    downloadText("site.def", defText);
  });

  btnCopy.addEventListener("click", async () => {
    const defText = buildDefText(stateMap, baseDefText);
    try {
      await copyToClipboard(defText);
      alert("コピーしました。");
    } catch {
      alert("コピーに失敗しました。ダウンロードを使ってください。");
    }
  });
}

init();
