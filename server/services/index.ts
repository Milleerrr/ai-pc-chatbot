import { BuildService } from "./BuildService";
import { ChatService } from "./ChatService";
import { MessageService } from "./MessageService";
import { type RequestContext } from "./types";

export default class Services {
  readonly builds: BuildService;
  readonly chats: ChatService;
  readonly messages: MessageService;

  constructor(context: RequestContext) {
    this.builds = new BuildService(context, this);
    this.chats = new ChatService(context, this);
    this.messages = new MessageService(context, this);
  }
}
