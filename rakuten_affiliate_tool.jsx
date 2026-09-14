import { useState, useRef, useCallback } from "react";
import { Search, Copy, Check, ExternalLink, Star, Settings, X } from "lucide-react";

// --- JSONP helper (avoids CORS issues when calling Rakuten's API directly from the browser) ---
let jsonpCounter = 0;
function jsonpRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `rakuten_jsonp_cb_${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      settled = true;
      cleanup();
      resolve(data);
    };

    script.src = `${url}&callback=${callbackName}`;
    script.onerror = () => {
      if (!settled) {
        cleanup();
        reject(new Error("リクエストに失敗しました。アプリIDが正しいか確認してください。"));
      }
    };
    document.body.appendChild(script);

    setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error("タイムアウトしました。もう一度お試しください。"));
      }
    }, 12000);
  });
}

const SORT_OPTIONS = [
  { value: "standard", label: "標準" },
  { value: "-reviewCount", label: "レビュー件数が多い順" },
  { value: "-reviewAverage", label: "評価が高い順" },
  { value: "+itemPrice", label: "価格が安い順" },
  { value: "-itemPrice", label: "価格が高い順" },
];

const SUGGESTED_KEYWORDS = [
  "メンズ 洗顔料",
  "メンズ 香水",
  "メンズ スキンケア セット",
  "メンズ 日焼け止め",
  "ヘアワックス メンズ",
];

export default function RakutenAffiliateTool() {
  const [applicationId, setApplicationId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [showCreds, setShowCreds] = useState(true);

  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState("standard");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef(null);

  const runSearch = useCallback(
    async (q) => {
      const term = (q ?? keyword).trim();
      if (!applicationId.trim()) {
        setError("楽天アプリIDを入力してください。");
        setShowCreds(true);
        return;
      }
      if (!term) {
        setError("検索キーワードを入力してください。");
        return;
      }
      setError("");
      setLoading(true);
      setHasSearched(true);

      const params = new URLSearchParams({
        format: "json",
        keyword: term,
        applicationId: applicationId.trim(),
        hits: "20",
        sort,
      });
      if (affiliateId.trim()) params.set("affiliateId", affiliateId.trim());
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`;

      try {
        const data = await jsonpRequest(url);
        if (data.error) {
          setError(`楽天APIエラー: ${data.error_description || data.error}`);
          setItems([]);
        } else {
          const list = (data.Items || []).map((wrap) => wrap.Item);
          setItems(list);
          if (list.length === 0) setError("該当する商品が見つかりませんでした。");
        }
      } catch (e) {
        setError(e.message || "検索中にエラーが発生しました。");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [applicationId, affiliateId, keyword, sort, minPrice, maxPrice]
  );

  const copyLink = (item, idx) => {
    const link = item.affiliateUrl || item.itemUrl;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  return (
    <div
      style={{
        "--ink": "#1c2430",
        "--paper": "#f6f5f1",
        "--panel": "#ffffff",
        "--line": "#e2e0d8",
        "--gold": "#b8873f",
        "--gold-deep": "#8f6529",
        "--muted": "#6b7280",
        fontFamily:
          '"Hiragino Sans", "Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif',
        background: "var(--paper)",
        color: "var(--ink)",
        minHeight: "100%",
        padding: "28px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13,
              letterSpacing: 0.3,
              color: "var(--gold-deep)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            楽天市場 API 連携ツール
          </div>
          <h1
            style={{
              fontSize: 26,
              lineHeight: 1.3,
              margin: 0,
              fontWeight: 700,
            }}
          >
            商品を検索して、アフィリエイトリンクをすぐコピー
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 8, maxWidth: 560 }}>
            楽天ウェブサービスのアプリIDと、楽天アフィリエイトIDを入力すると、
            商品検索の結果に自動でアフィリエイトリンクが付与されます。
          </p>
        </div>

        {/* Credentials panel */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: showCreds ? "18px 20px" : "12px 20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => setShowCreds((s) => !s)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
              <Settings size={16} color="var(--gold-deep)" />
              API認証情報
              {applicationId && (
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)" }}>
                  ・設定済み
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{showCreds ? "閉じる" : "開く"}</span>
          </div>

          {showCreds && (
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  楽天アプリID(必須)
                </label>
                <input
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  placeholder="例: 1234567890123456789"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  楽天アフィリエイトID(任意・未入力の場合は通常リンクを表示)
                </label>
                <input
                  value={affiliateId}
                  onChange={(e) => setAffiliateId(e.target.value)}
                  placeholder="例: 1a2b3c4d.5e6f7g8h..."
                  style={inputStyle}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                ※ これらの値はこのブラウザのセッション内のみで保持され、保存・送信先は楽天のAPIのみです。
                アプリIDは
                <a
                  href="https://webservice.rakuten.co.jp/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--gold-deep)" }}
                >
                  {" "}
                  楽天ウェブサービス{" "}
                </a>
                、アフィリエイトIDは
                <a
                  href="https://affiliate.rakuten.co.jp/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--gold-deep)" }}
                >
                  {" "}
                  楽天アフィリエイト{" "}
                </a>
                の管理画面から取得できます。
              </p>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={16}
                color="var(--muted)"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="例: メンズ 洗顔料"
                style={{ ...inputStyle, paddingLeft: 36 }}
              />
            </div>
            <button
              onClick={() => runSearch()}
              disabled={loading}
              style={{
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0 22px",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "検索中…" : "検索"}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={selectStyle}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="最低価格"
              style={{ ...inputStyle, width: 100, padding: "8px 10px" }}
            />
            <span style={{ color: "var(--muted)", fontSize: 13 }}>〜</span>
            <input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
              placeholder="最高価格"
              style={{ ...inputStyle, width: 100, padding: "8px 10px" }}
            />
          </div>

          {!hasSearched && (
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 4, alignSelf: "center" }}>
                このアカウント向けの候補:
              </span>
              {SUGGESTED_KEYWORDS.map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setKeyword(k);
                    runSearch(k);
                  }}
                  style={chipStyle}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              background: "#fdf2ee",
              border: "1px solid #eecfc2",
              color: "#9a4a2c",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{error}</span>
            <X size={14} style={{ cursor: "pointer" }} onClick={() => setError("")} />
          </div>
        )}

        {/* Results */}
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item, idx) => (
            <div
              key={item.itemCode || idx}
              style={{
                display: "flex",
                gap: 14,
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <img
                src={item.mediumImageUrls?.[0]?.imageUrl || item.smallImageUrls?.[0]?.imageUrl}
                alt={item.itemName}
                style={{
                  width: 88,
                  height: 88,
                  objectFit: "cover",
                  borderRadius: 8,
                  flexShrink: 0,
                  background: "#f0efe9",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={item.itemUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink)",
                    textDecoration: "none",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {item.itemName}
                </a>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    marginTop: 6,
                    fontSize: 13,
                    color: "var(--muted)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--gold-deep)", fontSize: 15 }}>
                    ¥{Number(item.itemPrice).toLocaleString()}
                  </span>
                  <span>{item.shopName}</span>
                  {item.reviewCount > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Star size={12} fill="var(--gold)" color="var(--gold)" />
                      {item.reviewAverage}({item.reviewCount})
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button onClick={() => copyLink(item, idx)} style={actionBtnStyle}>
                  {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                  {copiedIdx === idx ? "コピー済み" : "リンクをコピー"}
                </button>
                <a
                  href={item.itemUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...actionBtnStyle, textDecoration: "none", justifyContent: "center" }}
                >
                  <ExternalLink size={14} />
                  商品ページ
                </a>
              </div>
            </div>
          ))}
        </div>

        {hasSearched && !loading && items.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: 14 }}>
            該当する商品が見つかりませんでした。
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  fontSize: 14,
  border: "1px solid #d8d5cb",
  borderRadius: 8,
  outline: "none",
  background: "#fff",
  color: "#1c2430",
};

const selectStyle = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid #d8d5cb",
  borderRadius: 8,
  background: "#fff",
  color: "#1c2430",
};

const chipStyle = {
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d8d5cb",
  background: "#fff",
  color: "#4a4436",
  cursor: "pointer",
};

const actionBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  padding: "7px 12px",
  borderRadius: 7,
  border: "1px solid #d8d5cb",
  background: "#fff",
  color: "#1c2430",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
