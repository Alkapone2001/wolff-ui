import React, { useState } from "react";
import axios from "axios";

export default function BankReconciliation() {
  const [file, setFile] = useState(null);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState(null);
  axios.defaults.baseURL = process.env.REACT_APP_API_BASE || "http://localhost:8000";

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMatched([]);
    setUnmatched([]);
    setUploadResponse(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("/upload-bank-reconciliation/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMatched(res.data.matched || []);
      setUnmatched(res.data.unmatched || []);
      setUploadResponse(res.data);
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (txn) => {
    if (!txn.id) return;
    setLoading(true);
    try {
      const res = await axios.post("/book-bank-transaction/", { transaction_id: txn.id });
      alert(res.data.message);
      // Optionally remove from unmatched, add to matched
      setUnmatched(unmatched.filter((u) => u.id !== txn.id));
      setMatched([...matched, txn]);
    } catch (err) {
      alert("Booking failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: "2rem 0" }}>
      <h2>Bank Reconciliation (PDF)</h2>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={loading || !file}>
        {loading ? "Processing..." : "Upload PDF"}
      </button>
      {uploadResponse && (
        <div>
          <h4>File: {uploadResponse.filename}</h4>
          <div>
            <b>Matched:</b>
            <ul>
              {matched.map((txn, i) => (
                <li key={i}>
                  {txn.date} | {txn.amount} | {txn.payee} | {txn.description}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <b>Unmatched:</b>
            <ul>
              {unmatched.map((txn, i) => (
                <li key={i}>
                  {txn.date} | {txn.amount} | {txn.payee} | {txn.description}{" "}
                  <button onClick={() => handleBook(txn)} disabled={loading}>
                    Book to Xero
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
