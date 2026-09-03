import { CustomersClient } from "@/components/customers-client";
import { StaffGate } from "@/components/staff-gate";
import "./customers.css";

export default function CustomersPage() {
  return <StaffGate permission="SALES"><CustomersClient /></StaffGate>;
}
