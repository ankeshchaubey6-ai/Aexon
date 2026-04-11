import React from "react";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: "4px solid #3b82f6",
            borderTop: "4px solid transparent",
            borderRadius: "50%",
            margin: "0 auto 16px",
          }}
        />
        <p style={{ fontSize: 14, marginBottom: 6 }}>
          AI is generating your project...
        </p>
        <p style={{ fontSize: 12, color: "#94a3b8" }}>
          The preview will update automatically
        </p>
      </div>
    </div>
  );
}