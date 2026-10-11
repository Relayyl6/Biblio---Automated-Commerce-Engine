import { OrderState, OrderEvent } from '../types.js';
import { transition, TransitionError } from '../../../ace-whatsapp/core/state-machine/src/orderStateMachine.js';
import { dataIntelligence } from '../data-intelligence/engine.js';
import { sql, jsonb } from '../clients.js';

export { TransitionError };

/**
 * Shared State Engine
 * 
 * Wraps the pure `transition` reducer with side-effects: 
 * persistence and Data Intelligence telemetry.
 * 
 * This is the sole mechanism by which OrderState should be mutated system-wide.
 */
export async function applyOrderEvent(
  merchantId: string,
  customerId: string,
  currentState: OrderState,
  event: OrderEvent
): Promise<OrderState> {
  const nextState = transition(currentState, event);

  // Skip no_order persistence
  if (nextState.status !== "no_order") {
    await sql`
      insert into orders (id, merchant_id, customer_id, state, updated_at)
      values (
        ${nextState.orderId},
        ${merchantId},
        ${customerId},
        ${jsonb(nextState)},
        now()
      )
      on conflict (id) do update set state = excluded.state, updated_at = now()
    `;
  }

  // LAYER 3 - Data Intelligence Hooks
  await dataIntelligence.captureOrderStateChange({
    merchantId,
    customerId,
    orderId: nextState.status !== 'no_order' ? nextState.orderId : 'unknown',
    fromState: currentState.status,
    toState: nextState.status,
    timestamp: Date.now()
  });

  return nextState;
}
