import React from "react";
export default function TabNav({ activeTab, setTab }) {
  return (
    <nav style={{ display: "flex", justifyContent: "center", gap: 30 }}>
      <button
        style={{
          padding: "0.7rem 2.2rem",
          borderRadius: 8,
          border: "none",
          fontWeight: 600,
          background: activeTab === "invoices" ? "#074b82" : "#e6eaf0",
          color: activeTab === "invoices" ? "white" : "#222",
          fontSize: 18,
          cursor: "pointer",
        }}
        onClick={() => setTab("invoices")}
      >
        Upload Invoices
      </button>
      <button
        style={{
          padding: "0.7rem 2.2rem",
          borderRadius: 8,
          border: "none",
          fontWeight: 600,
          background: activeTab === "bank" ? "#074b82" : "#e6eaf0",
          color: activeTab === "bank" ? "white" : "#222",
          fontSize: 18,
          cursor: "pointer",
        }}
        onClick={() => setTab("bank")}
      >
        Bank Reconciliation
      </button>
    </nav>
  );
}
