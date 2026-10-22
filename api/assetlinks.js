const PACKAGE_NAME = "org.reskonnect.app";
const SHA256_PATTERN = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fingerprints = String(process.env.ANDROID_APP_LINKS_SHA256_CERTS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value, index, all) => SHA256_PATTERN.test(value) && all.indexOf(value) === index);

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Fail closed until the actual Play App Signing SHA-256 fingerprint is
  // configured. Returning a placeholder association would make verification
  // appear configured while every Play-installed device still rejects it.
  if (!fingerprints.length) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "Android App Links certificate is not configured" });
  }

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
