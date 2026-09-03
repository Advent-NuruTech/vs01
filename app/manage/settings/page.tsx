import { StaffGate } from "@/components/staff-gate";

export default function SettingsPage() {
  return <StaffGate permission="SETTINGS"><main className="module-page"><p className="eyebrow">BUSINESS SETTINGS</p><h2>Settings</h2><p>Business profile, receipt footer, stock policy, negotiated-price guardrails, order numbering, and service defaults are maintained here.</p></main></StaffGate>;
}
