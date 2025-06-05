import React, { useState } from "react";

const SummarizeContext = ({ clientId = "test_client" }) => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/summarize-context/${clientId}`, {
        method: "POST", // ✅ POST is required
      });
      if (!response.ok) throw new Error("Failed to summarize");
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setSummary("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 30 }}>
      <h2>Context Summary</h2>
      <button onClick={handleSummarize} disabled={loading}>
        {loading ? "Summarizing..." : "Summarize Context"}
      </button>
      {summary && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{summary}</pre>
      )}
    </div>
  );
};

export default SummarizeContext;
