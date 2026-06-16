// Schedules a daily local notification at HH:MM (via SW if available, else Notification API).
// Personal-app pattern: no push server. Lives in browser tab + active service worker.
import { useEffect } from "react";
import api from "@/lib/api";

function nextOccurrence(hh, mm) {
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

async function show(title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "ielts-drill",
        data: { url: "/app/drill" },
      });
      return;
    }
  } catch {}
  if (typeof Notification !== "undefined") new Notification(title, { body, icon: "/icons/icon-192.png" });
}

export function useReminder(profile) {
  useEffect(() => {
    if (!profile?.reminder_enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const [hh, mm] = (profile.reminder_time || "07:00").split(":").map(Number);

    let timeoutId, intervalId;

    const schedule = async () => {
      const target = nextOccurrence(hh, mm);
      const ms = target.getTime() - Date.now();
      timeoutId = setTimeout(async () => {
        try {
          const s = await api.get("/drill/streak");
          if (!s.data.today_done) {
            await show("Daily Drill — 8 minutes to band 8 🔥", `Streak: ${s.data.streak_days} days. Tap to start today's drill.`);
          }
        } catch {}
        schedule(); // re-schedule for next day
      }, ms);
    };

    schedule();
    // Safety: every hour, also verify drill state and fire if missed (e.g. laptop was asleep)
    intervalId = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === hh && now.getMinutes() >= mm && now.getMinutes() < mm + 5) {
        try {
          const s = await api.get("/drill/streak");
          if (!s.data.today_done) {
            await show("Daily Drill reminder", `Streak: ${s.data.streak_days} days — don't break it.`);
          }
        } catch {}
      }
    }, 60 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [profile?.reminder_enabled, profile?.reminder_time]);
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  return result;
}
