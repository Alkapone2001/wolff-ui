import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MultiInvoiceManager() {
  const [files, setFiles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

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

  // === HANDLE UPLOAD ===
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
      // 1. Parse all PDFs and get their base64
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

          // Get PDF base64
          const pdf_bytes = await fileToBase64(file);

          return {
            fileName: file.name,
            pdf_bytes,
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
                description: "", // will be filled by AI below
                amount: net_sub,
                category: "", // will be filled by AI below
                ai_suggested_category: ""
              }
            ]
          };
        })
      );

      // 2. AI category suggestion
      const allowed_categories = categories.map(cat => cat.name);
      const withSuggestions = await Promise.all(
        parsedList.map(async (inv) => {
          try {
            const { data } = await axios.post(
              `${API_BASE}/categorize-expense/`,
              {
                client_id: "test-client",
                invoice_number: inv.parsed.invoice_number,
                supplier: inv.parsed.supplier,
                line_items: inv.line_items.map(({ description, amount }) => ({
                  description,
                  amount
                })),
                allowed_categories
              },
              { headers: { "Content-Type": "application/json" } }
            );
            const desc2cat = {};
            (data.categories || []).forEach(item => {
              desc2cat[item.description] = item.category;
            });
            return {
              ...inv,
              line_items: inv.line_items.map(li => ({
                ...li,
                category: desc2cat[li.description] || li.category || "",
                ai_suggested_category: desc2cat[li.description] || ""
              }))
            };
          } catch (e) {
            return inv;
          }
        })
      );

      // 3. AI description suggestion (MERGE fields, don't overwrite!)
      const withDescriptions = await Promise.all(
        withSuggestions.map(async (inv) => {
          try {
            const { data } = await axios.post(
              `${API_BASE}/describe-invoice/`,
              {
                supplier: inv.parsed.supplier,
                invoice_number: inv.parsed.invoice_number,
                date: inv.parsed.date,
                total: inv.parsed.total,
                line_items: inv.line_items.map(li => ({
                  description: li.description,
                  amount: li.amount
                }))
              },
              { headers: { "Content-Type": "application/json" } }
            );
            // Only update description, keep AI fields
            return {
              ...inv,
              line_items: inv.line_items.map(li => ({
                ...li,
                description: data.description,
                ai_suggested_category: li.ai_suggested_category,
                category: li.category
              }))
            };
          } catch {
            return inv;
          }
        })
      );

      setInvoices(withDescriptions);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }

  // === HANDLE BOOK ALL ===
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
        })),
        pdf_bytes:      inv.pdf_bytes, // <--- Attach PDF as base64!
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

  function renderAIBadge(li) {
    if (!li.ai_suggested_category) return null;
    if (li.category !== li.ai_suggested_category)
      return (
        <span title="AI suggested this category" style={{
          marginLeft: 6,
          fontSize: 11,
          color: "#546e7a",
          background: "#e3f2fd",
          padding: "2px 6px",
          borderRadius: "1em",
          border: "1px solid #b3e5fc"
        }}>
          AI: {li.ai_suggested_category}
        </span>
      );
    return (
      <span title="AI suggested this category" style={{
        marginLeft: 6,
        fontSize: 11,
        color: "#2e7d32",
        background: "#e8f5e9",
        padding: "2px 6px",
        borderRadius: "1em",
        border: "1px solid #81c784"
      }}>
        AI: {li.ai_suggested_category}
      </span>
    );
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
                          style={{ width: 250 }}
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
                        <select
                          value={li.category || ""}
                          onChange={e => {
                            const copy = [...invoices];
                            copy[i].line_items[j].category = e.target.value;
                            setInvoices(copy);
                          }}
                          style={{ width: 200 }}
                        >
                          <option value="">Select Category</option>
                          {categories.map(c => (
                            <option value={c.name} key={c.code}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                        {renderAIBadge(li)}
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
