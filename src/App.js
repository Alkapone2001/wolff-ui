// src/App.js
import React, { useState } from "react";
import MessageHistoryView from "./components/MessageHistoryView";
import SummarizeContext from "./components/SummarizeContext";

// Helpers to massage the parsed invoice into the right shape
const transformDate = (raw) => {
  // Accepts "DD/MM/YYYY" or "YYYY-MM-DD"
  if (raw.includes("/")) {
    const [d, m, y] = raw.split("/");
    return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return raw;
};

const computeDueDate = (isoDate) => {
  const dt = new Date(isoDate);
  dt.setDate(dt.getDate() + 30);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseAmount = (raw) => {
  // Remove non-numeric (including non-breaking spaces) and parse
  const cleaned = raw.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned);
};

function App() {
  // --- existing state ---
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [structuredData, setStructuredData] = useState(null);
  const [error, setError] = useState("");
  const [showMessages, setShowMessages] = useState(false);

  // --- booking state ---
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState("");

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
    setBookingResult(null);
    setBookingError("");
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF file");
    setLoading(true);
    setError("");
    setBookingResult(null);
    setBookingError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/process-invoice/", {
        method: "POST",
        headers: { "X-Client-ID": "test_client" },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Server error during parsing");
      }
      const data = await res.json();
      setOcrText(data.extracted_text || "");
      setStructuredData(data.structured_data || null);
      if (data.structured_data?.error) setError(data.structured_data.error);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookInvoice = async () => {
    if (!structuredData) {
      return setBookingError("No invoice data available to book.");
    }

    // Build payload exactly as your FastAPI model expects
    const isoDate = transformDate(structuredData.date);
    const payload = {
      invoice_number: structuredData.invoice_number.replace(/^#/, ""),
      supplier:       structuredData.supplier,
      date:           isoDate,
      due_date:       computeDueDate(isoDate),
      line_items: [
        {
          description:  "Invoice Total",
          amount:       parseAmount(structuredData.total),
          account_code: "200",  // <-- adjust to your payables code
        },
      ],
      // currency_code: "CHF"  // optional
    };

    setBookingLoading(true);
    setBookingResult(null);
    setBookingError("");

    try {
      const res = await fetch("http://localhost:8000/book-invoice/", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.detail || JSON.stringify(errBody));
      }
      const result = await res.json();
      setBookingResult(result);
    } catch (err) {
      setBookingError(err.message);
      console.error("Booking error:", err);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Upload Invoice (PDF only)</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !file} style={{ marginLeft: 10 }}>
        {loading ? "Processing..." : "Upload & Extract"}
      </button>
      <button onClick={() => setShowMessages(!showMessages)} style={{ marginLeft: 10 }}>
        {showMessages ? "Hide Message History" : "View Message History"}
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
          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", marginBottom: 20 }}>
            <tbody>
              <tr><td><b>Supplier</b></td><td>{structuredData.supplier}</td></tr>
              <tr><td><b>Date</b></td><td>{structuredData.date}</td></tr>
              <tr><td><b>Invoice #</b></td><td>{structuredData.invoice_number}</td></tr>
              <tr><td><b>Total</b></td><td>{structuredData.total}</td></tr>
              <tr><td><b>VAT</b></td><td>{structuredData.vat ?? "-"}</td></tr>
            </tbody>
          </table>

          <button
            onClick={handleBookInvoice}
            disabled={bookingLoading}
            style={{ marginBottom: 10 }}
          >
            {bookingLoading ? "Booking..." : "Book to Xero"}
          </button>
          {bookingError && <p style={{ color: "red" }}>{bookingError}</p>}
          {bookingResult && (
            <pre style={{ background: "#e0ffe0", padding: 10 }}>
              {JSON.stringify(bookingResult, null, 2)}
            </pre>
          )}
        </>
      )}

      {showMessages && (
        <>
          <MessageHistoryView />
          <SummarizeContext />
        </>
      )}
    </div>
  );
}

export default App;
