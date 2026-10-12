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
  const KWIK_API_KEY = process.env.KWIK_API_KEY;

  if (SENDSTACK_API_KEY && !SENDSTACK_API_KEY.includes("your_")) {
    logger.info({ orderId }, "Dispatching rider via Sendstack API...");
    try {
      const response = await fetch("https://api.sendstack.africa/v1/deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SENDSTACK_API_KEY}`,
        },
        body: JSON.stringify({
          order_reference: orderId,
          merchant_id: merchantId,
          dropoff_contact_phone: customerPhone,
          delivery_type: "express",
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const trackingUrl = data.data?.tracking_url || `https://track.sendstack.africa/${data.data?.delivery_id}`;
        const riderName = data.data?.rider?.name || "Assigned Dispatch Rider";
        const riderPhone = data.data?.rider?.phone || "N/A";
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Sendstack");
        return { trackingUrl, riderName, riderPhone };
      }
      logger.warn({ orderId, status: response.status }, "Sendstack API returned non-OK, using fallback dispatch");
    } catch (err) {
      logger.error({ err, orderId }, "Sendstack dispatch call failed, using fallback dispatch");
    }
  }

  // Secondary automated courier: Kwik Delivery API
  if (KWIK_API_KEY && !KWIK_API_KEY.includes("your_")) {
    logger.info({ orderId }, "Attempting secondary dispatch via Kwik Delivery API...");
    try {
      const kwikUrl = process.env.KWIK_API_URL || "https://api.kwik.delivery";
      const kwikRes = await fetch(`${kwikUrl}/api/v1/tasks/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${KWIK_API_KEY}`,
        },
        body: JSON.stringify({
          delivery_task: {
            delivery_custom_field: orderId,
            pickup_custom_field: merchantId,
            recipient_phone: customerPhone,
            payment_method: 131424,
            item_description: `Biblio Order #${orderId.slice(0, 8)}`,
          },
        }),
      });

      if (kwikRes.ok) {
        const kwikData = (await kwikRes.json()) as any;
        const trackingNumber = kwikData?.data?.task_id || kwikData?.data?.tracking_number;
        const trackingUrl = kwikData?.data?.tracking_url || `https://kwik.delivery/track/${trackingNumber}`;
        const riderName = kwikData?.data?.rider_name || "Kwik Express Courier";
        const riderPhone = kwikData?.data?.rider_phone || "Assigned on Pickup";
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Kwik Delivery");
        return { trackingUrl, riderName, riderPhone };
      }
      logger.warn({ orderId, status: kwikRes.status }, "Kwik API returned non-OK status");
    } catch (kwikErr) {
      logger.error({ kwikErr, orderId }, "Kwik dispatch call failed");
    }
  }

  // Absolute Last Resort:
  // If all automated logistics integrations fail or are unavailable in production,
  // do NOT fabricate fake phone numbers or phantom deliveries. Route order directly
  // to MANUAL_DISPATCH so merchant is notified to arrange direct delivery.
  if (process.env.NODE_ENV === "production" || !process.env.ALLOW_SANDBOX_DISPATCH) {
    logger.warn({ orderId, merchantId }, "Automated courier dispatch unavailable — routing order to MANUAL_DISPATCH");
    return {
      trackingUrl: "MANUAL_DISPATCH",
      riderName: "Merchant Direct Dispatch",
      riderPhone: "Pending Vendor Assignment",
    };
  }

  // Sandbox testing mode only:
  const deliveryRef = `ACE-SANDBOX-${orderId.slice(0, 8).toUpperCase()}`;
  const trackingUrl = `https://track.sendstack.africa/track/${deliveryRef}`;
  logger.info({ orderId, deliveryRef, trackingUrl }, "Sandbox rider assigned for local integration testing");

  return {
    trackingUrl,
    riderName: "ACE Sandbox Dispatch",
    riderPhone: customerPhone,
  };
}
