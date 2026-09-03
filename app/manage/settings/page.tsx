import { SettingsClient } from "@/components/settings-client";
import { StaffGate } from "@/components/staff-gate";
import "./settings.css";

export default function SettingsPage() {
  return <StaffGate permission="SETTINGS"><SettingsClient /></StaffGate>;
}
