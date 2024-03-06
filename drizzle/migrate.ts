import 'dotenv/config';
import { drizzle, } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from './schema';

const connection = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(connection, { schema });

(async () => {
    await migrate(db, { migrationsFolder: './drizzle' });
    await connection.end();
})();
