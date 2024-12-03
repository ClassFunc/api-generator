#!/usr/bin/env tsx

// BEFORE RUN: install tsx with `npm i -g tsx` // read: https://tsx.is/

import path from "node:path";
import fs from 'node:fs'
import {parseAllDocuments} from "yaml";
import get from "lodash/get";
import * as process from "node:process";
import {logError} from "@/util/logger";

export const writeINData_defaultScript = (
    outDirPath: string,
    yamlDestPath: string,
    requiredOnly?: boolean
) => {
    requiredOnly ??= true;
    const yamlFile = path.resolve(yamlDestPath)
    if (!yamlFile) {
        logError(`no ${yamlFile} file`)
        process.exit();
    }

    const yValue = parseAllDocuments(fs.readFileSync(yamlFile).toString("utf-8"))
    for (const v of yValue) {
        const j = v.toJSON()
        const schemas = get(j, 'components.schemas')
        Object.keys(schemas).forEach(sName => {
            const sVal = schemas[sName]
            if (!sName.endsWith("IN")) {
                return;
            }
            const INDataProps = get(sVal, 'properties.data.properties');

            if (!INDataProps)
                return;
            const required = get(sVal, "properties.data.required");

            const fName = `${sName}Data_default`
            // console.log(`-- ${fName}`)
            // console.log("--- ", {required})

            const defaultsValues = {}
            // console.log(INDataProps)
            Object.keys(INDataProps).forEach(inKeyName => {
                if (requiredOnly && !required?.includes(inKeyName))
                    return;
                // @ts-ignore
                defaultsValues[inKeyName] = typeToValue(INDataProps[inKeyName]);
            })
            // console.log({fName, defaultsValues})

            // write items
            const defaultsDir = path.resolve(`${outDirPath}/defaults/`)
            fs.mkdirSync(defaultsDir, {recursive: true})
            const fPath = path.resolve(defaultsDir, `${fName}.ts`)
            fs.writeFileSync(
                fPath,
                `
import {${sName}} from "../models/${sName}"

type INData = ${sName}['data'];

export const ${fName}: INData = ${JSON.stringify(defaultsValues, null, 4)}
`,
            )
        })
    }

}

function typeToValue(obj: any): any {
    const type = get(obj, 'type')
    const anyOf = get(obj, 'anyOf')

    if (anyOf) {
        return typeToValue(anyOf[0])
    }
    if (!type) {
        return;
    }

    // console.log({type})
    // console.log(obj)
    let defaultValue = get(obj, 'default');
    switch (type) {
        case 'string':
            const enumValues = get(obj, 'enum')
            if (enumValues)
                defaultValue = enumValues[0];
            return defaultValue || ""
        case 'array':
            const items = get(obj, 'items')
            const itemsType = get(items, "type")
            // console.log({obj, itemsType})
            if (['integer', 'number'].includes(itemsType)) {
                return defaultValue
            }
            return [typeToValue(items)]
        case 'boolean':
            return defaultValue || false;
        case "integer":
        case "number":
            return defaultValue || 0;
        case 'object':

            // ONLY write requires properties;
            const requires = get(obj, 'required')
            // console.log({requires})
            const ret: Record<string, any> = {}
            if (requires?.length > 0) {
                for (const r of requires) {
                    // console.log({r, defaultValue})
                    const rValue = get(obj, `properties.${r}`)
                    // console.log(rValue)
                    // @ts-ignore
                    ret[r] = typeToValue(rValue);
                }
            }

            // IF need write default ALL Properties; comment-out this;
            // const ps = get(obj, 'properties')
            // if(!ps)
            //     return ret;
            // // console.log(ps)
            // Object.keys(ps).forEach(p => {
            //     ret[p] = typeToValue(ps[p])
            // })

            return ret;
    }
}
