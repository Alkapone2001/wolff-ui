import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function InvoiceManager() {
  const [files, setFiles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE}/accounts/expense/`).then(res => {
      setCategories(res.data); // [{ name, code }]
    });
  }, []);

  function parseNum(raw) {
    return parseFloat(String(raw).replace(/['\s]/g, "").replace(",", ".")) || 0;
  }

  function computeDueDate(dateStr) {
    try {
      let dt = new Date(dateStr);
      if (isNaN(dt)) throw new Error();
      dt.setDate(dt.getDate() + 30);
      return dt.toISOString().slice(0, 10);
    } catch {
      const dt = new Date();
      dt.setDate(dt.getDate() + 30);
      return dt.toISOString().slice(0, 10);
    }
  }

  // 1️⃣ Upload & Parse All
  async function handleUpload() {
    setError(""); setResults([]); setInvoices([]); setLoading(true);
    if (!files.length) {
      setError("Select at least one PDF."); setLoading(false); return;
    }
    try {
      const parsedList = await Promise.all(
        Array.from(files).map(async (file) => {
          const form = new FormData();
          form.append("file", file);
          const { data } = await axios.post(`${API_BASE}/process-invoice/`, form, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          const p = data.structured_data;
          const total       = parseNum(p.total);
          const vat_rate    = parseNum(p.vat_rate);
          const taxable     = parseNum(p.taxable_base);
          const discount    = parseNum(p.discount_total);
          const vat_amount  = parseNum(p.vat_amount);
          const net_sub     = parseNum(p.net_subtotal);
          return {
            fileName: file.name,
            parsed: {
              supplier:       p.supplier,
              date:           p.date,
              invoice_number: p.invoice_number,
              total,
              vat_rate,
              taxable_base:   taxable,
              discount_total: discount,
              vat_amount,
              net_subtotal:   net_sub,
              currency:       p.currency || "USD"
            },
            due_date: computeDueDate(p.date),
            line_items: [
              { description: "Invoice Subtotal", amount: net_sub, account_code: "200", category: "" }
            ]
          };
        })
      );
      setInvoices(parsedList);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }

  // 2️⃣ Book All to Xero
  async function handleBookAll() {
    setError(""); setResults([]); setLoading(true);
    try {
      const payload = invoices.map(inv => ({
        invoice_number: inv.parsed.invoice_number,
        supplier:       inv.parsed.supplier,
        date:           inv.parsed.date,
        due_date:       inv.due_date,
        currency_code:  inv.parsed.currency,
        total:          inv.parsed.total,
        vat_rate:       inv.parsed.vat_rate,
        line_items:     inv.line_items
      }));
      const { data } = await axios.post(`${API_BASE}/batch/book-invoices/`, payload, {
        headers: { "Content-Type": "application/json" }
      });
      setResults(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: "#f7fafd",
      borderRadius: 18,
      padding: "2rem",
      margin: "2rem auto",
      maxWidth: 900,
      boxShadow: "0 2px 12px #eef5fa"
    }}>
      <h2 style={{ color: "#134075", marginBottom: 30 }}>Upload & Book Invoices</h2>
      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={e => setFiles(e.target.files)}
        style={{ marginBottom: 20 }}
      />
      <div style={{ margin: "12px 0 24px" }}>
        <button onClick={handleUpload} disabled={loading} style={{
          background: "#0c65d8", color: "#fff", fontWeight: 600, padding: "0.7em 2.2em",
          border: "none", borderRadius: 8, marginRight: 20, fontSize: 17, boxShadow: "0 2px 8px #eaf0fa"
        }}>
          {loading ? "Working…" : "Upload & Parse All"}
        </button>
        <button onClick={handleBookAll} disabled={loading || !invoices.length} style={{
          background: "#1f8b6d", color: "#fff", fontWeight: 600, padding: "0.7em 2.2em",
          border: "none", borderRadius: 8, fontSize: 17, boxShadow: "0 2px 8px #eaf0fa"
        }}>
          {loading ? "Booking…" : "Book All to Xero"}
        </button>
      </div>
      {error && <p style={{ color: "#b63d3d", fontWeight: 600 }}>{error}</p>}

      {invoices.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>Parsed Invoices</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              background: "white",
              borderRadius: 10,
              border: "1px solid #e5e8ea",
              minWidth: 800,
              marginTop: 10
            }}>
              <thead style={{ background: "#e7f1fc" }}>
                <tr>
                  <th>#</th>
                  <th>File</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Invoice #</th>
                  <th>Total</th>
                  <th>VAT%</th>
                  <th>Line Items</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={i} style={{ textAlign: "center" }}>
                    <td>{i+1}</td>
                    <td>{inv.fileName}</td>
                    <td>{inv.parsed.supplier}</td>
                    <td>{inv.parsed.date}</td>
                    <td>{inv.parsed.invoice_number}</td>
                    <td>{inv.parsed.total.toFixed(2)}</td>
                    <td>{inv.parsed.vat_rate.toFixed(2)}%</td>
                    <td>
                      {inv.line_items.map((li, j) => (
                        <div key={j} style={{ marginBottom: 4 }}>
                          <input
                            value={li.description}
                            onChange={e => {
                              const copy = [...invoices];
                              copy[i].line_items[j].description = e.target.value;
                              setInvoices(copy);
                            }}
                            style={{ width: 160, borderRadius: 6, border: "1px solid #dae7f4", marginRight: 8 }}
                          />
                          <input
                            type="number"
                            value={li.amount}
                            onChange={e => {
                              const copy = [...invoices];
                              copy[i].line_items[j].amount = Number(e.target.value);
                              setInvoices(copy);
                            }}
                            style={{ width: 90, borderRadius: 6, border: "1px solid #dae7f4", marginRight: 8 }}
                          />
                          <select
                            value={li.account_code}
                            onChange={e => {
                              const copy = [...invoices];
                              copy[i].line_items[j].account_code = e.target.value;
                              setInvoices(copy);
                            }}
                            style={{ borderRadius: 6, border: "1px solid #dae7f4", width: 90 }}
                          >
                            <option value="">Code</option>
                            {categories.map(c => (
                              <option value={c.code} key={c.code}>{c.name} ({c.code})</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>Booking Results</h3>
          <ul style={{ paddingLeft: 30 }}>
            {results.map((r, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                <strong>Invoice {invoices[i]?.parsed.invoice_number}:</strong>{" "}
                {r.error ? <span style={{color:"#b63d3d"}}>{r.error}</span> : JSON.stringify(r)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
