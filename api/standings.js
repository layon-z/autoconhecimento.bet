// GET /api/standings  -> classificação dos grupos da Copa
import { getStandings } from '../lib/util.js';

export default async function handler(req, res) {
  try {
    const standings = await getStandings();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ standings });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
