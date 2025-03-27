import {jsonSchemaToZod} from "json-schema-to-zod";
import {jsonSchemaToZod as jsonSchemaToZod2} from "@n8n/json-schema-to-zod";

export const toZodSchema = (jsonSchema: any) => {

    return jsonSchemaToZod(jsonSchema)
}

export const toZodSchema2 = (jsonSchema: any) => {
    return jsonSchemaToZod2(jsonSchema)
}