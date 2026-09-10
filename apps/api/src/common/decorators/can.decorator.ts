import { SetMetadata } from '@nestjs/common';
import type { AdminAction } from '@inkhaus/shared';

export const CAN_KEY = 'admin-capability';

/**
 * The capability a back-office route needs, from `ADMIN_CAPABILITIES` in
 * @inkhaus/shared - the same table the admin app hides its controls with and
 * its route handlers refuse with. Enforced by `CapabilityGuard`, which must come
 * after `AdminAuthGuard`:
 *
 *   @UseGuards(AdminAuthGuard, CapabilityGuard)   // on the controller
 *   @Can('orders.view')                           // on every handler
 *
 * A handler's own `@Can` wins over one on its class. A route with neither is
 * refused - see CapabilityGuard.
 *
 * For a permission that depends on a value in the body rather than on the route
 * (cancelling an order, editing a price field) the handler's `@Can` is the floor
 * and the service checks the rest.
 */
export const Can = (action: AdminAction) => SetMetadata(CAN_KEY, action);
