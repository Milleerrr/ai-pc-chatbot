import { Service } from "../Service";
import { usersTable } from "../../../db/schema/users";

export default class UsersService extends Service {
  public async getUsers() {
    const users = await this.context.db.select().from(usersTable);

    if (!users) {
      throw new Error("No users found");
    }

    return users;
  }
}
