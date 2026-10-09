// Apply one migration file inside a transaction.
//   node --env-file=.env.local scripts/migrate.mjs supabase/migrations/<file>.sql
// SUPABASE_DB_URL is the direct connection (IPv6 only). When this machine has no IPv6 route,
// set SUPABASE_POOLER_HOST and the same credentials are used through the IPv4 session pooler.
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node --env-file=.env.local scripts/migrate.mjs <file.sql>");
  process.exit(1);
}

function poolerUrl() {
  const host = process.env.SUPABASE_POOLER_HOST;
  if (!host) return null;
  const url = new URL(process.env.SUPABASE_DB_URL);
  const ref = url.hostname.split(".")[1];
  url.hostname = host;
  url.port = "5432";
  url.username = `postgres.${ref}`;
  return url.toString();
}

async function connect() {
  const direct = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await direct.connect();
    return direct;
  } catch (err) {
    const pooled = poolerUrl();
    if (!pooled || !/ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT/.test(err.code ?? err.message)) throw err;
    console.log("direct connection unavailable, using the session pooler");
    const client = new pg.Client({ connectionString: pooled, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return client;
  }
}

const client = await connect();
try {
  await client.query("begin");
  await client.query(readFileSync(file, "utf8"));
  await client.query("commit");
  console.log(`applied ${file}`);
} catch (err) {
  await client.query("rollback");
  console.error(`rolled back: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
