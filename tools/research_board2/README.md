# 研究の整理ボード（2つ目・今使っているもの）

claude.ai の Artifact https://claude.ai/artifact/K4cx9jLcpKJ7hrQAf1HawE （オーナーだけが開ける）の元。2026-11-18 から、試作版の今の中身から自動で作っている。
カードを動かす・線をつなぐ・研究を足す・メモは Artifact の db（`notes`・`pos`・`links`・`custom`）に入るので、ArtifactData で読める。

作り直し（スクラッチの作業フォルダで）：
1. `node dump.js`（試作版から研究・城のランクで開くもの・道具とアップグレードの段・装備を `rb/proto_dump.json` に書き出す。中のパスは作業フォルダに合わせる）
2. `python3 mk_actual.py`（`data.json` の「領地・防衛・部隊」タブを作り直す。`data_base.json` を `data.json` として使う。「前：生産」などのタブはもとの研究）
3. `head.html` ＋ `body.html`（`__DATA__` に data.json）で `research_board.html` を作り、同じ Artifact に publish
