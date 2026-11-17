# 研究の木 整理ボード

claude.ai の Artifact「研究の木 整理ボード」（https://claude.ai/artifact/GxcgH92w1m5MFKyFqiyAKR ・オーナーだけが開ける）の元。
ゲームの研究（`TECH`）をランクの列と前提の線で並べ、線のつなぎ直し・移動・追加・メモ・整理の方針を付けられる。変えたことは Artifact の db（`edits/<研究id>`・`meta/general`）に入るので、Claude は ArtifactData で読める。

作り直し：
```
node tools/research_board/dump.js /tmp/tech.json      # 試作版から研究を書き出す（Playwright）
python3 tools/research_board/split.py /tmp/tech.json /tmp/tech2.json   # Lvのある研究を Ⅰ→Ⅱ→… のブロックに分ける
python3 -c "t=open('tools/research_board/tpl.html').read();d=open('/tmp/tech2.json').read().replace('</','<\\\\/');open('/tmp/rtree.html','w').write(t.replace('__DATA__',d,1))"
```
→ `/tmp/rtree.html` を同じ Artifact に publish する（db の中身は残る）。
