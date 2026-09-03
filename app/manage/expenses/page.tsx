import { StaffGate } from "@/components/staff-gate";
export default function ExpensesPage() { return <StaffGate permission="FINANCE"><main className="module-page"><p className="eyebrow">OPERATING COSTS</p><h2>Expenses</h2><p>Expenses are recorded with category, receipt, vendor, payment method and audit trail; they reduce net profit but never alter revenue.</p></main></StaffGate>; }
