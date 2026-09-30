import { getAuth } from "../../auth";

export default defineEventHandler((event) => {
  return getAuth().handler(toWebRequest(event));
});
