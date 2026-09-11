import { AdminOrderFilterDto } from './admin-list-orders.dto';

/**
 * GET /admin/exports/orders.csv - the list's filter and sort, without paging.
 * `page` and `limit` are refused rather than ignored (the global pipe forbids
 * unknown keys): an export that quietly honoured `limit=20` would be a file that
 * looks complete and is not. The row cap is the server's, not the caller's.
 */
export class ExportOrdersDto extends AdminOrderFilterDto {}
