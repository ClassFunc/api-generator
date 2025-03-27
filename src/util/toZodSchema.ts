import {jsonSchemaToZod} from "json-schema-to-zod";

export const toZodSchema = (jsonSchema: any) => {

    return jsonSchemaToZod(jsonSchema)
}