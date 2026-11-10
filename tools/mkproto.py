# 試作版（proto/）を、トップの最新版から作り直すスクリプト
# 使い方：リポジトリの一番上で  python3 tools/mkproto.py . proto
# 試作版はセーブ・アプリ名・キャッシュ名を本番と分ける（試作版の不具合で本番のセーブを壊さないため）
import sys,json,re
src,dst=sys.argv[1],sys.argv[2]
s=open(src+'/index.html',encoding='utf-8').read()
ver=re.search(r"GAME_VER='([^']*)'",s).group(1)
for a,b in [("const SAVE_KEY='abyss_save_v3',","const SAVE_KEY='abyss_save_v3_proto',"),
            (f"GAME_VER='{ver}'",f"GAME_VER='{ver} 試作版'"),
            ("location.href='v0.9/index.html';","location.href='../v0.9/index.html';"),
            ('<meta name="apple-mobile-web-app-title" content="ナイトディフェンス">','<meta name="apple-mobile-web-app-title" content="ND試作版">'),
            ('<title>ナイトディフェンス — シミュレーション型ディフェンスゲーム</title>','<title>ナイトディフェンス（試作版）</title>\n<meta name="robots" content="noindex">'),
            ('</body>','<script src="siege.js"></script>   <!-- 試作版だけ：攻城戦（proto/siege.js） -->\n</body>')]:
    assert s.count(a)==1,a; s=s.replace(a,b)
open(dst+'/index.html','w',encoding='utf-8').write(s)
m=json.load(open(src+'/manifest.webmanifest',encoding='utf-8'));m['name']='ナイトディフェンス 試作版';m['short_name']='ND試作版'
json.dump(m,open(dst+'/manifest.webmanifest','w',encoding='utf-8'),ensure_ascii=False,indent=2)
w=open(src+'/sw.js').read().replace("const CACHE = 'nd-v1';","const CACHE = 'nd-proto-v1';");open(dst+'/sw.js','w').write(w)
for f in ['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png']:
    open(dst+'/'+f,'wb').write(open(src+'/'+f,'rb').read())
print('proto updated:',ver,'試作版')
