import React, { useState, useEffect } from "react";
import axios from "axios";

const MessageHistoryView = () => {
  const [clientId, setClientId] = useState("test_client");
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMessages();
  }, [clientId]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/message-history/?client_id=${clientId}`);
      setMessages(res.data);
    } catch (err) {
      setError("Failed to fetch messages");
    }
  };

  const filteredMessages = messages.filter((msg) =>
    msg.content.toLowerCase().includes(filter.toLowerCase())
  );

  const exportToCSV = () => {
    const csvRows = [
      ["Role", "Content", "Timestamp"],
      ...filteredMessages.map((msg) => [
        msg.role,
        `"${msg.content.replace(/"/g, '""')}"`,
        new Date(msg.timestamp).toLocaleString(),
      ]),
    ];

    const csvData = csvRows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `message_history_${clientId}.csv`;
    link.click();
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "auto", fontFamily: "Arial" }}>
      <h2>Message History</h2>
      <input
        type="text"
        placeholder="Client ID"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        style={{ marginRight: 10 }}
      />
      <input
        type="text"
        placeholder="Search messages"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ marginRight: 10 }}
      />
      <button onClick={exportToCSV}>Export to CSV</button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginTop: 20, background: "#f9f9f9", padding: 15 }}>
        {filteredMessages.map((msg, index) => (
          <div key={index} style={{ marginBottom: 10 }}>
            <strong>{msg.role.toUpperCase()}</strong>:{" "}
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
            <div style={{ fontSize: "0.8em", color: "#666" }}>
              {new Date(msg.timestamp).toLocaleString()}
            </div>
            <hr />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageHistoryView;
