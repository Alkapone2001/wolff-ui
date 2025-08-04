import React, { useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function BankReconciliationManager() {
  const [file, setFile] = useState(null);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMatched([]);
    setUnmatched([]);
    setFilename("");
    setSuccess("");
    setUploadError("");
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setSuccess(""); setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE}/upload-bank-reconciliation/`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setMatched(res.data.matched || []);
      setUnmatched(res.data.unmatched || []);
      setFilename(res.data.filename);
      setSuccess("File processed successfully.");
    } catch (err) {
      setUploadError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (txn) => {
    if (!txn.id) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/book-bank-transaction/`, { transaction_id: txn.id });
      setSuccess(res.data.message);
      setUnmatched(unmatched.filter((u) => u.id !== txn.id));
      setMatched([...matched, txn]);
    } catch (err) {
      setUploadError("Booking failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "#f7fafd",
      borderRadius: 18,
      padding: "2rem",
      margin: "2rem auto",
      maxWidth: 900,
      boxShadow: "0 2px 12px #eef5fa"
    }}>
      <h2 style={{ color: "#134075", marginBottom: 30 }}>Bank Reconciliation (PDF)</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ marginBottom: 20 }}
      />
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        style={{
          background: "#0c65d8", color: "#fff", fontWeight: 600,
          padding: "0.7em 2.2em", border: "none", borderRadius: 8,
          fontSize: 17, boxShadow: "0 2px 8px #eaf0fa"
        }}
      >
        {loading ? "Processing..." : "Upload PDF"}
      </button>
      {success && <div style={{ color: "#298758", fontWeight: 600, marginTop: 10 }}>{success}</div>}
      {uploadError && <div style={{ color: "#b63d3d", fontWeight: 600, marginTop: 10 }}>{uploadError}</div>}

      {filename && (
        <div style={{ marginTop: 32 }}>
          <h3>File: {filename}</h3>
          <div style={{ display: "flex", gap: "8vw", flexWrap: "wrap" }}>
            <div>
              <b style={{ fontSize: 18 }}>Matched</b>
              <ul style={{ listStyle: "circle", marginLeft: 25 }}>
                {matched.length === 0 && <li style={{ color: "#555" }}>(None found)</li>}
                {matched.map((txn, i) => (
                  <li key={i} style={{ marginBottom: 7 }}>
                    <span style={{ fontWeight: 500 }}>{txn.date}</span> | {txn.amount} | {txn.payee} | {txn.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <b style={{ fontSize: 18 }}>Unmatched</b>
              <ul style={{ listStyle: "circle", marginLeft: 25 }}>
                {unmatched.length === 0 && <li style={{ color: "#555" }}>(None found)</li>}
                {unmatched.map((txn, i) => (
                  <li key={i} style={{ marginBottom: 7 }}>
                    <span style={{ fontWeight: 500 }}>{txn.date}</span> | {txn.amount} | {txn.payee} | {txn.description}{" "}
                    <button
                      onClick={() => handleBook(txn)}
                      disabled={loading}
                      style={{
                        background: "#0c65d8", color: "#fff", fontWeight: 600, border: "none",
                        borderRadius: 6, padding: "0.3em 1.1em", fontSize: 14, marginLeft: 10,
                        boxShadow: "0 1px 4px #eaf0fa"
                      }}>
                      Book to Xero
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
