#!/usr/bin/env tsx

// BEFORE RUN: install tsx with `npm i -g tsx` // read: https://tsx.is/

import path from "node:path";
import fs from 'node:fs'
import {parseAllDocuments} from "yaml";
import get from "lodash/get";
import * as process from "node:process";
import {logError} from "@/util/logger";
import {appendContent} from "@/util/pathUtils";
import {typeToValue} from "@/util/typeToValue";

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
            appendContent(
                path.resolve(`${outDirPath}/defaults/${fName}.ts`),
                `
import {${sName}} from "../models/${sName}"

type INData = ${sName}['data'];

export const ${fName}: INData = ${JSON.stringify(defaultsValues, null, 4)}
`,
            )
        })
    }

}