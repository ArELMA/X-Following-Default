(() => {
    "use strict";

    // =========================================================
    // 設定値（日本語UI前提）
    // =========================================================

    // ホームタイムラインのパス
    const HOME_PATH = "/home";

    // タブ表示名（将来変更された場合はここを修正）
    const FOLLOWING_LABEL = "フォロー中"; // Following
    const FOR_YOU_LABEL = "おすすめ";   // For you（未使用だが意味明示用）

    // タブがまだ描画されていない場合の再試行設定
    const RETRY_INTERVAL = 300; // ms
    const RETRY_LIMIT = 25;  // 約7.5秒

    // =========================================================
    // 状態管理（将来耐性のための「世代」モデル）
    // =========================================================

    // ページ状態の世代番号
    // ・URL遷移
    // ・F5更新
    // ・アカウント切替
    // ・DOM再構築
    // など「事実上ページが変わった」と判断したら +1 する
    let pageGeneration = 0;

    // 「フォロー中」切替が完了した世代
    // 同一世代では1回しか実行しないためのガード
    let switchedGeneration = -1;

    // DOM未完成時の再試行カウンタ
    let retries = 0;

    // =========================================================
    // ユーティリティ関数
    // =========================================================

    // 現在がホームタイムラインかどうか
    function isHome() {
        return location.pathname === HOME_PATH;
    }

    // 現在選択されているタブを取得
    function getSelectedTab() {
        return document.querySelector('[role="tab"][aria-selected="true"]');
    }

    // すでに「フォロー中」が選択されているか
    function isFollowingSelected() {
        const tab = getSelectedTab();
        return tab?.innerText?.trim() === FOLLOWING_LABEL;
    }

    // 「フォロー中」タブそのものを探す
    function findFollowingTab() {
        const tabs = document.querySelectorAll('[role="tab"]');
        for (const tab of tabs) {
            if (tab.innerText?.trim() === FOLLOWING_LABEL) return tab;
        }
        return null;
    }

    // =========================================================
    // メイン処理：フォロー中へ切り替え（世代単位）
    // =========================================================

    function trySwitchFollowing(gen) {
        // 世代が変わっていたら中断
        // （古い setTimeout などが新状態を壊すのを防ぐ）
        if (gen !== pageGeneration) return;

        // ホーム以外では何もしない
        if (!isHome()) return;

        // この世代ですでに切替完了していれば終了
        if (switchedGeneration === gen) return;

        // すでにフォロー中なら完了扱い
        if (isFollowingSelected()) {
            switchedGeneration = gen;
            return;
        }

        // フォロー中タブを探してクリック
        const followingTab = findFollowingTab();
        if (followingTab) {
            followingTab.click();
            switchedGeneration = gen;
            return;
        }

        // DOMがまだ揃っていない場合は再試行
        if (retries++ < RETRY_LIMIT) {
            setTimeout(() => trySwitchFollowing(gen), RETRY_INTERVAL);
        }
    }

    // =========================================================
    // 新しい世代を開始する共通関数
    // =========================================================

    function startNewGeneration(reason) {
        // ページ状態が変わったと判断
        pageGeneration++;

        // 再試行回数をリセット
        retries = 0;

        // 非同期で切替処理開始
        setTimeout(() => trySwitchFollowing(pageGeneration), 0);
    }

    // =========================================================
    // 初回ロード時
    // =========================================================

    if (isHome()) {
        startNewGeneration("initial-load");
    }

    // =========================================================
    // F5更新 / BFCache 復帰対応
    // =========================================================

    window.addEventListener("pageshow", (e) => {
        const nav = performance.getEntriesByType("navigation")[0];

        // ・通常リロード
        // ・BFCache からの復帰
        if (e.persisted || nav?.type === "reload") {
            startNewGeneration("reload");
        }
    });

    // =========================================================
    // SPA遷移 / アカウント切替 / 内部DOM再構築 対応
    // =========================================================

    let lastPath = location.pathname;

    const observer = new MutationObserver(() => {
        // pathname が変わった場合（SPA遷移）
        if (location.pathname !== lastPath) {
            lastPath = location.pathname;
            if (isHome()) startNewGeneration("path-change");
            return;
        }

        // URLは同じだが、DOMが実質的に作り直された場合
        // （アカウント切替や内部状態リセット）
        if (isHome() && switchedGeneration !== pageGeneration) {
            startNewGeneration("dom-refresh");
        }
    });

    // ドキュメント全体の変化を監視
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();