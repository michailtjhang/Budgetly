import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { currentUser } from "@clerk/nextjs/server";

const dataDir = path.join(process.cwd(), "data");

function getUserFile(userId: string) {
  return path.join(dataDir, `transactions_${userId}.json`);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filePath = getUserFile(user.id);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json([]);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const filePath = getUserFile(user.id);

  let transactions = [];
  if (fs.existsSync(filePath)) {
    transactions = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  const newTransaction = {
    id: Date.now(),
    ...body,
    date: new Date().toISOString(),
  };

  transactions.unshift(newTransaction); // tambah di atas
  fs.writeFileSync(filePath, JSON.stringify(transactions, null, 2));

  return NextResponse.json(newTransaction);
}
