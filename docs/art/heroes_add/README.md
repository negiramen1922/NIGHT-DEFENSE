# 新しい英雄5人 ＋ 武器工房（黒い炉）

## heroes/
| キー | 名前 | 見た目 |
|---|---|---|
| hero_bram | ブラム（守備・速射） | 赤ひげ・革の帽子・武器なし（腕を上げて合図） |
| hero_serena | セレナ（守備・号令） | 長い銀髪・赤い旗 |
| hero_dolf | ドルフ（守備・修繕） | ひげの大工・木材と金槌 |
| hero_emma | エマ（内政・指導） | 栗色の三つ編み・帳簿と羽ペン |
| hero_otto | オットー（内政・倹約） | 眼鏡の白髪・天秤と金袋 |

- `png/hero_*_walk.png`・`_attack.png`：地図の絵（16×16・4コマ）
- `png/hero_*_art.png`：立ち絵（100×40・4コマ、キャラは2倍で前の14人と同じ大きさ）
- `sprites_heroes_add.json`：ドットのデータ（`heroes` に足す）

## weapon_shop/
黒い石積みの炉の建物。炉の火が揺れ、金床で火花、煙突から煙。右下に段の金槌。
段：stone（石）・iron（鉄）・alloy（合金）・magic（魔金属）・holy（聖銀）
- `map/weapon_shop_段.png`：地図の絵（28px・4コマ）
- `art/weapon_shop_段_art.png`：立ち絵（100×40・4コマ）
- `sprites_weapon_shop.json`：ドットのデータ（`tool_tiers` の weapon_shop_* を置きかえ）
