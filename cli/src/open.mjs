// Opens a URL or a custom scheme with the platform's own handler.
import { spawn } from "node:child_process";

export function openTarget(target) {
  const platform = process.platform;
  if (platform === "win32") {
    // `start` needs an empty title argument before the URL.
    return spawn("cmd", ["/c", "start", "", target], { detached: true, stdio: "ignore", windowsVerbatimArguments: true }).unref();
  }
  if (platform === "darwin") return spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  return spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
}

/** True when the platform can plausibly open a custom scheme. */
export function canOpen() {
  return process.platform === "win32" || process.platform === "darwin" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}
