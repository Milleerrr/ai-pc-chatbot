import { defineStore } from "pinia";
import { ref } from "vue";
import {
  initialReplyModel,
  update,
  type ReplyAction,
} from "../reducers/reply";

export const useReplyStore = defineStore("reply", () => {
  const model = ref(initialReplyModel);

  function dispatch(action: ReplyAction) {
    model.value = update(model.value, action);
  }

  return { model, dispatch };
});
