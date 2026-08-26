/**
 * Studio assets are served by the API (`GET /api/v1/assets/{clipart,fonts,ink-colors}`).
 * The source data lives in `packages/shared` and is what the seed loads.
 */
export type { Clip } from "@inkhaus/shared";
export { CLIPART, FONTS, INK_COLORS } from "@inkhaus/shared";
