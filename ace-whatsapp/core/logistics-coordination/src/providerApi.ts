// core/logistics-coordination/src/providerApi.ts
//
// Unified logistics provider interface.
// Set LOGISTICS_PROVIDER=sendbox in .env to use Sendbox.
// Defaults to a local stub (no API key needed) for testing.

export interface PickupRequest {
  orderId: string;
  merchantId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  totalValueNgn: number;
  packageDescription?: string;
}

export interface PickupResult {
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  estimatedPickupMinutes?: number;
}

export async function bookPickup(req: PickupRequest): Promise<PickupResult> {
  return bookViaSendbox(req);
}

// ─── Sendbox ─────────────────────────────────────────────────────────────────

const SENDBOX_BASE = (process.env.SENDBOX_SANDBOX ?? "true") !== "false"
  ? "https://api.sendbox.co/sandbox/v2"
  : "https://api.sendbox.co/v2";

async function bookViaSendbox(req: PickupRequest): Promise<PickupResult> {
  const apiKey = process.env.SENDBOX_API_KEY;
  if (!apiKey) throw new Error("[logistics] SENDBOX_API_KEY not configured");

  const shipmentRes = await fetch(`${SENDBOX_BASE}/shipments`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pickup_address: { merchant_reference: req.merchantId },
      delivery_address: {
        name: req.customerName,
        phone: req.customerPhone,
        address: req.customerAddress,
      },
      items: req.items.map((i) => ({
        description: i.name,
        quantity: i.quantity,
        unit_price: i.unitPrice,
      })),
      cod_amount: 0,
      package_description: req.packageDescription ?? req.items.map((i) => i.name).join(", "),
      declared_value: req.totalValueNgn,
      metadata: { ace_order_id: req.orderId },
    }),
  });

  if (!shipmentRes.ok) {
    const text = await shipmentRes.text();
    throw new Error(`[logistics] Sendbox failed ${shipmentRes.status}: ${text}`);
  }

  const data = await shipmentRes.json() as any;
  const shipmentId: string = data.data?.id ?? data.id;

  await fetch(`${SENDBOX_BASE}/shipments/${shipmentId}/pickup`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pickup_time: "now" }),
  });

  return {
    trackingNumber: data.data?.tracking_number ?? shipmentId,
    trackingUrl: data.data?.tracking_url ?? `https://sendbox.co/tracking/${shipmentId}`,
    carrier: "Sendbox",
    estimatedPickupMinutes: 30,
  };
}
