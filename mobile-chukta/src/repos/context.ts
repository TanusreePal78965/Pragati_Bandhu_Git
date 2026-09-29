import type { SqlDb } from '../db/sqlDb';
import type { Role } from '../domain/types';

export type RepoContext = { db: SqlDb; userId: string; role: Role; now: () => Date; newId: () => string };
