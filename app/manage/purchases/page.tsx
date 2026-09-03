import { PurchasesClient } from "@/components/purchases-client";
import { StaffGate } from "@/components/staff-gate";

export default function PurchasesPage() {
  return <StaffGate permission="INVENTORY"><PurchasesClient /></StaffGate>;
}
