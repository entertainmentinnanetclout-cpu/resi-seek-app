const TOKEN_KEY = "rk_bg_notification_token_v1";
const POLL_URL = "https://mefjzkhobkltlbmhusdh.supabase.co/functions/v1/native-notification-poll";
const NOTIFICATION_ID = 130010;
const CHANNEL_ID = "reskonnect_updates";
const TOKEN_RE = /^[0-9a-f]{64}$/;

addEventListener("configureResKonnectNotifications", (resolve, reject, args) => {
  try {
    const token = typeof args?.token === "string" ? args.token.trim().toLowerCase() : "";
    if (TOKEN_RE.test(token)) CapacitorKV.set(TOKEN_KEY, token);
    else CapacitorKV.remove(TOKEN_KEY);
    resolve({ ok: true });
  } catch (error) {
    reject(error);
  }
});

addEventListener("pollResKonnectNotifications", async (resolve, reject) => {
  try {
    const stored = CapacitorKV.get(TOKEN_KEY);
    const token = typeof stored?.value === "string" ? stored.value.trim().toLowerCase() : "";
    if (!TOKEN_RE.test(token)) {
      resolve({ ok: true, skipped: "not_configured" });
      return;
    }

    const network = CapacitorDevice.getNetworkStatus();
    if (network?.connected === false) {
      resolve({ ok: true, skipped: "offline" });
      return;
    }

    const response = await fetch(POLL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      resolve({ ok: false, status: response.status });
      return;
    }

    const result = await response.json();
    const count = Number(result?.count ?? 0);
    if (result?.ok === true && Number.isFinite(count) && count > 0) {
      CapacitorNotifications.schedule([
        {
          id: NOTIFICATION_ID,
          title: "ResKonnect update",
          body: count === 1 ? "You have a new account update. Tap to view it." : `You have ${Math.min(Math.floor(count), 99)} new account updates. Tap to view them.`,
          channelId: CHANNEL_ID,
          autoCancel: true,
        },
      ]);
    }

    resolve({ ok: result?.ok === true, count: Number.isFinite(count) ? count : 0 });
  } catch (error) {
    reject(error);
  }
});
