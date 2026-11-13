# 試作版（proto/）を本番（トップ）に入れるスクリプト（mkproto.py の逆）
# 使い方：リポジトリの一番上で  python3 tools/mkprod.py . proto
# セーブキー・バージョン表記・アプリ名・タイトル・旧版へのリンクを本番の形に戻し、siege.js もトップへ写す
import sys,re,shutil
dst,src=sys.argv[1],sys.argv[2]
s=open(src+'/index.html',encoding='utf-8').read()
ver=re.search(r"GAME_VER='([^']*) 試作版'",s).group(1)
for a,b in [("const SAVE_KEY='abyss_save_v3_proto',","const SAVE_KEY='abyss_save_v3',"),
            (f"GAME_VER='{ver} 試作版'",f"GAME_VER='{ver}'"),
            ("location.href='../v0.9/index.html';","location.href='v0.9/index.html';"),
            ('<meta name="apple-mobile-web-app-title" content="ND試作版">','<meta name="apple-mobile-web-app-title" content="ナイトディフェンス">'),
            ('<title>ナイトディフェンス（試作版）</title>\n<meta name="robots" content="noindex">','<title>ナイトディフェンス — シミュレーション型ディフェンスゲーム</title>')]:
    assert s.count(a)==1,a; s=s.replace(a,b)
assert s.count('<script src="siege.js"></script>')==1
open(dst+'/index.html','w',encoding='utf-8').write(s)
shutil.copy(src+'/siege.js',dst+'/siege.js')
print('production updated:',ver)
