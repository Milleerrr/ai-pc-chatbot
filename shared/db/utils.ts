import type {
  AnyPgColumnBuilder,
  PgBuildExtraConfigColumns,
  PgTableExtraConfigValue,
} from "drizzle-orm/pg-core";
import { snakeCase, timestamp, uuid } from "drizzle-orm/pg-core";

function idColumn() {
  return uuid().primaryKey().defaultRandom();
}

function timestampColumn() {
  return timestamp({ precision: 6, withTimezone: true }).notNull().defaultNow();
}

type BaseColumns = {
  id: ReturnType<typeof idColumn>;
  createdAt: ReturnType<typeof timestampColumn>;
  updatedAt: ReturnType<typeof timestampColumn>;
};

type ExtraConfig<TColumns extends Record<string, AnyPgColumnBuilder>> = (
  table: PgBuildExtraConfigColumns<TColumns & BaseColumns>,
) => PgTableExtraConfigValue[];

export function baseTable<TColumns extends Record<string, AnyPgColumnBuilder>>(
  name: string,
  columns: TColumns,
  extraConfig?: ExtraConfig<TColumns>,
) {
  const tableColumns = {
    id: idColumn(),
    ...columns,
    createdAt: timestampColumn(),
    updatedAt: timestampColumn(),
  };

  if (!extraConfig) {
    return snakeCase.table(name, tableColumns);
  }

  return snakeCase.table(name, tableColumns, (table) => extraConfig(table));
}
