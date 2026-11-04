import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const item = await db.investment.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.investment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}