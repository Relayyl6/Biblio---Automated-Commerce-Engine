import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info", name: "logistics-api" });

export interface LogisticsProviderResponse {
  trackingUrl: string;
  riderName: string;
  riderPhone: string;
}

/**
 * Production Integration: Sendstack Africa Logistics API
 * Books a physical rider via Sendstack's endpoint.
 */
export async function bookRider(
  orderId: string,
  merchantId: string,
  customerPhone: string
): Promise<LogisticsProviderResponse> {
  const SENDSTACK_API_KEY = process.env.SENDSTACK_API_KEY;
  if (!SENDSTACK_API_KEY) {
    throw new Error("Missing SENDSTACK_API_KEY in environment variables.");
  }

  logger.info({ orderId }, "Dispatching rider via Sendstack...");

  // Allow local simulation to bypass real fetch
  if (SENDSTACK_API_KEY === "mock") {
    return {
      trackingUrl: "https://track.sendstack.africa/mock-123",
      riderName: "Mock Rider",
      riderPhone: "08000000000"
    };
  }
  
  // Real HTTP call to Sendstack (Production API)
  const response = await fetch("https://api.sendstack.africa/v1/deliveries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SENDSTACK_API_KEY}`
    },
    body: JSON.stringify({
      order_reference: orderId,
      merchant_id: merchantId,
      dropoff_contact_phone: customerPhone,
      delivery_type: "express"
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sendstack API Error: ${response.status} - ${errorBody}`);
  }

  const data = (await response.json()) as any;
  
  const trackingUrl = data.data?.tracking_url || `https://track.sendstack.africa/${data.data?.delivery_id}`;
  const riderName = data.data?.rider?.name || "Assigned Rider";
  const riderPhone = data.data?.rider?.phone || "N/A";
  
  logger.info({ orderId, trackingUrl }, "Rider booked successfully");

  return {
    trackingUrl,
    riderName,
    riderPhone,
  };
}
