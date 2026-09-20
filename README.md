# OBS Audio Meter

OBSの音声ソースをStream Deckの通常ボタンとStream Deck＋のタッチストリップに表示するWindows用プラグインです。

## 対応環境

- Windows 10以降、Stream Deck 6.9以降
- OBS Studio 28以降（OBS WebSocket 5.x）
- 開発時：Node.js 20.5.1以降とnpm

## インストールと設定

1. `dist`内の`OBSAudioMeter-0.1.0-*.streamDeckPlugin`をダブルクリックしてインストールします。
2. OBSの「ツール → WebSocketサーバー設定」でサーバーを有効にします。
3. Stream Deckの「OBS Audio Meter → 音声レベルメーター」を通常ボタン、またはダイヤルへ配置します。
4. アクションの設定画面で接続先（標準は`ws://127.0.0.1:4455`）とOBS側のパスワードを入力し、「保存して接続」を押します。接続設定はこのプラグインの全メーターで共通です。
5. 一覧から音声ソースを選びます。必要に応じて短い表示名を設定できます。

横長画面はダイヤル1個につき200×100の1区画を使います。4つのダイヤルに配置すれば4ソースを並べられます。通常ボタンとダイヤルで同じソースを選ぶこともできます。

パスワードはStream Deckのプラグイン共通設定に保存します。ソース別の設定やプラグインのログには書き出しません。既存のOBS設定・認証情報は自動で読み取りません。

## 表示と操作

- 各ソースのL/RピークをバーとdBFS値で表示します。数値は表示中の2チャンネルの大きい方です。
- `InputVolumeMeters`の`inputLevelsMul[channel][1]`を`20 × log10(value)`でdBFSに変換します。OBSのフィルター処理・フェーダー・ミュートを反映したソースの出力ピークです。
- 約50ミリ秒ごとのOBSイベントを受信し、画面への送信も最大20回／秒に制限します。同一画像は再送しません。
- バーは−60～0 dBFS。−20 dBFSから黄、−9 dBFSから赤。0 dBFS以上は`CLIP`を1.5秒保持します。
- 白線と`PK`は1.5秒保持するピークです。ボタン押下、ダイヤル押下、タッチでリセットできます。
- モノラルは左右同じ値を`M`として表示します。3チャンネル以上は先頭2チャンネルのみ表示し、サラウンドの合算は行いません。
- ミュート時は`MUTE`、接続断は`OBS未接続`と表示します。データが750ミリ秒以上届かない場合は`音声データ待機`となり、古い数値を残しません。
- OBS終了・再起動時は1～10秒間隔で再接続します。認証エラー時は設定を確認して「保存して接続」を押してください。
- ダイヤル回転で音量は変わりません。初版はメーター表示とピークリセットのみです。

## 制限

- OBS全体の配信トラックを合算したマスターメーターではなく、選択した音声ソースのメーターです。
- OBSがアクティブな入力として送信しているソースのみ動きます。別シーンの非アクティブなソースは待機表示になる場合があります。
- OBS内のメーターとサンプル取得・描画の時刻が異なるため、瞬間的な値や動きが完全には一致しません。LUFS／トゥルーピーク測定器ではありません。
- UUIDを返すOBSでは名称変更後も追従します。古いOBSで名前指定になっている場合は、名称変更後に一覧から選び直してください。
- 音声ソースが消えた場合は`ソース未検出`を表示します。「一覧を更新」で再取得できます。

## ビルド・検証

このREADMEのある`obs-audio-meter`ディレクトリで実行します。既存のCONNECT 6用ビルドとは独立しています。

```powershell
npm ci
npm run build
npm test
npm run package
npm run preview
```

`npm test`は単位テストとローカル模擬OBS／模擬Stream Deckによる通信テストです。先にビルドしてください。実機・実際のOBSでの表示確認は別途必要です。プレビューは`preview/index.html`に生成されます。

## 参照

- [OBS WebSocketプロトコル](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)
- [OBS音声レベルの送信処理](https://github.com/obsproject/obs-websocket/blob/master/src/utils/Obs_VolumeMeter.cpp)
- [Elgato ダイヤルとタッチストリップ](https://docs.elgato.com/streamdeck/sdk/guides/dials/)
