import { TRPCError } from "@trpc/server";
import type Services from ".";
import { type RequestContext } from "./types";

export class Service {
  protected readonly context: RequestContext;
  protected readonly services: Services;

  constructor(context: RequestContext, services: Services) {
    this.context = context;
    this.services = services;
  }

  protected get db() {
    return this.context.db;
  }

  /** The signed-in user's id. Throws UNAUTHORIZED when signed out. */
  protected get userId(): string {
    const { user } = this.context;

    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    return user.userId;
  }
}
