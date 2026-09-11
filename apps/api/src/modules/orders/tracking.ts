import { BadRequestException } from '@nestjs/common';
import {
  CARRIER_LABEL,
  CARRIERS,
  TRACKING_NUMBER_PATTERN,
  trackingUrl,
  type CarrierCode,
} from '@inkhaus/shared';

/** tracking as a request body carries it */
export type TrackingInput = { carrier: string; number: string };

export type ParsedTracking = { carrier: CarrierCode; number: string };

/** the tracking block an order DTO carries */
export type Tracking = { carrier: string; number: string; url: string | null };

const isCarrier = (value: string): value is CarrierCode =>
  (CARRIERS as readonly string[]).includes(value);

/**
 * Validates and trims tracking from a request. The DTOs check the same things,
 * but the workflow is called from more than one controller and does not assume
 * any of them ran a ValidationPipe.
 */
export function parseTracking(input: TrackingInput): ParsedTracking {
  if (!isCarrier(input.carrier)) {
    throw new BadRequestException(`carrier must be one of ${CARRIERS.join(', ')}`);
  }
  const number = input.number.trim();
  if (!TRACKING_NUMBER_PATTERN.test(number)) {
    throw new BadRequestException(
      'A tracking number is 4 to 64 letters, digits, spaces or dashes.',
    );
  }
  return { carrier: input.carrier, number };
}

/** carrier, number and the carrier's tracking page - or null until both halves exist */
export function toTracking(o: { carrier: string | null; trackingNumber: string | null }): Tracking | null {
  if (!o.carrier || !o.trackingNumber) return null;
  return {
    carrier: o.carrier,
    number: o.trackingNumber,
    url: isCarrier(o.carrier) ? trackingUrl(o.carrier, o.trackingNumber) : null,
  };
}

/** "UPS 1Z999AA10123456784" - the note on a TRACKING event */
export function trackingNote(t: ParsedTracking): string {
  return `${CARRIER_LABEL[t.carrier]} ${t.number}`;
}

/**
 * The inverse of `trackingNote`, for a TRACKING event - the note is all an
 * event keeps, and the back office links each one to the carrier, including
 * numbers the order has since replaced. It sits beside `trackingNote` so the
 * format has one owner. Null for a note this module did not write.
 */
export function parseTrackingNote(note: string | null): Tracking | null {
  if (!note) return null;
  for (const carrier of CARRIERS) {
    const prefix = `${CARRIER_LABEL[carrier]} `;
    if (!note.startsWith(prefix)) continue;
    const number = note.slice(prefix.length);
    if (!TRACKING_NUMBER_PATTERN.test(number)) return null;
    return { carrier, number, url: trackingUrl(carrier, number) };
  }
  return null;
}
