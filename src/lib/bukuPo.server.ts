import { createServerFn } from "@tanstack/react-start";

const API_BASE = "https://www.buku-po.my.id/api/orders";
const CUSTOMER_API = "https://www.buku-po.my.id/api/customers";

export type BukuPoOrderListItem = {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_type: string;
  customer_address: string;
  order_date: string;
  status: string;
  subtotal: string;
  down_payment: string;
  deposit_used: string;
  total: string;
  notes: string;
  created_at: string;
};

export type BukuPoOrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  processing_quantity: number;
  shipped_quantity: number;
  unit_price: string;
  cost_price: string;
};

export type BukuPoOrderDetail = BukuPoOrderListItem & {
  items: BukuPoOrderItem[];
};

export type BukuPoNotes = {
  senderName?: string;
  senderPhone?: string;
  remarks?: string;
};

function parseNotes(raw: string): BukuPoNotes {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as BukuPoNotes;
  } catch {
    return {};
  }
}

export type BukuPoCustomer = {
  id: string;
  name: string;
  address: string;
  email: string;
  type: string;
};

export type NormalizedBukuPoCustomer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  type: string;
};

function normalizeCustomer(c: BukuPoCustomer): NormalizedBukuPoCustomer {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.email || "",
    type: c.type,
  };
}

function normalizeOrder(order: BukuPoOrderListItem) {
  const notes = parseNotes(order.notes);
  return {
    id: order.id,
    invoiceNumber: order.invoice_number,
    customerId: order.customer_id,
    customerName: order.customer_name,
    customerType: order.customer_type,
    customerAddress: order.customer_address,
    orderDate: order.order_date,
    status: order.status,
    subtotal: order.subtotal,
    downPayment: order.down_payment,
    depositUsed: order.deposit_used,
    total: order.total,
    senderName: notes.senderName || "",
    senderPhone: notes.senderPhone || "",
    remarks: notes.remarks || "",
    createdAt: order.created_at,
  };
}

function normalizeOrderDetail(order: BukuPoOrderDetail) {
  const base = normalizeOrder(order);
  return {
    ...base,
    items: (order.items || []).map((item) => ({
      id: item.id,
      orderId: item.order_id,
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      processingQuantity: item.processing_quantity,
      shippedQuantity: item.shipped_quantity,
      unitPrice: item.unit_price,
      costPrice: item.cost_price,
    })),
  };
}

export type NormalizedBukuPoOrder = ReturnType<typeof normalizeOrder>;
export type NormalizedBukuPoOrderDetail = ReturnType<typeof normalizeOrderDetail>;

export const fetchBukuPoOrders = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch(API_BASE, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Gagal mengambil data PO: ${res.status}`);
  }
  const data = (await res.json()) as BukuPoOrderListItem[];
  return data.map(normalizeOrder);
});

export const fetchBukuPoOrderDetail = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const res = await fetch(`${API_BASE}/${data.id}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Gagal mengambil detail PO: ${res.status}`);
    }
    const order = (await res.json()) as BukuPoOrderDetail;
    return normalizeOrderDetail(order);
  });

export const fetchBukuPoCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch(CUSTOMER_API, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Gagal mengambil data customer Buku-Po: ${res.status}`);
  }
  const data = (await res.json()) as BukuPoCustomer[];
  return data.map(normalizeCustomer);
});
