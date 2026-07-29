/**
 * smart-compaction — model-agnostic percentage-based auto-compaction.
 *
 * The built-in trigger is absolute (contextWindow - reserveTokens), so a fixed
 * reserveTokens compacts at a different % on every model. This fires at a fixed
 * PERCENT of whatever the active model's window is — so it behaves the same
 * whether you're on a 200k model or a 1M model.
 *
 * Keep the built-in as a safety net: leave settings.json compaction at defaults
 * (reserveTokens 16384) so it only catches near-overflow if this misses.
 *
 * Commands:
 *   /compact-at         show current threshold
 *   /compact-at 85      set threshold to 85%
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_THRESHOLD = 85; // percent

export default function (pi: ExtensionAPI) {
  let threshold = DEFAULT_THRESHOLD;
  let compacting = false;

  // agent_settled = agent idle, no retry/compaction/follow-up pending: safe to compact.
  pi.on("agent_settled", async (_event, ctx) => {
    if (compacting || !ctx.isIdle()) return;
    const usage = ctx.getContextUsage?.();
    if (!usage || usage.percent == null) return;
    if (usage.percent < threshold) return;

    compacting = true;
    ctx.ui.notify(`Auto-compacting at ${Math.round(usage.percent)}% of context…`, "info");
    ctx.compact({
      onComplete: () => { compacting = false; },
      onError: () => { compacting = false; },
    });
  });

  pi.registerCommand("compact-at", {
    description: "Set the % of context window at which to auto-compact (model-agnostic)",
    handler: async (args, ctx) => {
      const raw = args?.[0];
      if (!raw) {
        ctx.ui.notify(`Auto-compact threshold: ${threshold}% of the active model's window`, "info");
        return;
      }
      const n = Number(raw.replace("%", ""));
      if (!Number.isFinite(n) || n < 10 || n > 99) {
        ctx.ui.notify("Give a number 10–99, e.g. /compact-at 85", "warn");
        return;
      }
      threshold = n;
      ctx.ui.notify(`Auto-compact threshold set to ${threshold}%`, "info");
    },
  });
}
