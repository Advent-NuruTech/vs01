import { SalesClient } from "@/components/sales-client";
import { StaffGate } from "@/components/staff-gate";

export default function SalesPage() {
  return <StaffGate permission="SALES"><SalesClient /></StaffGate>;
}
