import { faker } from "@faker-js/faker";
import { db } from "./client";
import { accountTable, userTable } from "../schema/auth";

const GOOGLE_USERS = 2;

export async function seedUsers() {
  const googleUsers = await db
    .insert(userTable)
    .values(
      Array.from({ length: GOOGLE_USERS }, (_, index) => {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        return {
          name: `${firstName} ${lastName}`,
          email: faker.internet
            .email({ firstName, lastName, provider: "example.com" })
            .toLowerCase()
            .replace("@", `.${index}@`),
          emailVerified: true,
          image: faker.image.url(),
        };
      }),
    )
    .returning({ id: userTable.id });

  await db.insert(accountTable).values(
    googleUsers.map(({ id }) => ({
      userId: id,
      providerId: "google",
      accountId: faker.string.numeric(21),
    })),
  );

  const guestId = faker.string.uuid();

  await db.insert(userTable).values({
    id: guestId,
    name: "Anonymous",
    email: `temp-${guestId}@example.com`,
    isAnonymous: true,
  });
}
