import React, { useState } from "react";
import MultiInvoiceManager from "./components/MultiInvoiceManager";
import MessageHistoryView from "./components/MessageHistoryView";
import SummarizeContext from "./components/SummarizeContext";
import BankReconciliationManager from "./components/BankReconciliationManager";

function App() {
  const [showMessages, setShowMessages] = useState(false);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Batch Invoice Upload & Booking</h1>
      <MultiInvoiceManager />

      <div style={{ margin: "2rem 0" }}>
        <button onClick={() => setShowMessages(!showMessages)}>
          {showMessages ? "Hide Message History" : "View Message History"}
        </button>
        {showMessages && (
          <div>
            <MessageHistoryView />
            <SummarizeContext />
          </div>
        )}
      </div>
       <BankReconciliationManager />
    </div>
  );
}

export default App;
