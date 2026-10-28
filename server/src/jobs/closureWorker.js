import { reconcileOverdueAuctions } from '../services/closureService.js';

let intervalId = null;

/**
 * Start the background closure worker
 * @param {number} [intervalMs=10000]
 */
export function startClosureWorker(intervalMs = 10000) {
  if (intervalId) return;

  console.log(`⏱️ Starting durable auction closure worker (interval: ${intervalMs}ms)...`);

  intervalId = setInterval(async () => {
    try {
      const { closedCount } = await reconcileOverdueAuctions();
      if (closedCount > 0) {
        console.log(`🏁 Closure worker reconciled ${closedCount} overdue auction(s).`);
      }
    } catch (err) {
      console.error('Error during closure worker reconciliation cycle:', err.message);
    }
  }, intervalMs);
}

/**
 * Stop the background closure worker
 */
export function stopClosureWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Closure worker stopped.');
  }
}
