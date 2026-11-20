# 施設の段（工業・魔法の分かれ道）

ファイル名は `施設_分岐_段_キー_種類.png`（例：`steam_factory_industry_s1_steam_factory_t1_idle.png`＝蒸気の工場・工業・1段目）

| 施設 | 分岐 | 段 | キー | 内容 | ファイルの頭 |
|---|---|---|---|---|---|
| 兵舎 | 共通 | 1 | `barracks_t1` | 兵舎 | `barracks_common_s1_barracks_t1` |
| 兵舎 | 共通 | 2 | `barracks_t2` | 石の兵舎 | `barracks_common_s2_barracks_t2` |
| 兵舎 | 共通 | 3 | `barracks_gun` | 銃兵の兵舎 | `barracks_common_s3_barracks_gun` |
| 兵舎 | 工業 | 4 | `barracks_cannon` | 砲兵の兵舎 | `barracks_industry_s4_barracks_cannon` |
| 兵舎 | 工業 | 5 | `barracks_grandgun` | 狙撃兵の兵舎 | `barracks_industry_s5_barracks_grandgun` |
| 兵舎 | 魔法 | 4 | `barracks_mage` | 魔導院 | `barracks_magic_s4_barracks_mage` |
| 兵舎 | 魔法 | 5 | `barracks_grandmage` | 大魔導院 | `barracks_magic_s5_barracks_grandmage` |
| 蒸気の工場 | 工業 | 1 | `steam_factory_t1` | 蒸気機兵・銃士の気球が作れる | `steam_factory_industry_s1_steam_factory_t1` |
| 蒸気の工場 | 工業 | 2 | `steam_factory_t2` | 蒸気戦車・爆撃飛行船が作れる | `steam_factory_industry_s2_steam_factory_t2` |
| 錬金工房 | 魔法 | 1 | `alchemy_t1` | エーテルゴーレムが作れる | `alchemy_magic_s1_alchemy_t1` |
| 錬金工房 | 魔法 | 2 | `alchemy_t2` | 巨大ゴーレムが作れる | `alchemy_magic_s2_alchemy_t2` |
| 錬金工房 | 魔法 | 3 | `alchemy_t3` | 空飛ぶクジラが作れる | `alchemy_magic_s3_alchemy_t3` |
| 大きな厩舎 | 共通 | 1 | `big_stable` | 大きな厩舎 | `big_stable_common_s1_big_stable` |
| 大きな厩舎 | 共通 | 2 | `big_stable_dragon` | 竜騎兵の研究のあと | `big_stable_common_s2_big_stable_dragon` |
| 月光の祭壇 | 魔法 | 1 | `moon_altar` | 昼・夜の2種類 | `moon_altar_magic_s1_moon_altar` |

## 流れ
- 兵舎：1 兵舎 → 2 石の兵舎 → 3 銃兵の兵舎（ここまで共通）→ ランクⅣで
  - 工業：4 砲兵の兵舎 → 5 狙撃兵の兵舎
  - 魔法：4 魔導院 → 5 大魔導院
- 蒸気の工場（工業）：1 蒸気機兵・銃士の気球 → 2 蒸気戦車・爆撃飛行船
- 錬金工房（魔法）：1 エーテルゴーレム → 2 巨大ゴーレム → 3 空飛ぶクジラ
- 大きな厩舎：1 通常 → 2 竜騎兵

## ファイル
- `png/*_idle*.png`：地図の絵（コマを横に並べたもの）
- `png/*_art.png`：立ち絵（4コマ）
- `sprites_branch_tiers.json`：データ。各キーに facility・branch・stage・note 入り

## 試作版での使い方（2026-11-20 組み込み）
- `proto/index.html` の `NDSPR_TIERS2`（地図の絵）と `NDART_TIERS2`（立ち絵）。月光の祭壇は `moon_altar`（昼）と `moon_altar_night`（夜）に分けた。
- 兵舎：`KC.train.st` を5段に（兵舎Ⅰ→石の兵舎Ⅱ→銃兵の兵舎Ⅲ→工業：砲兵の兵舎Ⅳ・狙撃兵の兵舎Ⅴ／魔法：魔導院Ⅳ・大魔導院Ⅵ）。方針を選ぶ前の4段目は今までの大兵舎の絵。
- 蒸気の工場・錬金工房・大きな厩舎は、段（アップグレード）ではなく**研究で絵が変わる**（`stageArtDyn`）：
  - 蒸気の工場：蒸気戦車か爆撃飛行船の研究のあと2段目の絵
  - 錬金工房：巨大ゴーレムの研究で2段目、空飛ぶクジラの研究で3段目の絵
  - 大きな厩舎（馬小屋の3段目）：竜騎兵の研究のあと竜の絵
- 月光の祭壇は、襲撃の夜（`S.waveActive`）に夜の絵。
