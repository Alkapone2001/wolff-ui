// src/MultiInvoiceManager.jsx

import React, { useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function MultiInvoiceManager() {
  const [files, setFiles]       = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [results, setResults]   = useState([]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  function computeDueDate(dateStr) {
    try {
      let dt;
      if (dateStr && typeof dateStr === "string") {
        if (dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
          const [d, m, y] = dateStr.split(".");
          dt = new Date(`${y}-${m}-${d}`);
        } else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [d, m, y] = dateStr.split("/");
          dt = new Date(`${y}-${m}-${d}`);
        } else {
          dt = new Date(dateStr);
        }
      } else {
        dt = new Date(dateStr);
      }
      if (isNaN(dt)) throw new Error("Invalid date");
      dt.setDate(dt.getDate() + 30);
      return dt.toISOString().slice(0, 10);
    } catch (e) {
      const dt = new Date();
      dt.setDate(dt.getDate() + 30);
      return dt.toISOString().slice(0, 10);
    }
  }

  function parseNum(raw) {
    return parseFloat(String(raw).replace(/['\s]/g, "").replace(",", ".")) || 0;
  }

  async function handleUpload() {
    setError("");
    setResults([]);
    setInvoices([]);
    setLoading(true);

    if (!files.length) {
      setError("Select at least one PDF.");
      setLoading(false);
      return;
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
              {
                description: "Invoice Subtotal",
                amount: net_sub,
                account_code: "200",
                category: ""
              }
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

  // Suggest categories using backend/AI
  async function handleSuggestCategories() {
    setError("");
    setLoading(true);

    try {
      const updated = await Promise.all(
        invoices.map(async (inv) => {
          const { data } = await axios.post(
            `${API_BASE}/categorize-expense/`,
            {
              client_id: "test-client", // REQUIRED by backend!
              invoice_number: inv.parsed.invoice_number,
              supplier: inv.parsed.supplier,
              line_items: inv.line_items.map(({ description, amount }) => ({
                description,
                amount
              }))
            },
            { headers: { "Content-Type": "application/json" } }
          );
          // Map AI response to update each line item's category
          const desc2cat = {};
          (data.categories || []).forEach(item => {
            desc2cat[item.description] = item.category;
          });
          return {
            ...inv,
            line_items: inv.line_items.map(li => ({
              ...li,
              category: desc2cat[li.description] || li.category || ""
            }))
          };
        })
      );
      setInvoices(updated);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBookAll() {
    setError("");
    setResults([]);
    setLoading(true);

    try {
      const payload = invoices.map(inv => ({
        invoice_number: inv.parsed.invoice_number,
        supplier:       inv.parsed.supplier,
        date:           inv.parsed.date,
        due_date:       inv.due_date,
        currency_code:  inv.parsed.currency,
        total:          inv.parsed.total,
        vat_rate:       inv.parsed.vat_rate,
        line_items:     inv.line_items.map(li => ({
          description: li.description,
          amount: li.amount,
          category: li.category || ""
        }))
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
    <div style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "Arial" }}>
      <h1>Batch Invoice Upload & Booking</h1>
      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={e => setFiles(e.target.files)}
      />
      <button onClick={handleUpload} disabled={loading} style={{ margin: "0 1rem" }}>
        {loading ? "Working…" : "Upload & Parse All"}
      </button>
      <button onClick={handleSuggestCategories} disabled={loading || !invoices.length}>
        {loading ? "Suggesting…" : "Suggest Categories"}
      </button>
      <button onClick={handleBookAll} disabled={loading || !invoices.length}>
        {loading ? "Booking…" : "Book All to Xero"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {invoices.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Parsed Invoices</h2>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead style={{ background: "#eee" }}>
              <tr>
                <th>#</th><th>File</th><th>Supplier</th><th>Date</th>
                <th>Invoice #</th><th>Total</th><th>VAT%</th><th>Line Items</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={i}>
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
                          style={{ width: 140 }}
                        />{" "}
                        <input
                          type="number"
                          value={li.amount}
                          onChange={e => {
                            const copy = [...invoices];
                            copy[i].line_items[j].amount = Number(e.target.value);
                            setInvoices(copy);
                          }}
                          style={{ width: 80 }}
                        />{" "}
                        <input
                          value={li.category || ""}
                          placeholder="Category"
                          onChange={e => {
                            const copy = [...invoices];
                            copy[i].line_items[j].category = e.target.value;
                            setInvoices(copy);
                          }}
                          style={{ width: 120 }}
                        />
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Booking Results</h2>
          <ul>
            {results.map((r, i) => (
              <li key={i}>
                <strong>Invoice {invoices[i]?.parsed.invoice_number}:</strong>{" "}
                {r.error ? <span style={{color:"red"}}>{r.error}</span> : JSON.stringify(r)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
