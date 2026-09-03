import { OrdersClient } from "@/components/orders-client";
import { StaffGate } from "@/components/staff-gate";
import "./orders.css";

export default function OrdersPage() {
  return <StaffGate permission="ORDERS"><OrdersClient /></StaffGate>;
}
