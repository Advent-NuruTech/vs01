import { GarageClient } from "@/components/garage-client";
import { StaffGate } from "@/components/staff-gate";

export default function GaragePage() {
  return <StaffGate permission="GARAGE"><GarageClient /></StaffGate>;
}
