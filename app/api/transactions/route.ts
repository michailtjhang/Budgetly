import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "transactions.json");

// 🔹 GET semua transaksi
export async function GET() {
  const file = fs.readFileSync(filePath, "utf-8");
  const transactions = JSON.parse(file);
  return NextResponse.json(transactions);
}

// 🔹 POST transaksi baru
export async function POST(req: Request) {
  const body = await req.json();

  const file = fs.readFileSync(filePath, "utf-8");
  const transactions = JSON.parse(file);

  const newTransaction = {
    id: Date.now(),
    ...body,
    date: new Date().toLocaleDateString("id-ID"),
  };

  transactions.unshift(newTransaction);

  fs.writeFileSync(filePath, JSON.stringify(transactions, null, 2));

  return NextResponse.json(newTransaction, { status: 201 });
}
