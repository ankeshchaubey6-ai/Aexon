import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        padding: "40px",
        maxWidth: "400px",
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{
          width: "48px", height: "48px",
          background: "#dbeafe",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: "24px",
        }}>✦</div>

        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>
          AI Builder Ready
        </h1>

        <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "24px" }}>
          Your pipeline is working. Generated UI will appear here.
        </p>

        <button
          onClick={() => setCount(c => c + 1)}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 24px",
            fontSize: "14px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Clicked {count} times
        </button>
      </div>
    </div>
  );
}