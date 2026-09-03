import { StaffGate } from "@/components/staff-gate";

export default function ReportsPage() {
  return <StaffGate permission="FINANCE"><main className="module-page"><p className="eyebrow">REPORTING</p><h2>Reports</h2><p>Sales, profit, expense, inventory valuation, customer balance, supplier purchase, service, and mechanic reports use indexed completed transactions.</p></main></StaffGate>;
}
