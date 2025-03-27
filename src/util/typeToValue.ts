import get from "lodash/get";

export function typeToValue(obj: any): any {
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
