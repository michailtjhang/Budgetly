const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const content = `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c2VsZWN0ZWQtbW9OSEV5LTMwLmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_H2OWP827VjHry52X9Kz57g2224424343111122
DATABASE_URL="postgresql://neondb_owner:npg_vPnXOW6ec9qf@ep-icy-dust-ad0finb2-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
`;

fs.writeFileSync(envPath, content.trim());
console.log('.env updated with Neon DB URL');
