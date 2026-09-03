import { ExpensesClient } from "@/components/expenses-client";
import { StaffGate } from "@/components/staff-gate";
import "./expenses.css";

export default function ExpensesPage() {
  return <StaffGate permission="FINANCE"><ExpensesClient /></StaffGate>;
}
