#!/usr/bin/env tsx

import {Command, Option} from "commander";
import {make_command} from "./commands/make_command";
import {srcPath} from "../src/util/pathUtils";

const internalProgram = new Command();


internalProgram.addOption(new Option('-f, --force', 'force write').default(false))


internalProgram
    .command("make:command")
    .description("make command")
    .argument("<name>", "name of command")
    .option("-p, --path <path>", "path to save command", srcPath('commands'))
    .action(make_command);

internalProgram.parse()