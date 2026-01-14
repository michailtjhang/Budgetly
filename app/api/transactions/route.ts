import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

const transactionSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(1, "Amount must be positive"), // Ensure amount is > 0
  type: z.enum(["income", "expense"]),
  date: z.string().optional(), // Allow flexible date input
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const transactions = await db.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("GET Transactions Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const validatedData = transactionSchema.parse(body);

    const newTransaction = await db.transaction.create({
      data: {
        description: validatedData.description,
        amount: validatedData.amount,
        type: validatedData.type,
        date: validatedData.date ? new Date(validatedData.date) : new Date(),
        userId: user.id,
      },
    });

    return NextResponse.json(newTransaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors }, { status: 400 });
    }
    console.error("POST Transaction Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const validatedData = transactionSchema.parse(data);

    // Verify ownership before updating
    const existingTransaction = await db.transaction.findUnique({
      where: { id: Number(id) }
    });

    if (!existingTransaction || existingTransaction.userId !== user.id) {
      return NextResponse.json({ error: "Transaction not found or unauthorized" }, { status: 404 });
    }

    const updatedTransaction = await db.transaction.update({
      where: { id: Number(id) },
      data: {
        description: validatedData.description,
        amount: validatedData.amount,
        type: validatedData.type,
        date: validatedData.date ? new Date(validatedData.date) : existingTransaction.date,
      },
    });

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: (error as any).errors }, { status: 400 });
    }
    console.error("PUT Transaction Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    // Verify ownership before deleting
    const existingTransaction = await db.transaction.findUnique({
      where: { id: Number(id) }
    });

    if (!existingTransaction || existingTransaction.userId !== user.id) {
      return NextResponse.json({ error: "Transaction not found or unauthorized" }, { status: 404 });
    }

    await db.transaction.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Transaction deleted" });
  } catch (error) {
    console.error("DELETE Transaction Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

