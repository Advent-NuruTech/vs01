import { StaffGate } from "@/components/staff-gate";
export default function FinancePage() { return <StaffGate permission="FINANCE"><main className="module-page"><p className="eyebrow">FINANCIAL CONTROL</p><h2>Finance</h2><p>Revenue uses charged totals on completed sales and services. COGS uses immutable item cost snapshots. Payments and receivables remain separate.</p></main></StaffGate>; }
