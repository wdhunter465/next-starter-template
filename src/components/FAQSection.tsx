"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";

type FAQItem = {
  id: number;
  question: string;
  answer: string;
  view_count: number;
  pinned: number;
  updated_at: string;
};

function answerPreview(text: string, max = 150): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

const cardStyle: CSSProperties = {
  borderRadius: "var(--lgfc-radius-md)",
  boxShadow: "var(--shadow)",
  padding: "1.25rem",
  background: "var(--lgfc-bg-card)",
  border: "1px solid var(--lgfc-border-light)",
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
  minHeight: 0,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
  gap: "1.25rem",
  marginTop: "1rem",
};

const ctaRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  justifyContent: "center",
  alignItems: "center",
  marginTop: "var(--rhythm-md)",
};

const ctaPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 20px",
  borderRadius: "var(--lgfc-radius-pill)",
  fontWeight: 700,
  textDecoration: "none",
  background: "var(--lgfc-blue)",
  color: "#fff",
  border: "2px solid var(--lgfc-blue)",
};

const ctaSecondary: CSSProperties = {
  ...ctaPrimary,
  background: "var(--lgfc-bg-card)",
  color: "var(--lgfc-blue)",
  border: "2px solid var(--lgfc-blue)",
};

export default function FAQSection() {
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const query = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    let alive = true;
    let completed = false;

    const timer = setTimeout(() => {
      if (alive && !completed) {
        setLoading(false);
        setItems([]);
      }
    }, 10000);

    (async () => {
      try {
        const limit = query ? 10 : 5;
        const data = await apiGet<{ ok: boolean; items: FAQItem[] }>(
          `/api/faq/list?limit=${limit}${query ? `&q=${encodeURIComponent(query)}` : ""}`
        );
        if (alive) setItems(data.items || []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) {
          setLoading(false);
          completed = true;
        }
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div>
      <h2 className="section-title">FAQ – Frequently Asked Questions</h2>
      <p className="sub" style={{ textAlign: "center", maxWidth: "40rem", marginLeft: "auto", marginRight: "auto" }}>
        Search approved club FAQ entries or browse featured questions below.
      </p>

      <div className="faq">
        <div className="search">
          <input
            id="faqSearch"
            type="search"
            placeholder="Search questions..."
            aria-label="Search questions"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" id="faqClear" onClick={() => setQ("")}>
            Clear
          </button>
        </div>

        <div id="faqList">
          {loading ? (
            <p className="sub" style={{ marginBottom: 0 }}>
              Loading FAQ…
            </p>
          ) : items.length === 0 ? (
            <p className="sub" style={{ marginBottom: 0 }}>
              No matching FAQ answers found.
            </p>
          ) : (
            <div style={gridStyle}>
              {items.map((item) => (
                <article key={item.id} style={cardStyle}>
                  <h3 style={{ margin: 0, fontSize: "var(--lgfc-font-size-h3)", fontWeight: 700, color: "var(--lgfc-text-main)", lineHeight: 1.35 }}>
                    {item.question}
                  </h3>
                  <p className="sub" style={{ margin: 0, flex: 1, fontSize: "0.95rem", lineHeight: 1.5 }}>
                    {answerPreview(item.answer)}
                  </p>
                  <div style={{ marginTop: "auto", paddingTop: "0.25rem" }}>
                    <Link href="/ask/" className="link" style={{ fontWeight: 600 }}>
                      Read full answer →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {query && items.length > 0 ? (
          <p className="sub" style={{ marginTop: "1.25rem", marginBottom: 0, textAlign: "center" }}>
            <Link className="link" href={`/ask/?q=${encodeURIComponent(query)}`}>
              View all results on FAQ &amp; Ask
            </Link>
          </p>
        ) : null}

        <div style={ctaRowStyle}>
          <Link href="/ask/" style={ctaPrimary}>
            View All Questions
          </Link>
          <Link href="/ask/#ask-form" style={ctaSecondary}>
            Ask a Question
          </Link>
        </div>
      </div>
    </div>
  );
}
