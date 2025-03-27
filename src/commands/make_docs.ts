import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getParsedData,} from "@/util/commandParser";
import {last} from "lodash";
import {logDone, logError} from "@/util/logger";
import * as process from "node:process";
import path from "node:path";
import {execSync} from "node:child_process";
import {copyFileSync} from "node:fs";
import {makeDir} from "@/util/pathUtils";
import {writeINData_defaultScript} from "@/commands/make_docs/scripts/writeINData_default.script";
import {writeZodSchemasScript} from "@/commands/make_docs/scripts/writeZodSchemas.script";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    inputYaml: z.string(),
    outDir: z.string(),
    name: z.string().optional(),
    genDefaults: z.boolean().optional().default(true),
    genZodSchemas: z.boolean().optional().default(true),
});

type ICommandInput = z.infer<typeof CommandInputSchema>;

// let commandInputDeclarationCode = "";

export function make_docs() {
    const data = getParsedData(arguments, CommandInputSchema);
    // commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    // implementations
    const nameYaml = last(data.inputYaml.split('/')) || '';
    const name = data.name || nameYaml.split('.')?.[0];
    if (!name) {
        logError(new Error(`can not get name`))
        process.exit(1)
    }
    const outDirFull = path.join(data.outDir, name)
//     remove old
    execSync(`rm -fr ${outDirFull}`);
//     download or copy .yaml to outDir
    const yamlDestPath = path.join(data.outDir, nameYaml);
    makeDir(data.outDir)
    if (data.inputYaml.startsWith(`https`)) {
        execSync(`curl ${data.inputYaml} -o ${yamlDestPath}`)
    } else {
        copyFileSync(data.inputYaml, yamlDestPath)
    }
    // base generator
    execSync(`npx @openapitools/openapi-generator-cli generate -i ${yamlDestPath} --generator-name typescript-fetch -o ${outDirFull}`)
    logDone(`openapi-generator:`, outDirFull);
    // generate uses
    execSync(`npx tsx ${__dirname}/scripts/generateUses.script.ts ${outDirFull}`)
    logDone(`generated uses:`, outDirFull + `/uses`)
    // generate defaults
    if (data.genDefaults) {
        writeINData_defaultScript(outDirFull, yamlDestPath, true)
        logDone(`generated defaults:`, outDirFull + `/defaults`)
    }
    if (data.genZodSchemas) {
        writeZodSchemasScript(outDirFull, yamlDestPath)
        logDone(`generated zodSchemas:`, outDirFull + `/zodSchemas`)
    }
}