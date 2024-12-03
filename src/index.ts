import { Command, Option } from "commander";
import { VERSION } from "./version";
import { make_docs } from "@/commands/make_docs";
// ENDS_IMPORT_DONOTREMOVETHISLINE

const program = new Command();
program
  .addOption(new Option("-f, --force", "force write").default(false))
  .option("-v, --version", "show version", () => {
    console.log(`Version: ${VERSION}`);
    process.exit(0);
  });

program.command("make:docs").description("make:docs").action(make_docs);

// NEXT_COMMAND__DONOTREMOVETHISLINE

if (!process.env.HELP_INFO_GEN) {
  program.parse();
}

export { program };