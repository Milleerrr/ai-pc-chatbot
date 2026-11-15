import { buildTable, type SelectBuild } from "../../shared/db/schema";
import { Service } from "./Service";

export class BuildService extends Service {
  async create(): Promise<SelectBuild> {
    const [build] = await this.db
      .insert(buildTable)
      .values({ userId: this.userId })
      .returning();

    return build!;
  }
}
