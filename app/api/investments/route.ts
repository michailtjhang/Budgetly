import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

const investmentSchema = z.object({
  name: z.string().min(1),
  platform: z.string().min(1),
  type: z.string().min(1),
  amount: z.number().positive(),
  units: z.number().positive().optional(),
  note: z.string().optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await db.investment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = investmentSchema.parse(await req.json());
    return NextResponse.json(await db.investment.create({ data: { ...data, userId: user.id } }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? error.issues : "Invalid request" }, { status: 400 });
  }
}
