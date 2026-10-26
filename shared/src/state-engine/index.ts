import { OrderState, OrderEvent } from '../types.js';
import { transition, TransitionError } from '../../../ace-whatsapp/core/state-machine/src/orderStateMachine.js';
import { dataIntelligence } from '../data-intelligence/engine.js';
import { sql, jsonb } from '../clients.js';

export { TransitionError };

function mapStateToOrderStatus(status: string): string {
  switch (status) {
    case 'no_order':
    case 'draft':
    case 'awaiting_payment':
      return 'pending';
    case 'payment_verified':
      return 'confirmed';
    case 'rider_assigned':
      return 'processing';
    case 'in_transit':
      return 'shipped';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
    const userId = isUuid ? customerId : null;
    const dbStatus = mapStateToOrderStatus(nextState.status);

    await sql`
      insert into orders (id, tenant_id, user_id, state, status, items, updated_at)
      values (
        ${nextState.orderId}::uuid,
        ${merchantId}::uuid,
        ${userId ? sql`${userId}::uuid` : null},
        ${jsonb(nextState)},
        ${dbStatus}::order_status,
        ${jsonb((nextState as any).items || [])},
        now()
      )
      on conflict (id) do update 
      set state = excluded.state, 
          status = excluded.status, 
          items = excluded.items, 
          updated_at = now()
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
