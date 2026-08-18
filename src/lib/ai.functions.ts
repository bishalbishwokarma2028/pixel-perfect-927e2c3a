import { createServerFn } from "@tanstack/react-start";
import { AskAssistantInput, runAssistant } from "./ask-assistant.server";

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskAssistantInput.parse(input))
  .handler(async ({ data }) => runAssistant(data.message));
