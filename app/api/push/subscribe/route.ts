import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sub = schema.parse(await req.json());
    await db.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({ endpoint: "" }));
  if (endpoint) await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
