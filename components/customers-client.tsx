"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

type FirestoreDate = { toDate: () => Date; toMillis: () => number };

type CustomerRecord = {
  id: string;
  name?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  outstandingBalance?: number;
  totalPurchases?: number;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

type LinkedRecord = {
  id: string;
  customerId?: string | null;
  total?: number;
  status?: string;
  createdAt?: FirestoreDate;
};

type CustomerActivity = {
  sales: number;
  saleValue: number;
  orders: number;
  orderValue: number;
  services: number;
  serviceValue: number;
  lastActivity: FirestoreDate | undefined;
};

const emptyActivity = (): CustomerActivity => ({
  sales: 0,
  saleValue: 0,
  orders: 0,
  orderValue: 0,
  services: 0,
  serviceValue: 0,
  lastActivity: undefined,
});

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function dateLabel(timestamp?: FirestoreDate) {
  if (!timestamp?.toDate) return "-";
  return timestamp.toDate().toLocaleDateString("en-KE", { dateStyle: "medium" });
}

function latestDate(current: FirestoreDate | undefined, candidate: FirestoreDate | undefined) {
  if (!candidate?.toMillis) return current;
  if (!current?.toMillis || candidate.toMillis() > current.toMillis()) return candidate;
  return current;
}

export function CustomersClient() {
  const [customers, setCustomers] = useState<CustomerRecord[] | null>(null);
  const [sales, setSales] = useState<LinkedRecord[]>([]);
  const [orders, setOrders] = useState<LinkedRecord[]>([]);
  const [jobs, setJobs] = useState<LinkedRecord[]>([]);
  const [customerError, setCustomerError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const customerStop = onSnapshot(collection(db, "customers"), (snapshot) => {
      setCustomers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CustomerRecord));
      setCustomerError("");
    }, () => setCustomerError("Unable to load customers. Check your connection and refresh the page."));

    const salesStop = onSnapshot(
      query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(500)),
      (snapshot) => {
        setSales(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LinkedRecord));
        setActivityError("");
      },
      () => setActivityError("Some linked customer activity could not be loaded."),
    );
    const ordersStop = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500)),
      (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LinkedRecord)),
      () => setActivityError("Some linked customer activity could not be loaded."),
    );
    const jobsStop = onSnapshot(
      query(collection(db, "serviceJobs"), orderBy("createdAt", "desc"), limit(500)),
      (snapshot) => setJobs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as LinkedRecord)),
      () => setActivityError("Some linked customer activity could not be loaded."),
    );

    return () => {
      customerStop();
      salesStop();
      ordersStop();
      jobsStop();
    };
  }, []);

  const activityByCustomer = useMemo(() => {
    const activity = new Map<string, CustomerActivity>();
    const get = (customerId: string) => {
      const current = activity.get(customerId) ?? emptyActivity();
      activity.set(customerId, current);
      return current;
    };

    sales.forEach((sale) => {
      if (!sale.customerId || sale.status === "CANCELLED") return;
      const current = get(sale.customerId);
      current.sales += 1;
      current.saleValue += sale.total ?? 0;
      current.lastActivity = latestDate(current.lastActivity, sale.createdAt);
    });
    orders.forEach((order) => {
      if (!order.customerId || order.status === "CANCELLED") return;
      const current = get(order.customerId);
      current.orders += 1;
      current.orderValue += order.total ?? 0;
      current.lastActivity = latestDate(current.lastActivity, order.createdAt);
    });
    jobs.forEach((job) => {
      if (!job.customerId || job.status === "CANCELLED") return;
      const current = get(job.customerId);
      current.services += 1;
      current.serviceValue += job.total ?? 0;
      current.lastActivity = latestDate(current.lastActivity, job.createdAt);
    });
    return activity;
  }, [jobs, orders, sales]);

  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(customers ?? [])]
      .filter((customer) => !term || `${customer.name ?? customer.fullName ?? ""} ${customer.phone ?? ""} ${customer.email ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const aDate = activityByCustomer.get(a.id)?.lastActivity?.toMillis?.() ?? a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bDate = activityByCustomer.get(b.id)?.lastActivity?.toMillis?.() ?? b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bDate - aDate;
      });
  }, [activityByCustomer, customers, search]);

  const totals = useMemo(() => (customers ?? []).reduce((summary, customer) => {
    const activity = activityByCustomer.get(customer.id) ?? emptyActivity();
    const productValue = Math.max(customer.totalPurchases ?? 0, activity.saleValue);
    return {
      value: summary.value + productValue + activity.orderValue + activity.serviceValue,
      outstanding: summary.outstanding + (customer.outstandingBalance ?? 0),
      active: summary.active + (activity.sales + activity.orders + activity.services > 0 ? 1 : 0),
    };
  }, { value: 0, outstanding: 0, active: 0 }), [activityByCustomer, customers]);

  return <div className="customers-view">
    <div className="customers-heading">
      <div><p className="eyebrow">CUSTOMER RECORDS</p><h2>Customer relationships</h2><p>Customers created through POS, online checkout, and Garage appear here automatically.</p></div>
      <span className="live-badge">● LIVE</span>
    </div>

    <section className="customer-summary" aria-label="Customer summary">
      <article><span>Total customers</span><b>{customers === null ? "-" : customers.length}</b></article>
      <article><span>Customers with activity</span><b>{totals.active}</b></article>
      <article><span>Recorded value</span><b>{money(totals.value)}</b></article>
      <article><span>Outstanding balance</span><b>{money(totals.outstanding)}</b></article>
    </section>

    <section className="inventory-table customers-table">
      <div className="customers-toolbar">
        <div><h2>Customer directory</h2><span>Product sales, online orders, and service jobs</span></div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or email" aria-label="Search customers" />
      </div>
      {customerError && <p className="form-error" role="alert">{customerError}</p>}
      {activityError && <p className="form-error" role="alert">{activityError}</p>}
      {!customerError && customers === null && <p className="table-empty">Loading customers...</p>}
      {!customerError && customers?.length === 0 && <div className="customer-empty"><b>No customer records yet.</b><p>Enter customer details during a POS sale, online checkout, or Garage job. Supplier stock purchases do not create customer records.</p></div>}
      {customers && customers.length > 0 && visibleCustomers.length === 0 && <p className="table-empty">No customers match your search.</p>}
      {visibleCustomers.length > 0 && <div className="table-scroll"><table>
        <thead><tr><th>Customer</th><th>Contact</th><th>Product sales</th><th>Online orders</th><th>Services</th><th>Recorded value</th><th>Outstanding</th><th>Last activity</th></tr></thead>
        <tbody>{visibleCustomers.map((customer) => {
          const activity = activityByCustomer.get(customer.id) ?? emptyActivity();
          const productValue = Math.max(customer.totalPurchases ?? 0, activity.saleValue);
          const recordedValue = productValue + activity.orderValue + activity.serviceValue;
          const lastActivity = activity.lastActivity ?? customer.updatedAt ?? customer.createdAt;
          return <tr key={customer.id}>
            <td><b>{customer.name ?? customer.fullName ?? "Unnamed customer"}</b><small>Customer ID: {customer.id.slice(0, 8)}</small></td>
            <td><b>{customer.phone ?? "-"}</b>{customer.email && <small>{customer.email}</small>}</td>
            <td><b>{activity.sales}</b><small>{money(productValue)}</small></td>
            <td><b>{activity.orders}</b><small>{money(activity.orderValue)}</small></td>
            <td><b>{activity.services}</b><small>{money(activity.serviceValue)}</small></td>
            <td><b>{money(recordedValue)}</b></td>
            <td><span className={`customer-balance ${(customer.outstandingBalance ?? 0) > 0 ? "due" : "clear"}`}>{money(customer.outstandingBalance ?? 0)}</span></td>
            <td>{dateLabel(lastActivity)}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
