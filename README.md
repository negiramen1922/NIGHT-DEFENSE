# ナイトディフェンス

シミュレーション型ディフェンスゲーム（ブラウザ版 / ver 0.9）

木材や石材、食料と住居を整え、兵士と防衛施設で夜ごとに押し寄せる魔物から街を守るドット絵のゲームです。
`index.html` 1ファイルだけで動きます（外部の読み込みなし）。セーブはブラウザ（localStorage）に保存されます。

- 推奨：PCのブラウザ（Chrome / Edge / Firefox / Safari）
- スマホでも遊べます（簡易対応）
- 初めての方は、マップ選択で「廃村エルム」を選ぶと手引きつきで始まります

## GitHub Pages で公開する手順

1. GitHub で新しいリポジトリを作る（例：`night-defense`、Public）
2. このフォルダの `index.html`・`README.md`・`.nojekyll` をアップロード
   （リポジトリ画面の「Add file → Upload files」にドラッグ＆ドロップ → Commit changes）
3. リポジトリの「Settings → Pages」を開く
4. 「Build and deployment」の Source を「Deploy from a branch」、Branch を `main`・`/ (root)` にして Save
5. 1〜2分後、`https://<ユーザー名>.github.io/night-defense/` で遊べます

更新するときは、新しい `index.html` を同じ場所にアップロードし直すだけです（プレイヤーのセーブはそのまま残ります）。
