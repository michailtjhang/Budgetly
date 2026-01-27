"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";

interface Transaction {
    id: number;
    type: "income" | "expense";
    amount: number;
    date: string;
    description: string;
}

interface FinancialChartProps {
    transactions: Transaction[];
    month: string; // YYYY-MM
}

export default function FinancialChart({ transactions, month }: FinancialChartProps) {
    // 1. Prepare Data for Area Chart (Daily Activity)
    // Create an array of days based on the selected month
    const daysInMonth = new Date(
        parseInt(month.split("-")[0]),
        parseInt(month.split("-")[1]),
        0
    ).getDate();

    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dateStr = `${month}-${String(day).padStart(2, "0")}`;

        // Filter transactions for this day
        const dayTransactions = transactions.filter(t => t.date.startsWith(dateStr));

        const income = dayTransactions
            .filter(t => t.type === "income")
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const expense = dayTransactions
            .filter(t => t.type === "expense")
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        return {
            name: String(day),
            date: dateStr,
            Pemasukan: income,
            Pengeluaran: expense
        };
    });

    // 2. Prepare Data for Pie Chart (Income vs Expense)
    const totalIncome = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

    const pieData = [
        { name: "Pemasukan", value: totalIncome },
        { name: "Pengeluaran", value: totalExpense },
    ];

    const COLORS = ["#10b981", "#f43f5e"]; // Emerald-500, Rose-500

    const formatRupiah = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    if (transactions.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Area Chart: Tren Keuangan */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-6">Tren Keuangan Bulan Ini</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickFormatter={(value) => `${value / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number | undefined) => formatRupiah(value ?? 0)}
                            />
                            <Area
                                type="monotone"
                                dataKey="Pemasukan"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorIncome)"
                            />
                            <Area
                                type="monotone"
                                dataKey="Pengeluaran"
                                stroke="#f43f5e"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorExpense)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Pie Chart: Perbandingan */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-6">Pemasukan vs Pengeluaran</h3>
                <div className="h-[300px] w-full flex items-center justify-center">
                    {totalIncome === 0 && totalExpense === 0 ? (
                        <p className="text-gray-400 text-sm">Belum ada data visual</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number | undefined) => formatRupiah(value ?? 0)}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
