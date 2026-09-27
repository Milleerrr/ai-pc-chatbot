import type { AnyPgColumnBuilder } from "drizzle-orm/pg-core";
import { snakeCase, timestamp, uuid } from "drizzle-orm/pg-core";

export const baseTable = <TColumns extends Record<string, AnyPgColumnBuilder>>(
  name: string,
  columns: TColumns,
) => {
  return snakeCase.table(name, {
    id: uuid().primaryKey(),
    ...columns,
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  });
};
