import { ReportsClient } from "@/components/reports-client";
import { StaffGate } from "@/components/staff-gate";
import "./reports.css";

export default function ReportsPage() {
  return <StaffGate permission="FINANCE"><ReportsClient /></StaffGate>;
}
