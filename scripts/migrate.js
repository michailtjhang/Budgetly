const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const dataDir = path.join(__dirname, '../data');

async function main() {
    if (!fs.existsSync(dataDir)) {
        console.log('No data directory found.');
        return;
    }

    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('transactions_') && f.endsWith('.json'));

    if (files.length === 0) {
        console.log('No transaction files found.');
        return;
    }

    for (const file of files) {
        const userId = file.replace('transactions_', '').replace('.json', '');
        console.log(`Migrating data for user: ${userId}`);

        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        let transactions = [];
        try {
            transactions = JSON.parse(content);
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
            continue;
        }

        if (!Array.isArray(transactions)) {
            console.log(`Skipping ${file}: Data is not an array`);
            continue;
        }

        console.log(`Found ${transactions.length} transactions.`);

        for (const t of transactions) {
            await prisma.transaction.create({
                data: {
                    description: t.description || 'No description',
                    amount: Number(t.amount) || 0,
                    type: t.type || 'expense',
                    date: t.date ? new Date(t.date) : new Date(),
                    userId: userId,
                    createdAt: t.date ? new Date(t.date) : new Date(),
                }
            });
        }
    }
    console.log('Migration complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
