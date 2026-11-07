import pino from "pino";
import { getMerchantApiKey } from "@ace/shared/integrations/credentials.js";
import { normalizeNigerianPhone, formatRiderPhone } from "./phoneUtils.js";
import { resolveCoordinates } from "./geocodingUtils.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info", name: "logistics-api" });

export interface LogisticsProviderResponse {
  trackingUrl: string;
  riderName: string;
  riderPhone: string;
  provider?: string;
}

export interface DispatchOptions {
  pickupAddress?: string;
  dropoffAddress?: string;
  itemsDescription?: string;
  declaredValue?: number;
}

/**
 * Production Integration: Multi-carrier Logistics Dispatch Broker.
 * Dynamically resolves merchant-configured credentials before falling back to platform defaults.
 * Supports:
 *   1. Fez Delivery (major Nigerian last-mile & interstate network)
 *   2. Sendstack Africa
 *   3. Kwik Delivery
 *   4. Gokada Logistics
 *   5. MAX Delivery
 *
 * Resilience:
 *   - Automatically normalizes Nigerian customer & rider phone numbers (+234 vs 080)
 *   - Resolves missing coordinates to city/LGA centroids to prevent HTTP 422 rejections
 *   - 8-second request timeouts (AbortSignal.timeout)
 *   - Automatic sequential failover on HTTP 5xx or connection timeouts
 *   - Fallback to MANUAL_DISPATCH if all couriers fail or credentials unconfigured
 */
