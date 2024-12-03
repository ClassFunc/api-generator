#!/usr/bin/env node

import {Command, Option} from "commander";
import {VERSION} from "./version";
import {make_docs} from "@/commands/make_docs";
// ENDS_IMPORT_DONOTREMOVETHISLINE

const program = new Command();
program
    .addOption(new Option("-f, --force", "force write").default(false))
    .option("-v, --version", "show version", () => {
        console.log(`Version: ${VERSION}`);
        process.exit(0);
    });


program.command("make").description("make api from .yaml file")
    .option("-i, --inputYaml [inputYaml]", "input yaml file path (local or https://)", "api.yaml")
    .option("-o, --outDir [outDir]", "output directory path", "docs")
    .option("-n, --name [name]", "name of output director")
    .option("-d, --genDefaults", "generate defaults", true)
    .action(make_docs);

// NEXT_COMMAND__DONOTREMOVETHISLINE

if (!process.env.HELP_INFO_GEN) {
    program.parse();
}

export {program};
