import Services from ".";
import type { RequestContext } from "../api/types";

export default function _createService(context: RequestContext) {
  return new Services(context);
}
