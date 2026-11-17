/** Only allow local application destinations after authentication. */
export function safeLoginDestination(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) {
    return "/dashboard";
  }
  try {
    const destination = new URL(value, "https://clientpulse.invalid");
    const allowed = destination.pathname === "/dashboard" ||
      destination.pathname.startsWith("/dashboard/") ||
      destination.pathname === "/onboarding";
    return allowed ? destination.pathname + destination.search + destination.hash : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
