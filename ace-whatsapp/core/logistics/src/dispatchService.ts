import pino from "pino";
import { getMerchantApiKey } from "@ace/shared/integrations/credentials.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info", name: "logistics-api" });

export interface LogisticsProviderResponse {
  trackingUrl: string;
  riderName: string;
  riderPhone: string;
}

/**
 * Production Integration: Multi-carrier Logistics Dispatch
 * Dynamically resolves merchant-configured credentials before falling back to platform defaults.
 * Supports Sendstack, Kwik, Gokada, and MAX.
 */
export async function bookRider(
  orderId: string,
  merchantId: string,
  customerPhone: string
): Promise<LogisticsProviderResponse> {
  const sendstackApiKey = await getMerchantApiKey(merchantId, "sendstack");
  const kwikApiKey = await getMerchantApiKey(merchantId, "kwik");
  const gokadaApiKey = await getMerchantApiKey(merchantId, "gokada");
  const maxApiKey = await getMerchantApiKey(merchantId, "max");

  // 1. Primary automated courier: Sendstack Africa Logistics API
  if (sendstackApiKey && !sendstackApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Dispatching rider via Sendstack API (merchant/platform key)...");
    try {
      const response = await fetch("https://api.sendstack.africa/v1/deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sendstackApiKey}`,
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
      logger.warn({ orderId, status: response.status }, "Sendstack API returned non-OK, trying next provider");
    } catch (err) {
      logger.error({ err, orderId }, "Sendstack dispatch call failed, trying next provider");
    }
  }

  // 2. Secondary automated courier: Kwik Delivery API
  if (kwikApiKey && !kwikApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Attempting secondary dispatch via Kwik Delivery API (merchant/platform key)...");
    try {
      const kwikUrl = process.env.KWIK_API_URL || "https://api.kwik.delivery";
      const kwikRes = await fetch(`${kwikUrl}/api/v1/tasks/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${kwikApiKey}`,
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

  // 3. Tertiary automated courier: Gokada Logistics API
  if (gokadaApiKey && !gokadaApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Attempting dispatch via Gokada API...");
    try {
      const gokadaRes = await fetch("https://api.gokada.ng/api/v1/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gokadaApiKey}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          merchant_id: merchantId,
          recipient_phone: customerPhone,
        }),
      });
      if (gokadaRes.ok) {
        const gData = (await gokadaRes.json()) as any;
        const trackingUrl = gData?.tracking_url || `https://gokada.ng/track/${orderId}`;
        const riderName = gData?.driver_name || "Gokada Pilot";
        const riderPhone = gData?.driver_phone || "N/A";
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Gokada");
        return { trackingUrl, riderName, riderPhone };
      }
    } catch (gErr) {
      logger.error({ gErr, orderId }, "Gokada dispatch call failed");
    }
  }

  // 4. MAX Delivery API
  if (maxApiKey && !maxApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Attempting dispatch via MAX Delivery API...");
    try {
      const maxRes = await fetch("https://api.max.ng/v1/deliveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${maxApiKey}`,
        },
        body: JSON.stringify({
          reference: orderId,
          customer_phone: customerPhone,
        }),
      });
      if (maxRes.ok) {
        const mData = (await maxRes.json()) as any;
        const trackingUrl = mData?.tracking_url || `https://max.ng/track/${orderId}`;
        const riderName = mData?.champion_name || "MAX Champion";
        const riderPhone = mData?.champion_phone || "N/A";
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via MAX");
        return { trackingUrl, riderName, riderPhone };
      }
    } catch (mErr) {
      logger.error({ mErr, orderId }, "MAX dispatch call failed");
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
