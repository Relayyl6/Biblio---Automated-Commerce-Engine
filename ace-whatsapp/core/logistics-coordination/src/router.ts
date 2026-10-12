import { OrderPayload, LogisticsProvider, DispatchResult } from './types.js';
import { KwikAdapter } from './adapters/kwik.js';
import { SendboxAdapter } from './adapters/sendbox.js';
import P from 'pino';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

export class DispatchRouter {
  private kwik: KwikAdapter;
  private sendbox: SendboxAdapter;

  constructor() {
    this.kwik = new KwikAdapter();
    this.sendbox = new SendboxAdapter();
  }

  /**
   * Routes the order to the optimal logistics provider based on location heuristics.
   */
  async autoDispatch(order: OrderPayload): Promise<DispatchResult> {
    logger.info({ orderId: order.orderId }, 'Initiating auto-dispatch routing');
    
    // Safety check
    if (!order.pickupAddress || !order.dropoffAddress) {
      return { success: false, provider: 'kwik', error: 'Missing addresses for dispatch' };
    }

    const pickupState = order.pickupAddress.state.toLowerCase();
    const dropoffState = order.dropoffAddress.state.toLowerCase();

    let provider: LogisticsProvider;
    let providerName: 'kwik' | 'sendbox';

    // Heuristic: If intra-state in Lagos or Abuja, use Kwik (fast last-mile). 
    // If interstate, use Sendbox.
    const kwikStates = ['lagos', 'abuja', 'fct'];
    
    if (pickupState === dropoffState && kwikStates.some(s => pickupState.includes(s))) {
      provider = this.kwik;
      providerName = 'kwik';
    } else {
      provider = this.sendbox;
      providerName = 'sendbox';
    }

    logger.info({ orderId: order.orderId, provider: providerName }, 'Selected logistics provider');

    try {
      const result = await provider.dispatch(order);
      if (!result.success) {
        logger.warn({ orderId: order.orderId, primaryProvider: providerName, error: result.error }, 'Primary logistics dispatch failed, attempting secondary provider as last option');
        const secondaryProviderName = providerName === 'kwik' ? 'sendbox' : 'kwik';
        const secondaryProvider = this.getProvider(secondaryProviderName);
        const secondaryResult = await secondaryProvider.dispatch(order);
        if (secondaryResult.success) {
          logger.info({ orderId: order.orderId, secondaryProvider: secondaryProviderName, trackingNumber: secondaryResult.trackingNumber }, 'Secondary provider dispatch succeeded');
          return secondaryResult;
        }
        logger.error({ orderId: order.orderId, primaryError: result.error, secondaryError: secondaryResult.error }, 'All automated logistics providers failed');
        return {
          success: false,
          provider: providerName,
          error: `Primary (${providerName}): ${result.error}; Secondary (${secondaryProviderName}): ${secondaryResult.error}`,
        };
      }
      logger.info({ orderId: order.orderId, trackingNumber: result.trackingNumber }, 'Dispatch successful');
      return result;
    } catch (err: any) {
      logger.error({ err, orderId: order.orderId }, 'Unhandled exception during dispatch');
      return { success: false, provider: providerName, error: err.message };
    }
  }

  getProvider(name: 'kwik' | 'sendbox'): LogisticsProvider {
    return name === 'kwik' ? this.kwik : this.sendbox;
  }
}
