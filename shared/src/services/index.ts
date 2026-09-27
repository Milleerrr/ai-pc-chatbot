import { type RequestContext } from "../api/types";
import UsersService from "./Users";

export default class Services {
  users: UsersService;

  constructor(context: RequestContext) {
    this.users = new UsersService(context, this);
  }
}
