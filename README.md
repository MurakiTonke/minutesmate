# MinutesMate

議事録の文字起こし/メモを貼り付けると、自前ホスト型LLM（Ollama / gemma2:2b）が要約・決定事項・ToDo（担当者/期限）を自動抽出するSaaSアプリケーションです。

## 起動手順

### 1. Ollama（Docker）を起動

```bash
cd minutesmate
docker compose up -d
```

初回のみモデルをpull（1.6GB、数分かかります）:

```bash
docker exec minutesmate-ollama-1 ollama pull gemma2:2b
```

### 2. Firebase Emulator Suiteを起動

アカウント情報を保持するため、`emulator-seed`をimportして起動します。

```bash
npx firebase-tools emulators:start --import=./emulator-seed --export-on-exit=./emulator-seed
```

起動後、以下にアクセス:

- アプリ本体: http://127.0.0.1:5050
- Emulator UI（Firestore中身の確認など）: http://127.0.0.1:4000

### ログイン情報（テストアカウント）

- メールアドレス: `demo@minutesmate.local`
- パスワード: `minutesmate123`

（ログイン画面にはあらかじめ入力済みです。このアカウントはFirebase Auth **Emulator**（ローカル開発環境）にのみ存在するテスト用アカウントです。）

### 使い方

1. ログイン
2. ダッシュボードで「＋ 新しい議事録」を開く
3. 会議の文字起こしを貼り付ける
4. 「解析する」を押す（ローディング表示 → 10〜20秒程度）
5. AIが要約・決定事項・ToDoを表示する
6. ToDoの内容/担当者/期限を編集して「ToDoを保存」
7. 「ToDo一覧」に移動 → 編集内容が反映されていることを確認
8. チェックボックスで完了/未完了を切り替え、不要なToDoは削除も可能

## 技術スタック

- フロントエンド: Vanilla HTML/CSS/JS（Firebase Hostingで配信）
- 認証: Firebase Authentication（メール+パスワード）
- API仲介: Firebase Cloud Functions（Node.js / Express）
- AI推論: Ollama（gemma2:2b、Docker Composeでコンテナ化）
- データベース: Cloud Firestore（会議・決定事項・ToDoを保存）

## 実装スコープ

議事録の解析（要約・決定事項・ToDo抽出）、ToDoの編集・保存・削除、ToDo一覧までを実装しています。議事録の一覧・検索、複数会社対応（company_idによるテナント分離）は今回の実装範囲外です（`docs/実装仕様書.md` 参照）。

稼働環境は、ローカルPC上のDocker Compose（Ollama）とFirebase Local Emulator Suiteの組み合わせです。本番運用時は、同一のコンテナ構成をそのままIaaS（Oracle Cloud等）のVM上にデプロイする想定です。

### 入力テキストに関する制約

想定している入力は「発言者:内容」程度に整理された短めの議事録テキストです。長時間の講義・会議をそのまま音声認識にかけたような、雑音（言い淀み・誤変換）が多く数千文字を超える書き起こしは、軽量モデル（gemma2:2b）では要約・ToDo抽出の精度が大きく落ちる（処理時間も数十秒に増加）ため、非対応としています。
