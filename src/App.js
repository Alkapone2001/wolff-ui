import React, { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [structuredData, setStructuredData] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setFile(null);
      setOcrText("");
      setStructuredData(null);
      return;
    }
    setFile(selectedFile);
    setOcrText("");
    setStructuredData(null);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF file");
    setLoading(true);
    setOcrText("");
    setStructuredData(null);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/process-invoice/", {
        method: "POST",
        headers: {
          "X-Client-ID": "test_client", // Add client ID header
        },
        body: formData,
      });

      if (!res.ok) {
        const errorDetail = await res.json();
        throw new Error(errorDetail.detail || "Server error");
      }

      const data = await res.json();
      setOcrText(data.extracted_text || "");
      setStructuredData(data.structured_data || null);

      if (data.structured_data && data.structured_data.error) {
        setError(data.structured_data.error);
      }
    } catch (err) {
      setError(err.message || "Upload or processing failed");
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Upload Invoice (PDF only)</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !file} style={{ marginLeft: 10 }}>
        {loading ? "Processing..." : "Upload & Extract"}
      </button>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}

      {ocrText && (
        <>
          <h2>OCR Extracted Text</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f0f0f0", padding: 10 }}>
            {ocrText}
          </pre>
        </>
      )}

      {structuredData && !error && (
        <>
          <h2>Extracted Invoice Data</h2>
          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr><td><b>Supplier Name</b></td><td>{structuredData.supplier || "-"}</td></tr>
              <tr><td><b>Invoice Date</b></td><td>{structuredData.date || "-"}</td></tr>
              <tr><td><b>Invoice Number</b></td><td>{structuredData.invoice_number || "-"}</td></tr>
              <tr><td><b>Total Amount</b></td><td>{structuredData.total || "-"}</td></tr>
              <tr><td><b>VAT Amount</b></td><td>{structuredData.vat || "-"}</td></tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default App;
