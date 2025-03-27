#!/usr/bin/env tsx

// BEFORE RUN: install tsx with `npm i -g tsx` // read: https://tsx.is/

import path from "node:path";
import fs from 'node:fs'
import {parseAllDocuments} from "yaml";
import get from "lodash/get";
import * as process from "node:process";
import {logError} from "@/util/logger";
import {toZodSchema, toZodSchema2} from "@/util/toZodSchema";
import {appendContent} from "@/util/pathUtils";
import {execSync} from "node:child_process";
import {ZodObject, ZodRawShape, ZodTypeAny} from "zod";


export const writeZodSchemasScript = (
    outDirPath: string,
    yamlDestPath: string,
) => {
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

            if (!["IN", "OUT"].some(
                s => sName.endsWith(s)
            )) {
                return;
            }

            // stripe off suffix IN and OUT
            let cleanedSchemaName = sName;
            let schemaType = ''
            if (sName.endsWith("IN")) {
                cleanedSchemaName = sName.slice(0, -2);
                schemaType = 'IN'
            } else if (sName.endsWith("OUT")) {
                cleanedSchemaName = sName.slice(0, -3);
                schemaType = 'OUT'
            }

            const zodSchema = toZodSchema2(sVal);
            const zodSchemaString = toZodSchema(sVal);
            const defaultValues = getDefaultValues(zodSchema);
            // logInfo(`defaultValues of ${sName}`, defaultValues)

            let dataSchemaContent = ''
            if (sName.endsWith("IN")) {
                // Check if schema.shape.data is accessible
                if (zodSchema instanceof ZodObject && "data" in zodSchema.shape) {
                    dataSchemaContent = `
/* IN data Schema */
export const ${sName}Data_schema = ${sName}_schema.shape.data`;
                } else {
                    dataSchemaContent = ''
                    logError(`Schema ${sName} does not have a 'data' property in its shape.`);
                }
            }

            let resultSchemaContent = "";
            if (sName.endsWith("OUT")) {
                // Check if schema.shape.result is accessible
                if (zodSchema instanceof ZodObject && "result" in zodSchema.shape) {
                    resultSchemaContent = `
/* OUT result Schema*/
export const ${sName}Result_schema = ${sName}_schema.shape.result`;
                } else {
                    logError(`Schema ${sName} does not have a 'result' property in its shape.`);
                    // Optionally, you might want to skip writing this schema or handle it differently
                    // return; // Uncomment to skip writing this schema
                    resultSchemaContent = `
/* OUT result Schema - WARNING: 'result' property not found in schema shape */
// export const ${sName}Result_schema = ${sName}_schema.shape.result // This line is commented out because 'result' is not found`;
                }
            }

            appendContent(
                path.resolve(`${outDirPath}/zodSchemas/${cleanedSchemaName}_schema.ts`),
                `
import { z } from "zod";

/* ${schemaType} Schema */
export const ${sName}_schema = ${zodSchemaString}

${dataSchemaContent}

${resultSchemaContent}

${defaultValues ? `
/* ${schemaType} default values */
export const ${sName}_defaultValues = ${JSON.stringify(defaultValues, null, 2)}` : ""}

`
                , true
            )

        })
    }
    execSync(`npx prettier --write ${path.resolve(`${outDirPath}/zodSchemas`)}`)

}


// Helper function to extract default values from a Zod schema
function getDefaultValues(schema: ZodTypeAny): any {
    if (schema instanceof ZodObject) {
        const shape = schema.shape as ZodRawShape;
        const defaultValues: { [key: string]: any } = {};
        for (const key in shape) {
            const fieldSchema = shape[key];
            const defaultValue = getDefaultValues(fieldSchema);
            if (defaultValue !== undefined) {
                defaultValues[key] = defaultValue;
            }
        }
        return Object.keys(defaultValues).length > 0 ? defaultValues : undefined;
    } else if ("_def" in schema && "defaultValue" in schema._def) {
        return schema._def.defaultValue();
    } else if ("innerType" in schema._def) {
        return getDefaultValues(schema._def.innerType);
    } else if ("typeName" in schema._def && schema._def.typeName === "ZodOptional") {
        return undefined;
    } else if ("typeName" in schema._def && schema._def.typeName === "ZodDefault") {
        return schema._def.defaultValue();
    } else if ("typeName" in schema._def && schema._def.typeName === "ZodNullable") {
        return null;
    } else if ("typeName" in schema._def && schema._def.typeName === "ZodArray") {
        return [];
    } else if ("typeName" in schema._def && schema._def.typeName === "ZodEnum") {
        return schema._def.values[0];
    }
    return undefined;
}
