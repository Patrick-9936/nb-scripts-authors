// Release check for the Android build.
//
// The CLI itself is updated with npm; this reports the APK release so a user can
// see whether their phone build is current.
const LATEST = "https://api.github.com/repos/Patrick-9936/nb-scripts-authors/releases/latest";

export function compareVersions(first, second) {
  const a = String(first || "").replace(/^[vV]/, "").split(".");
  const b = String(second || "").replace(/^[vV]/, "").split(".");
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = Number.parseInt(a[index] ?? "0", 10) || 0;
    const right = Number.parseInt(b[index] ?? "0", 10) || 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

export async function latestRelease() {
  const response = await fetch(LATEST, {
    headers: { accept: "application/vnd.github+json", "user-agent": "script-library-cli" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`GitHub ответил ${response.status}`);
  const release = await response.json();
  const asset = (release.assets || []).find(item => item.name === "Script-Library.apk");
  return {
    version: release.tag_name,
    notes: release.body || "",
    published_at: release.published_at,
    size: asset?.size ?? 0,
    url: asset?.browser_download_url ?? null,
    sha256: asset?.digest?.replace(/^sha256:/, "") ?? null,
  };
}
