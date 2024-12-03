#!/usr/bin/env tsx

import {logDone, logWarning} from "../../src/util/logger";
import {z} from "zod";
import {makeFile, srcPath} from "../../src/util/pathUtils";
import * as path from "node:path";
import {existsSync, readFileSync} from "node:fs";
import {getParsedData} from "../../src/util/commandParser";
import {GlobalCommandInputSchema} from "../../src/types/GlobalCommandInputSchema";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    name: z.string().includes(":"),
    path: z.string().default(srcPath('commands'))
})
type ICommandInput = z.infer<typeof CommandInputSchema>

export function make_command() {
    const data = getParsedData(arguments, CommandInputSchema)
    const fPath = path.join(data.path, data.name.replace(':', '_')) + `.ts`
    const code = commandTsCode(data)

    if (existsSync(fPath) && !data.force) {
        logWarning(`${fPath} file exists. use --force to over-write`)
        logWarning(`...skipped.`)
        return;
    } else {
        const makeFpathDone = makeFile(fPath, code, data.force)
        if (makeFpathDone) {
            logDone(fPath)
        }
    }

    const {importCode, commandCode} = appendedIndexCode(data)

    const idxFPath = srcPath('index.ts')

    let indexTsContent = readFileSync(idxFPath).toString()
    if (!indexTsContent.replace(/\s/g, '').includes(importCode.replace(/\s/g, ''))) {
        indexTsContent = indexTsContent.replace(`// ENDS_IMPORT_DONOTREMOVETHISLINE`, importCode + `\n// ENDS_IMPORT_DONOTREMOVETHISLINE`)
    }
    if (!indexTsContent.replace(/\s/g, '').includes(commandCode.replace(/\s/g, ''))) {
        indexTsContent = indexTsContent.replace(`// NEXT_COMMAND__DONOTREMOVETHISLINE`, commandCode + `\n// NEXT_COMMAND__DONOTREMOVETHISLINE`)
    }
    const writeCmdDone = makeFile(idxFPath, indexTsContent, true)
    if (writeCmdDone) {
        logDone(idxFPath)
    }
}


const commandTsCode = (data: ICommandInput) => {
    data = data!
    const fnName = data.name.replace(':', '_')
    return `
import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData} from "@/util/commandParser";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    
})

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = '';

export function ${fnName}() {
    const data = getParsedData(arguments, CommandInputSchema)
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data)
    // implementations
    
}

function get_code(data: ICommandInput) {
    // work with input

    return \`
\${commandInputDeclarationCode}

// other codes...
\`;
}

`
}

const appendedIndexCode = (data: ICommandInput) => {
    data = data!
    const fname = data.name.replace(":", "_")
    const importCode = `import {${fname}} from "@/commands/${fname}"`
    const commandCode = `
program
    .command("${data.name}")
    .description("${data.name}")
    .action(${data.name.replace(":", "_")})
`
    return {importCode, commandCode}
}