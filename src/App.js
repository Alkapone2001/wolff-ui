import React, { useState } from "react";
import AppHeader from "./components/AppHeader";
import TabNav from "./components/TabNav";
import InvoiceManager from "./components/InvoiceManager";
import BankReconciliationManager from "./components/BankReconciliationManager";

export default function App() {
  const [tab, setTab] = useState("invoices");

  return (
    <div className="main-app">
      <AppHeader />
      <TabNav activeTab={tab} setTab={setTab} />
      <div style={{ marginTop: 30 }}>
        {tab === "invoices" && <InvoiceManager />}
        {tab === "bank" && <BankReconciliationManager />}
      </div>
    </div>
  );
}
