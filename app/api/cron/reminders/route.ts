import { NextResponse } from "next/server";
import webpush from "web-push";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Dipanggil harian oleh Vercel Cron (lihat vercel.json). Dilindungi CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys belum diset" }, { status: 500 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@budgetly.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Tanggal hari ini & besok dalam WIB
  const wib = (offsetDays: number) => {
    const d = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000);
    return d.getUTCDate();
  };
  const today = wib(0);
  const tomorrow = wib(1);

  const schedules = await db.schedule.findMany({
    where: { active: true, dayOfMonth: { in: [today, tomorrow] } },
  });

  let sent = 0;
  for (const s of schedules) {
    const subs = await db.pushSubscription.findMany({ where: { userId: s.userId } });
    const isToday = s.dayOfMonth === today;
    const payload = JSON.stringify({
      title: isToday ? "⏰ Jadwal hari ini" : "🔔 Pengingat besok",
      body: `${s.name}: ${s.fromAccount} → ${s.toAccount} • Rp ${new Intl.NumberFormat("id-ID").format(s.amount)}`,
      url: "/dashboard",
      tag: `schedule-${s.id}-${s.dayOfMonth}`,
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  }
  return NextResponse.json({ schedules: schedules.length, sent });
}
