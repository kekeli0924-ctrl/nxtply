import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const row = getDb().prepare('SELECT data FROM personal_records WHERE id = 1').get();
  res.json(row?.data ? JSON.parse(row.data) : null);
});

router.put('/', (req, res) => {
  getDb().prepare('UPDATE personal_records SET data = ?, updated_at = datetime(\'now\') WHERE id = 1').run(JSON.stringify(req.body));
  res.json(req.body);
});

export default router;