export async function bookRider(
  orderId: string,
  merchantId: string,
  customerPhone: string,
  options?: DispatchOptions
): Promise<LogisticsProviderResponse> {
  const normalizedCustomerE164 = normalizeNigerianPhone(customerPhone, "e164");
  const normalizedCustomerNational = normalizeNigerianPhone(customerPhone, "national");

  const pickupAddress = options?.pickupAddress || "Merchant Store Location, Ikeja, Lagos";
  const dropoffAddress = options?.dropoffAddress || "Lagos, Nigeria";
  const pickupCoords = resolveCoordinates(pickupAddress);
  const dropoffCoords = resolveCoordinates(dropoffAddress);

  const fezApiKey = (await getMerchantApiKey(merchantId, "fez")) || process.env.FEZ_API_KEY;
  const sendstackApiKey = (await getMerchantApiKey(merchantId, "sendstack")) || process.env.SENDSTACK_API_KEY;
  const kwikApiKey = (await getMerchantApiKey(merchantId, "kwik")) || process.env.KWIK_API_KEY;
  const gokadaApiKey = (await getMerchantApiKey(merchantId, "gokada")) || process.env.GOKADA_API_KEY;
  const maxApiKey = (await getMerchantApiKey(merchantId, "max")) || process.env.MAX_API_KEY;

  const TIMEOUT_MS = 8000;

  // 1. Fez Delivery API (Primary Nigerian Courier Partner)
  if (fezApiKey && !fezApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Attempting dispatch via Fez Delivery API...");
    try {
      const fezUrl = process.env.FEZ_API_URL || "https://api.fezdelivery.co/v1";
      const fezRes = await fetch(`${fezUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${fezApiKey}`,
        },
        body: JSON.stringify({
          order_reference: orderId,
          merchant_id: merchantId,
          recipient_name: "Customer",
          recipient_phone: normalizedCustomerNational,
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          pickup_coordinates: pickupCoords,
          dropoff_coordinates: dropoffCoords,
          delivery_type: "express",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (fezRes.ok) {
        const data = (await fezRes.json()) as any;
        const trackingUrl = data?.data?.tracking_url || `https://track.fezdelivery.co/${data?.data?.order_id || orderId}`;
        const riderName = data?.data?.rider?.name || "Fez Express Courier";
        const riderPhone = formatRiderPhone(data?.data?.rider?.phone || "Assigned on Pickup");
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Fez Delivery");
        return { trackingUrl, riderName, riderPhone, provider: "fez" };
      }
      logger.warn({ orderId, status: fezRes.status }, "Fez Delivery returned non-OK, trying next courier");
    } catch (err: any) {
      logger.error({ err: err.message, orderId }, "Fez Delivery dispatch call failed or timed out");
    }
  }

  // 2. Sendstack Africa Logistics API
  if (sendstackApiKey && !sendstackApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Attempting dispatch via Sendstack API...");
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
          dropoff_contact_phone: normalizedCustomerE164,
          pickup_address: pickupAddress,
          delivery_address: dropoffAddress,
          delivery_type: "express",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const trackingUrl = data.data?.tracking_url || `https://track.sendstack.africa/${data.data?.delivery_id || orderId}`;
        const riderName = data.data?.rider?.name || "Sendstack Dispatch Pilot";
        const riderPhone = formatRiderPhone(data.data?.rider?.phone || "Assigned on Pickup");
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Sendstack");
        return { trackingUrl, riderName, riderPhone, provider: "sendstack" };
      }
      logger.warn({ orderId, status: response.status }, "Sendstack API returned non-OK, trying next provider");
    } catch (err: any) {
      logger.error({ err: err.message, orderId }, "Sendstack dispatch call failed or timed out");
    }
  }

  // 3. Kwik Delivery API
  if (kwikApiKey && !kwikApiKey.includes("your_")) {
    logger.info({ orderId, merchantId }, "Attempting dispatch via Kwik Delivery API...");
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
            recipient_phone: normalizedCustomerNational,
            pickup_address: pickupAddress,
            delivery_address: dropoffAddress,
            pickup_latitude: pickupCoords.latitude,
            pickup_longitude: pickupCoords.longitude,
            delivery_latitude: dropoffCoords.latitude,
            delivery_longitude: dropoffCoords.longitude,
            payment_method: 131424,
            item_description: `Biblio Order #${orderId.slice(0, 8)}`,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (kwikRes.ok) {
        const kwikData = (await kwikRes.json()) as any;
        const trackingNumber = kwikData?.data?.task_id || kwikData?.data?.tracking_number;
        const trackingUrl = kwikData?.data?.tracking_url || `https://kwik.delivery/track/${trackingNumber || orderId}`;
        const riderName = kwikData?.data?.rider_name || "Kwik Express Courier";
        const riderPhone = formatRiderPhone(kwikData?.data?.rider_phone || "Assigned on Pickup");
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Kwik Delivery");
        return { trackingUrl, riderName, riderPhone, provider: "kwik" };
      }
      logger.warn({ orderId, status: kwikRes.status }, "Kwik API returned non-OK status");
    } catch (kwikErr: any) {
      logger.error({ err: kwikErr.message, orderId }, "Kwik dispatch call failed or timed out");
    }
  }

  // 4. Gokada Logistics API (Requires accurate coordinates)
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
          recipient_phone: normalizedCustomerNational,
          pickup_latitude: pickupCoords.latitude,
          pickup_longitude: pickupCoords.longitude,
          delivery_latitude: dropoffCoords.latitude,
          delivery_longitude: dropoffCoords.longitude,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (gokadaRes.ok) {
        const gData = (await gokadaRes.json()) as any;
        const trackingUrl = gData?.tracking_url || `https://gokada.ng/track/${orderId}`;
        const riderName = gData?.driver_name || "Gokada Pilot";
        const riderPhone = formatRiderPhone(gData?.driver_phone || "Assigned on Pickup");
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via Gokada");
        return { trackingUrl, riderName, riderPhone, provider: "gokada" };
      }
      logger.warn({ orderId, status: gokadaRes.status }, "Gokada API returned non-OK status");
    } catch (gErr: any) {
      logger.error({ err: gErr.message, orderId }, "Gokada dispatch call failed or timed out");
    }
  }

  // 5. MAX Delivery API
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
          customer_phone: normalizedCustomerNational,
          pickup_latitude: pickupCoords.latitude,
          pickup_longitude: pickupCoords.longitude,
          delivery_latitude: dropoffCoords.latitude,
          delivery_longitude: dropoffCoords.longitude,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (maxRes.ok) {
        const mData = (await maxRes.json()) as any;
        const trackingUrl = mData?.tracking_url || `https://max.ng/track/${orderId}`;
        const riderName = mData?.champion_name || "MAX Champion";
        const riderPhone = formatRiderPhone(mData?.champion_phone || "Assigned on Pickup");
        logger.info({ orderId, trackingUrl }, "Rider booked successfully via MAX");
        return { trackingUrl, riderName, riderPhone, provider: "max" };
      }
      logger.warn({ orderId, status: maxRes.status }, "MAX API returned non-OK status");
    } catch (mErr: any) {
      logger.error({ err: mErr.message, orderId }, "MAX dispatch call failed or timed out");
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
      provider: "manual",
    };
  }

  // Sandbox testing mode only:
  const deliveryRef = `ACE-SANDBOX-${orderId.slice(0, 8).toUpperCase()}`;
  const trackingUrl = `https://track.sendstack.africa/track/${deliveryRef}`;
  logger.info({ orderId, deliveryRef, trackingUrl }, "Sandbox rider assigned for local integration testing");

  return {
    trackingUrl,
    riderName: "ACE Sandbox Dispatch",
    riderPhone: normalizedCustomerE164 || customerPhone,
    provider: "sandbox",
  };
}
