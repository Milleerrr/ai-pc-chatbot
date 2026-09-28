import Services from ".";
import type { RequestContext } from "./types";

export default function _createService(context: RequestContext) {
  return new Services(context);
}
