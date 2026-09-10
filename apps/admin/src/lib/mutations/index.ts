/**
 * Every write the back office can make, with its authorization attached.
 *
 * These live apart from the route handlers that call them so the rule and the
 * transport are not the same file. Anything that ever needs a second way in - a
 * server action, a CLI, a webhook - calls this rather than reimplementing the
 * check, which is how the UI's control and the server's refusal stay the same
 * decision rather than two that happen to agree today.
 *
 * FROZEN after Phase 0; each feature owns its own file below.
 */
export * from "./orders";
export * from "./quotes";
export * from "./customers";
export * from "./catalog";
export * from "./reviews";
export * from "./staff";
