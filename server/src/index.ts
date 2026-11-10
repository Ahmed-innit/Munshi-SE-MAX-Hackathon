import app from './app';
import { PORT } from './config/db';

app.listen(PORT, () => {
  console.log(`Munshi Server listening on port ${PORT}`);
});
