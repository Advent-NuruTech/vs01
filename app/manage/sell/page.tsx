import { PosClient } from "@/components/pos-client";
import { StaffGate } from "@/components/staff-gate";
export default function SellPage() { return <StaffGate permission="SALES"><PosClient /></StaffGate>; }
