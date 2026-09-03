import { FinanceClient } from "@/components/finance-client";
import { StaffGate } from "@/components/staff-gate";
import "./finance.css";

export default function FinancePage() {
  return <StaffGate permission="FINANCE"><FinanceClient /></StaffGate>;
}
