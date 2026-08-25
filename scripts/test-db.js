import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_peb8zHX5ORyB@ep-fragrant-cake-axw2ieex-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require', {
    max: 1,
    idle_timeout: 3,
    connect_timeout: 10
});

import Redis from 'ioredis';

async function run() {
    try {
        console.log("Connecting to Neon DB...");
        const vendors = await sql`SELECT * FROM vendors`;
        console.log("Vendors in DB:", JSON.stringify(vendors, null, 2));

        const redis = new Redis(process.env.REDIS_URL || 'rediss://default:gQAAAAAAASw2AAIgcDFjMDJkNDkwYTYzMzE0YTUyYWI1NGE0ODM4MTczN2NlZg@evolving-mutt-76854.upstash.io:6379');
        const credKeys = await redis.keys('baileys:creds:*');
        console.log("Cred Keys in Redis:", credKeys);

        for (const k of credKeys) {
            const raw = await redis.get(k);
            const creds = JSON.parse(raw);
            console.log(`Key ${k} -> Registered phone:`, creds?.me?.id || creds?.me?.name);
        }
        await redis.quit();
    } catch (err) {
        console.error("Diagnostic error:", err);
    } finally {
        await sql.end();
    }
}
run();
