import {Command} from "commander";
import {logError, logRunning} from "@/util/logger";
import {z} from "zod";
import * as process from "node:process";
import {flatten} from "lodash";

export const commandParser = (args: any) => {
    const cmd = Object.values(args).filter(v => v instanceof Command)[0];
    if (!cmd) {
        throw new Error(`no cmd instance found; make sure add this function: e.g: command.action(thisFn)`)
    }
    const argsMap: Record<string, any> = {}
    const names = cmd.registeredArguments.map(a => a.name())
    for (let idx = 0; idx < names.length; ++idx) {
        argsMap[names[idx]] = cmd.args?.[idx]
    }
    // console.log({argsMap})
    const options = cmd.optsWithGlobals()
    const r = {...argsMap, ...options}
    logRunning(r)
    return r;
}

export const getParsedData = <S extends z.ZodType>(args: any, schema: S) => {
    const options = commandParser(args)

    const parsed = schema.safeParse(options)
    if (parsed.error) {
        Object.entries(parsed.error.format()).forEach(([k, val]) => {
            if (k.startsWith("_")) {
                return;
            }
            logError(k, flatten(Object.values(val)).join(";"))
        })
        process.exit(0)
    }
    return parsed.data! as z.infer<typeof schema>;
}

export const getCommandInputDeclarationCode = (data: any): string => {
    let entries: string[] = []
    for (const [k, val] of Object.entries(data)) {
        if (k === 'force') {
            continue;
        }
        entries.push(`const $${k} = ${JSON.stringify(val)};`)
    }
    return `
/*
command inputs
*/
${entries.join("\n")}`;
}
