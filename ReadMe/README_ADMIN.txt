# README_ADMIN（管理者向け：公開反映担当）

このREADMEは、**編集者がGUI（editor.html）で作った「更新ZIP」**を受け取り、**GitHub Pagesに反映（公開）**する手順です。  
編集者はGitを触りません。**公開反映は管理者だけ**が行います。

---

## 0. まず結論：管理者の作業はこれだけ

1) 編集者から届いた `update_pack_YYYYMMDD.zip` を展開  
2) 展開された `content/site.json` を **repoの `content/site.json` に上書き**  
3) 展開された `assets/uploads/*` を **repoの `assets/uploads/` に追加/上書き**（画像がある場合のみ）  
4) （任意・推奨）`assets/uploads/manifest.json` を更新（画像一覧）  
5) `git commit` → `git push`  
6) GitHub Pages が自動反映（数十秒〜数分）

---

## 1. 事前のフォルダ構成（repo側の想定）

```
/
  index.html
  styles.css
  main.js
  editor.html
  editor.js
  editor.css
  content/
    site.json          ← 本番データ（編集内容）
  assets/
    uploads/           ← メンバー写真やキービジュアル等を置く場所
      manifest.json    ← （推奨）画像一覧（editor.html の「画像選択」に出すため）
```

> ✅ `content/site.json` と `assets/uploads/` が “更新対象” です。  
> ❌ `index.html / styles.css / main.js` は基本触りません（デザイン・機能の改修時だけ）。

---

## 2. ZIPを受け取ったら（反映手順）

### 2-1) ZIPを展開
編集者が出力したZIP名は例：`update_pack_20251228.zip`

展開するとだいたいこうなります：

```
update_pack_20251228/
  content/site.json
  assets/uploads/（※画像がある時だけ入る）
  README_UPDATE.txt（管理者向けメモ）
```

### 2-2) repoへ上書きコピー
- `update_pack.../content/site.json` → **repo の `content/site.json` に上書き**
- `update_pack.../assets/uploads/*` → **repo の `assets/uploads/` に追加/上書き**

> ※ 同名画像がある場合は上書きでOK（差し替え運用）。

---

## 3. （推奨）manifest.json を更新する

### 3-1) manifest.json とは？
`assets/uploads/manifest.json` は **「アップロード済み画像の一覧」**です。  
編集者GUI（editor.html）で **“写真を選ぶドロップダウン”**に表示するために使います。

- これがあると：編集者が **画像パスを手入力しなくてOK**
- これがないと：編集者が `./assets/uploads/xxx.jpg` を手入力する必要が出る

### 3-2) 更新ルール（最も簡単）
`assets/uploads/` の中身（画像ファイル名）を **そのまま配列で列挙**します。

例：
```json
{
  "paths": [
    "assets/uploads/member_01.jpg",
    "assets/uploads/member_02.png",
    "assets/uploads/keyvisual.jpg"
  ]
}
```

- 画像を追加・削除したら、ここも合わせて更新
- ファイル名は **半角英数・アンダースコア推奨**（スペース/日本語は事故りやすい）

> ✅ ここは「管理者がまとめてメンテ」する運用が一番ラクです。

---

## 4. Git 反映（コマンド例）

repo のルートで：

```bash
git status
git add content/site.json assets/uploads
git commit -m "Update contents via editor package"
git push
```

---

## 5. トラブルシュート

### A) 画像が反映されない
- 画像の置き場所が `assets/uploads/` になっているか確認
- `site.json` の画像パスが `assets/uploads/xxx.jpg` になっているか確認
- ブラウザキャッシュの可能性：強制更新（Ctrl+F5 / Cmd+Shift+R）

### B) editor.html 側で画像一覧が出ない
- `assets/uploads/manifest.json` が配布されているか
- manifest の JSON が壊れていないか（末尾カンマ等）
- 編集者が editor.html で manifest を読み込んだか（ボタン操作）

---

## 6. 役割分担（運用のコツ）
- 編集者：**文章/日程/リンク/写真の差し替え → ZIP作成まで**
- 管理者：**ZIPを取り込んで公開反映（必要ならmanifest更新）**

以上！
