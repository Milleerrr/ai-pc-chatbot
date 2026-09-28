import type Services from ".";
import { type RequestContext } from "./types";

export class Service {
  protected readonly context: RequestContext;
  protected readonly services: Services;

  constructor(context: RequestContext, services: Services) {
    this.context = context;
    this.services = services;
  }
}
