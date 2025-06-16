import React, { useState } from "react";
import axios from "axios";

function InvoiceUploader() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const uploadAndProcess = async () => {
    if (!file) return;
    setLoading(true);
    try {
      // 1️⃣ parse
      const form = new FormData();
      form.append("file", file);
      const { data: parseRes } = await axios.post(
        "/process-invoice/",
        form,
        { headers: { "X-Client-ID": "test_client" } }
      );
      setParsed(parseRes.structured_data);

      // 2️⃣ (optional) categorize
      // const { data: catRes } = await axios.post(
      //   "/categorize-expense/",
      //   { client_id: "test_client", ...parseRes.structured_data, line_items: [...] }
      // );
      // setParsed(p => ({ ...p, line_items: catRes.categories }));

      // 3️⃣ book in Xero
      const dueDate = new Date(parseRes.structured_data.date);
      dueDate.setDate(dueDate.getDate() + 30);
      const bookingPayload = {
        invoice_number: parseRes.structured_data.invoice_number,
        supplier: parseRes.structured_data.supplier,
        date: parseRes.structured_data.date,
        due_date: dueDate.toISOString().slice(0,10),
        line_items: parsed?.line_items ?? [  // if you built line_items earlier
          { description: "Full total", amount: parseFloat(parseRes.structured_data.total), account_code: "400" }
        ],
        currency_code: "CHF"
      };
      const { data: bookRes } = await axios.post(
        "/book-invoice/",
        bookingPayload
      );
      setBooking(bookRes);

    } catch (err) {
      console.error(err);
      alert("Something went wrong: " + (err.response?.data?.detail||err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Upload & Book Invoice</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={e => setFile(e.target.files[0])}
      />
      <button onClick={uploadAndProcess} disabled={!file || loading}>
        {loading ? "Working…" : "Upload & Book"}
      </button>

      {parsed && (
        <div style={{ marginTop: 20 }}>
          <h3>Parsed Data:</h3>
          <pre>{JSON.stringify(parsed, null, 2)}</pre>
        </div>
      )}

      {booking && (
        <div style={{ marginTop: 20 }}>
          <h3>Xero Booking Result:</h3>
          <pre>{JSON.stringify(booking, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default InvoiceUploader;
