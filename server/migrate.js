import { readFileSync } from 'fs';
import { getDb } from './db.js';
import { importData } from './routes/data.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node server/migrate.js <path/to/nxtply-export.json>');
  process.exit(1);
}

try {
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const db = getDb();
  const counts = db.transaction(() => importData(db, data))();
  console.log('Migration complete:');
  for (const [key, count] of Object.entries(counts)) {
    console.log(`  ${key}: ${count}`);
  }
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
