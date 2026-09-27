import { faker } from "@faker-js/faker";
import { db } from "../db-connection";
import { usersTable } from "../schema/users";

const COUNT = 20;

export async function seedUsers() {
  const rows = Array.from({ length: COUNT }, (_, index) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      id: faker.string.uuid(),
      firstName,
      lastName,
      email: faker.internet
        .email({ firstName, lastName, provider: "example.com" })
        .toLowerCase()
        .replace("@", `.${index}@`),
    };
  });

  await db.insert(usersTable).values(rows);
}
