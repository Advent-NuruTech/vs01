import { InventoryClient } from "@/components/inventory-client";
import { StaffGate } from "@/components/staff-gate";
export default function InventoryPage() { return <StaffGate permission="INVENTORY"><InventoryClient /></StaffGate>; }
