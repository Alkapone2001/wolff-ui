// src/App.js

import React, { useState } from "react";
import MessageHistoryView from "./components/MessageHistoryView";
import SummarizeContext from "./components/SummarizeContext";

// Helpers
const transformDate = (raw) => {
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
  const mm   = String(dt.getMonth() + 1).padStart(2, "0");
  const dd   = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseNum = (raw) => {
  const s = String(raw).replace(/[^\d.-]/g, "");
  return parseFloat(s) || 0;
};

function App() {
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [ocrText, setOcrText]     = useState("");
  const [structuredData, setStructuredData] = useState(null);
  const [error, setError]         = useState("");
  const [showMessages, setShowMessages] = useState(false);

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingResult, setBookingResult]   = useState(null);
  const [bookingError, setBookingError]     = useState("");

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setFile(null);
      setOcrText("");
      setStructuredData(null);
      return;
    }
    setFile(f);
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

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/process-invoice/", {
        method: "POST",
        headers: { "X-Client-ID": "test_client" },
        body: form
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Error processing invoice");
      }
      const { extracted_text, structured_data } = await res.json();

      setOcrText(extracted_text || "");

      // ─────────── NEW FIELDS PARSING ─────────── 
      const total         = parseNum(structured_data.total);
      const vatRate       = parseNum(structured_data.vat_rate);
      const taxableBase   = parseNum(structured_data.taxable_base);
      const discountTotal = parseNum(structured_data.discount_total);
      const vatAmount     = parseNum(structured_data.vat_amount);
      const netSubtotal   = parseNum(structured_data.net_subtotal);
      // ────────────────────────────────────────────

      setStructuredData({
        ...structured_data,
        total,
        vat_rate:       vatRate,
        taxable_base:   taxableBase,
        discount_total: discountTotal,
        vat_amount:     vatAmount,
        net_subtotal:   netSubtotal
      });

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

    const isoDate = transformDate(structuredData.date);
    const payload = {
      invoice_number: structuredData.invoice_number.replace(/^#/, "").trim(),
      supplier:       structuredData.supplier,
      date:           isoDate,
      due_date:       computeDueDate(isoDate),
      total:          structuredData.total,
      vat_rate:       structuredData.vat_rate,
      line_items: [
        {
          description:  "Invoice Subtotal",
          amount:       structuredData.net_subtotal,  // ← use net_subtotal
          account_code: "200",
        },
      ],
      // currency_code: "CHF"  // optional
    };

    console.debug("Booking payload:", payload);

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
              <tr><td><b>Total</b></td><td>{structuredData.total.toFixed(2)}</td></tr>
              <tr><td><b>VAT %</b></td><td>{structuredData.vat_rate.toFixed(2)}%</td></tr>
              <tr><td><b>Taxable Base</b></td><td>{structuredData.taxable_base.toFixed(2)}</td></tr>
              <tr><td><b>Discount Total</b></td><td>{structuredData.discount_total.toFixed(2)}</td></tr>
              <tr><td><b>VAT Amount</b></td><td>{structuredData.vat_amount.toFixed(2)}</td></tr>
              <tr><td><b>Net Subtotal</b></td><td>{structuredData.net_subtotal.toFixed(2)}</td></tr>
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
