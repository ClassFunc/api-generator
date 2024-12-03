import { z } from "zod";
import { GlobalCommandInputSchema } from "@/types/GlobalCommandInputSchema";
import {
  getCommandInputDeclarationCode,
  getParsedData,
} from "@/util/commandParser";

const CommandInputSchema = GlobalCommandInputSchema.extend({
  // from commander;
});

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = "";

export function make_docs() {
  const data = getParsedData(arguments, CommandInputSchema);
  commandInputDeclarationCode = getCommandInputDeclarationCode(data);
  const code = get_code(data);
  // implementations
}

function get_code(data: ICommandInput) {
  // work with input

  return `
${commandInputDeclarationCode}

// other codes...
`;
}
