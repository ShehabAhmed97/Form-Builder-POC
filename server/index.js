import { createApp } from './app.js';
import { getDb } from './db/database.js';

const db = getDb();
const app = createApp(db);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
