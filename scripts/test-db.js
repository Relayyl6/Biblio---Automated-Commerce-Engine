import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required.");
    process.exit(1);
}

const sql = postgres(databaseUrl, {
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

        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            console.error("REDIS_URL environment variable is required.");
            process.exit(1);
        }
        const redis = new Redis(redisUrl);
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
