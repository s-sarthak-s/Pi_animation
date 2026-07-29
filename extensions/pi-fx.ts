/**
 * pi-fx — custom bottom bar: directory + git branch + context% + cost + model.
 * (Animation lives in pi-mascot.ts.)
 *
 * Commands:  /fx        toggle the footer
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  let footerOn = true;

  const applyFooter = (ctx: ExtensionContext) => {
    if (!footerOn) return ctx.ui.setFooter(undefined);
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());
      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          let cost = 0;
          for (const e of ctx.sessionManager.getBranch()) {
            if (e.type === "message" && e.message.role === "assistant") {
              cost += (e.message as AssistantMessage).usage.cost.total;
            }
          }
          const dir = ctx.cwd.replace(process.env.HOME || "~", "~").split("/").slice(-2).join("/");
          const branch = footerData.getGitBranch();
          const usage = ctx.getContextUsage?.();
          const pct = usage?.percent != null ? `${Math.round(usage.percent)}%` : "–";

          const left = theme.fg("accent", ` ${dir}`) + theme.fg("dim", branch ? `  ${branch}` : "  (no git)");
          const right = theme.fg("dim", `${pct} ctx  $${cost.toFixed(3)}  `) + theme.fg("borderAccent", ctx.model?.id?.split("/").pop() || "no-model");
          const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          return [truncateToWidth(left + pad + right, width)];
        },
      };
    });
  };

  pi.on("session_start", async (_e, ctx) => applyFooter(ctx));

  pi.registerCommand("fx", {
    description: "Toggle the custom footer bar",
    handler: async (_args, ctx) => {
      footerOn = !footerOn;
      applyFooter(ctx);
      ctx.ui.notify(`footer ${footerOn ? "on" : "off"}`, "info");
    },
  });
}
