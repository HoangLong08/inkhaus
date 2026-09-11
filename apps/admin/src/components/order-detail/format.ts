import { CARRIER_LABEL, CARRIERS, type CarrierCode } from "@inkhaus/shared/orders";
import { PRINT_METHOD_LABEL, PRINT_METHODS, type PrintMethodCode } from "@inkhaus/shared/taxonomy";

import { humanize } from "@/lib/format";

/**
 * Labels for the codes an order carries. The API sends carriers and methods as
 * the strings it stored, so each falls back to a readable version of the code
 * rather than to nothing when this app has not heard of a value yet.
 */

const isCarrier = (value: string): value is CarrierCode =>
  (CARRIERS as readonly string[]).includes(value);

const isPrintMethod = (value: string): value is PrintMethodCode =>
  (PRINT_METHODS as readonly string[]).includes(value);

/** FEDEX -> "FedEx" */
export const carrierLabel = (carrier: string) =>
  isCarrier(carrier) ? CARRIER_LABEL[carrier] : humanize(carrier);

/** DTG -> "DTG", SCREEN_PRINT -> "Screen print" - not humanize(), which says "Dtg" */
export const methodLabel = (method: string) =>
  isPrintMethod(method) ? PRINT_METHOD_LABEL[method] : humanize(method);

/** the carrier code if it is one this app offers, for a form's default value */
export const knownCarrier = (carrier: string | undefined): CarrierCode | undefined =>
  carrier && isCarrier(carrier) ? carrier : undefined;
