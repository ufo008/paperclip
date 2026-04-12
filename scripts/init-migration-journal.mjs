import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || 'postgres://root:root@192.168.9.14:5432/paperclip';

async function initMigrationJournal() {
  console.log('Connecting to:', databaseUrl);
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Check if migration table already exists
    const existing = await sql`
      SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1
    `;
    console.log('Migration journal already exists');
  } catch (e) {
    console.log('Creating migration journal...');

    // Create the migration journal schema and table
    await sql.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    console.log('Migration journal schema and table created');
  }

  await sql.end();
  console.log('Done');
}

initMigrationJournal().catch(console.error);
