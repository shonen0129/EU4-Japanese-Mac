# EU4 Japanese for Mac

Steam macOS版Europa Universalis IV向けの日本語化インストーラです。最新版は **2.2.1**。対応EU4は **1.37.x**、推奨・検証基準は **1.37.5.0**。実行ファイルとdylibはx86_64単独を要求します。Apple SiliconではRosetta 2経由で使用し、SIPは有効のままにしてください。

[インストーラZIP](https://github.com/shonen0129/EU4-Japanese-Mac/releases/latest/download/EU4-Japanese-Mac.zip) · [リリースとSHA256](https://github.com/shonen0129/EU4-Japanese-Mac/releases) · [配布と検証方針](SECURITY.md)

## 使い方

1. ZIPを展開し、EU4とParadox Launcherを終了します。Steamの更新・整合性確認とは同時に実行しないでください。
2. `EU4 Japanese for Mac.command` を実行し、メニュー1を選びます。
3. Steamから起動し、Launcherの使用中playsetで **JPMOD Main 1: Fonts and UI / JPMOD Main 2: Text / JPMOD Mac: Translation Supplement** を有効にします。
4. **ゲーム・Launcherの言語はEnglishのまま**にします。

Apple Command Line ToolsとmacOS SDKが必要です。未導入なら `xcode-select --install` で導入してから再実行します。Python・Homebrew・CMakeは利用者のインストール処理には不要です。Rosettaは勝手に導入しません。

macOSがスクリプトの実行を止めた場合は、配布元と内容を確認し、システム設定「プライバシーとセキュリティ」で当該ファイルだけを許可してください。Gatekeeper全体の変更は不要です。実行属性が失われた場合は、ターミナルで `/bin/bash ` と入力し、`.command` をドラッグして実行できます。

## 2.2.0の配布方式

ネイティブコードと改修をこのリポジトリで管理します。dylibとMach-O注入ツールは、インストーラへ埋め込んだ公開ソースからMac上でビルドします。第三者のリリースにある実行ファイルをダウンロードして実行しません。

日本語MODは作者の公式配布元から取得します。承認する版と、配布情報JSON・配布ZIP・展開後ファイルのSHA256を [dependencies.lock.json](dependencies.lock.json) に固定し、未知の変更は停止します。既存ファイルが固定値に一致すれば再ダウンロードを省略します。上流最新版はメニュー11で確認できますが、自動採用しません。更新は管理側で確認・テスト後にリリースします。

他作者の翻訳ZIP、フォント、ゲーム本体、macOSのフォントを同梱・再配布しません。フォント補完は利用者のMac上で生成します。

## 構成とメニュー

標準は `eu4dll_macの日本語専用派生版 + Main 1 + Main 2 + 補訳`。Main 1はフォント・UI、Main 2は翻訳本体、補訳は未翻訳文言・不足字形の補完です。Sub 1は人物・文化などのゲームデータを変更し、任意・実績非対応です。追加フォントMODは自動管理しません。

```text
1. 日本語化をインストール / 更新
2. 日本語化をアンインストール
3. 診断のみ
4. 終了
5. Sub 1を追加 / 更新
6. Sub 1を削除
7. 補訳・日本語フォント補完の更新（本体を変更しない）
8. 補訳・日本語フォント補完を削除
9. 地図の国名を非表示にして更新（クラッシュ切り分け）
10. 地図の国名表示を戻して更新
11. 更新候補を確認（自動適用しない）
```

メニュー1・5・9・10はネイティブ部分も更新します。メニュー7だけではdylibは更新されません。通常更新では、以前明示的に導入したSub 1と国名の表示モードを維持します。

## バックアップ・診断

app全体の作業コピーで準備し、`eu4_bak`、ロード命令、architecture、ad-hoc署名を検証してから切り替えます。途中失敗ではapp・MOD・管理状態を実行前へ戻します。注入済みでバックアップがなければ停止します。Steam更新でクリーンな本体へ置き換わった場合は、その本体でバックアップを更新して再適用します。Steam更新後はインストーラを再実行してください。

ログは `~/Library/Logs/EU4-Japanese-Mac/install.log`、中断復旧記録は `~/Library/Application Support/EU4-Japanese-Mac/pending.json`。復旧記録・トランザクションフォルダを中断後に手動削除しないでください。「診断のみ」はゲームの復旧・変更を行いません。

署名を妨げる `Contents/MacOS/console_history.txt` は、内容を検証してapp外の `~/Library/Application Support/EU4-Japanese-Mac/preserved-runtime-files/console-history/` へ保管します。アンインストールでも履歴を保持します。[詳細](docs/SIGNING_FIX.md)

sudo、Steam Library全体へのchmod/chown、SIP・Gatekeeper全体の無効化は使いません。ユーザーのセーブやSteam Cloudを移動・削除しません。

## 検証範囲

常用漢字2,136字、かな186字、関連記号の計2,337字が対象です。`𠮟` のみ内部でU+E000へ可逆変換します。絵文字・常用外の拡張漢字全体は対象外です。[文字対応](docs/CHARACTER_SUPPORT.md)

国名末尾のバイト混入、国名の境界検査、字間調整後の文字列による容量計算を修正しています。これで全クラッシュが解消したと確認できていません。再現する場合は元セーブを保管し、メニュー9で同じ操作を比較してください。[国名描画と残る課題](docs/MAP_SAFETY.md)

単独コード・サニタイザ・模擬appによる導入/更新/署名/復元/削除を検証します。実ゲームの全画面、IME、セーブ操作、長時間進行、外交・併合、Intel実機でのプレイを網羅したものではありません。[実機確認項目](docs/TESTING.md)

## 開発・公開

```sh
python3 tools/build.py
python3 tools/test.py
python3 tests/integration.py
```

開発用にはPython 3、Node.js、macOS Command Line Toolsが必要です。`dist/` に単体command・ZIP・SHA256SUMSを生成します。

mainへの反映後にCIを実行し、成功時に未公開のバージョンをReleaseへ公開します。同じ版の公開済みReleaseは上書きしません。公開する変更では `VERSION` を更新してください。Immutable releasesはGitHub設定で有効にします。

## クレジット

- [EU4dll](https://github.com/matanki-saito/EU4dll) — matanki-saito
- [eu4dll_mac](https://github.com/PoXiao-zero/eu4dll_mac) — PoXiao-zero。基準: b5 / `2d8bf60a7036630e8fab1e622d26e7f7bbe9948d`
- [EU4JPModCore](https://github.com/matanki-saito/EU4JPModCore)、[EU4JPModAppendixI](https://github.com/matanki-saito/EU4JPModAppendixI)、[EU4JPModAppendixII](https://github.com/matanki-saito/EU4JPModAppendixII) — matanki-saito

[MIT LICENSE](LICENSE) / [第三者の権利表示](THIRD_PARTY_NOTICES.md) / [上流コードのLICENSE](native/eu4dll_mac/LICENSE) / [Unicodeデータの利用条件](UNICODE-LICENSE.txt)。ソースのライセンスだけからフォント等のアセットの再配布可否を推定しません。
