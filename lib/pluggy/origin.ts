export function publicOrigin(request: Request) {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) return renderUrl.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host && !host.includes("localhost") && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }
  return null;
}
