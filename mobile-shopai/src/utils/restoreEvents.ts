/**
 * Minimal single-subscriber event emitter for auto-restore lifecycle notifications.
 *
 * Decouples authService (which starts the background restore) from AuthContext
 * (which needs to surface the "Restoring your data…" banner to the user).
 *
 * Usage:
 *   emitter side  → emitRestoreEvent('start' | 'complete' | 'error')
 *   consumer side → onRestoreEvent(handler)  (call with null to unsubscribe)
 */

export type RestoreEvent = 'start' | 'complete' | 'error';
type RestoreHandler = (event: RestoreEvent) => void;

let _handler: RestoreHandler | null = null;

/** Register a handler to receive restore lifecycle events. Pass null to remove it. */
export const onRestoreEvent = (handler: RestoreHandler | null): void => {
  _handler = handler;
};

/** Fire an event to the registered handler, if any. */
export const emitRestoreEvent = (event: RestoreEvent): void => {
  _handler?.(event);
};
