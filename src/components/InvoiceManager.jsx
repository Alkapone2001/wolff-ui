import React, { useState } from 'react'
import axios from 'axios'

// point axios at your FastAPI server
axios.defaults.baseURL = process.env.REACT_APP_API_BASE || 'http://localhost:8000'

export default function InvoiceManager() {
  const [file, setFile] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // +30-day due date helper
  function computeDueDate(dateStr) {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0,10)
  }

  // parse a string like "2'600.00" or "2 600,00"
  function parseNum(raw) {
    return parseFloat(
      String(raw)
        .replace(/['\s ]/g, '')
        .replace(',', '.')
    ) || 0
  }

  // 1️⃣ Upload PDF & parse
  async function handleUpload() {
    setError('')
    setResult(null)
    if (!file) return setError('Please select a PDF.')

    const form = new FormData()
    form.append('file', file)

    try {
      const { data } = await axios.post('/process-invoice/', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const p = data.structured_data

      // remap the new fields into our “parsed”
      const total        = parseNum(p.total)
      const vatRate      = parseNum(p.vat_rate)
      const taxableBase  = parseNum(p.taxable_base)
      const discountAmt  = parseNum(p.discount_total)
      const vatAmount    = parseNum(p.vat_amount)
      const netSubtotal  = parseNum(p.net_subtotal)

      const parsed = {
        supplier:       p.supplier,
        date:           p.date,
        invoice_number: p.invoice_number,
        total,
        vat_rate:      vatRate,
        taxable_base:  taxableBase,
        discount_total: discountAmt,
        vat_amount:    vatAmount,
        net_subtotal:  netSubtotal
      }

      setInvoices(list => [
        ...list,
        {
          parsed,
          due_date: computeDueDate(parsed.date),
          currency: parsed.currency || 'USD',
          line_items: [
            { description: 'Invoice Subtotal', amount: parsed.net_subtotal, account_code: '200' }
          ]
        }
      ])
      setSelectedIdx(invoices.length)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    }
  }

  // 2️⃣ Book only
  async function handleBookOnly() {
    setError('')
    setResult(null)
    if (selectedIdx == null) return setError('Select an invoice first.')

    const inv = invoices[selectedIdx]
    try {
      const { data } = await axios.post('/book-invoice/', {
        invoice_number: inv.parsed.invoice_number,
        supplier:       inv.parsed.supplier,
        date:           inv.parsed.date,
        due_date:       inv.due_date,
        currency_code:  inv.currency,
        total:          inv.parsed.total,
        vat_rate:       inv.parsed.vat_rate,
        line_items:     inv.line_items
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.detail || e.message)
    }
  }

  // 3️⃣ Upload & book in one go
  async function handleUploadAndBook() {
    setError('')
    setResult(null)
    if (!file) return setError('Please select a PDF.')

    // parse
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await axios.post('/process-invoice/', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const p = data.structured_data

      const total        = parseNum(p.total)
      const vatRate      = parseNum(p.vat_rate)
      const netSubtotal  = parseNum(p.net_subtotal)

      // book
      const { data: booked } = await axios.post('/book-invoice/', {
        invoice_number: p.invoice_number,
        supplier:       p.supplier,
        date:           p.date,
        due_date:       computeDueDate(p.date),
        currency_code:  p.currency || 'USD',
        total:          total,
        vat_rate:       vatRate,
        line_items: [
          { description: 'Invoice Subtotal', amount: netSubtotal, account_code: '200' }
        ]
      })
      setResult(booked)
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.detail || e.message)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={e => {
          setFile(e.target.files[0])
          setError('')
          setResult(null)
        }}
      />

      <div style={{ margin: '1em 0' }}>
        <button onClick={handleUpload}>Upload &amp; Parse</button>{' '}
        <button onClick={handleBookOnly}>Book Only</button>{' '}
        <button onClick={handleUploadAndBook}>Upload &amp; Book</button>
      </div>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {invoices.length > 0 && (
        <div>
          <h3>Parsed Invoices</h3>
          <ul>
            {invoices.map((inv, i) => (
              <li key={i}>
                <label>
                  <input
                    type="radio"
                    checked={i === selectedIdx}
                    onChange={() => setSelectedIdx(i)}
                  />{' '}
                  #{inv.parsed.invoice_number} — {inv.parsed.supplier} on {inv.parsed.date}
                </label>
              </li>
            ))}
          </ul>

          {selectedIdx != null && (
            <div style={{ border: '1px solid #ccc', padding: 10 }}>
              <h4>Extracted Invoice Data</h4>
              <table>
                <tbody>
                  <tr><td><b>Supplier</b></td><td>{invoices[selectedIdx].parsed.supplier}</td></tr>
                  <tr><td><b>Date</b></td><td>{invoices[selectedIdx].parsed.date}</td></tr>
                  <tr><td><b>Invoice #</b></td><td>{invoices[selectedIdx].parsed.invoice_number}</td></tr>
                  <tr><td><b>Total</b></td><td>{invoices[selectedIdx].parsed.total.toFixed(2)}</td></tr>
                  <tr><td><b>VAT %</b></td><td>{invoices[selectedIdx].parsed.vat_rate.toFixed(2)}%</td></tr>
                  <tr><td><b>Taxable Base</b></td><td>{invoices[selectedIdx].parsed.taxable_base.toFixed(2)}</td></tr>
                  <tr><td><b>Discount Total</b></td><td>{invoices[selectedIdx].parsed.discount_total.toFixed(2)}</td></tr>
                  <tr><td><b>VAT Amount</b></td><td>{invoices[selectedIdx].parsed.vat_amount.toFixed(2)}</td></tr>
                  <tr><td><b>Net Subtotal</b></td><td>{invoices[selectedIdx].parsed.net_subtotal.toFixed(2)}</td></tr>
                </tbody>
              </table>

              <h4>Edit Line Items</h4>
              {invoices[selectedIdx].line_items.map((li, j) => (
                <div key={j} style={{ marginBottom: 8 }}>
                  <input
                    placeholder="Description"
                    value={li.description}
                    onChange={e => {
                      const copy = [...invoices]
                      copy[selectedIdx].line_items[j].description = e.target.value
                      setInvoices(copy)
                    }}
                  />{' '}
                  <input
                    type="number"
                    placeholder="Amount"
                    value={li.amount}
                    onChange={e => {
                      const copy = [...invoices]
                      copy[selectedIdx].line_items[j].amount = Number(e.target.value)
                      setInvoices(copy)
                    }}
                  />{' '}
                  <input
                    placeholder="Account Code"
                    value={li.account_code}
                    onChange={e => {
                      const copy = [...invoices]
                      copy[selectedIdx].line_items[j].account_code = e.target.value
                      setInvoices(copy)
                    }}
                  />
                      <input
      placeholder="Account Code"
      value={li.account_code}
      onChange={e => { /* ... */ }}
    />
    {li.category && <span style={{ marginLeft: 6, color: "#888" }}>({li.category})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, padding: 10, background: '#eef' }}>
          <h3>Booking Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
