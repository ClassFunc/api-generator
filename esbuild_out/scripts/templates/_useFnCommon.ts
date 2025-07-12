import {ReactNode, useEffect, useMemo, useRef} from "react";
// @ts-ignore
import {ConfigurationParameters} from "../";
import {clone, differenceWith, forEach, has, isEmpty, isEqual, isObject, isPlainObject, set} from "lodash";

// types
export type Unpacked<T> =
    T extends (infer U)[] ? U :
        T extends (...args: never[]) => infer U ? U :
            T;

export interface ApiConfigOptions {
    useCachedValue?: boolean;
}

export interface ApiConfigParamsProps {
    apiConfigParams?: ConfigurationParameters;
    apiConfigOptions?: ApiConfigOptions;
}

//helpers
export function errorToast(msg: string | Error, description?: string | ReactNode) {
    try {
        import("sonner").then(({toast}) => {
            if (msg instanceof Error)
                msg = msg.message;

            toast.error(msg, {
                description,
                position: "bottom-center",
                duration: 3000,
            });
            console.error(msg, description);
        });
    } catch (e: unknown) {
    }
}

export function usePrevious(value: unknown) {
    // create a new reference
    const ref = useRef<typeof value>(null);

    // store current value in ref
    useEffect(() => {
        ref.current = value;
    }, [value]); // only re-run if value changes

    // return previous value (happens before update in useEffect above)
    return ref.current;
}

export function logDev(...value: unknown[]) {
    if (process.env.NEXT_PUBLIC_APP_ENV === "development") {
        console.log(...value);
    }
}

export function trimDataOnStream(text: string): string {
    text = text.trim();
    if (text.startsWith("data:")) {
        text = text.replace("data:", "");
    }
    return text;
}

export function useDeepCompareMemo(factory: any,
                                   dependencies: any[],
                                   logDiff = false,
                                   groupName = ""
) {
    const dependenciesRef = useRef<any[]>([]);

    if (logDiff) {
        const oldValues = clone(dependenciesRef.current);
        const newValues = clone(dependencies);
        const diffs = differenceWith(newValues, oldValues, isEqual);
        const now = new Date()
        const ts = now.getSeconds() + "." + now.getMilliseconds()
        let objectDiff;
        if (diffs.length === 1 && isPlainObject(diffs[0])) {
            objectDiff = getObjectDiff(
                oldValues[0],
                newValues[0],
            )
        }
        if (diffs.length > 0) {
            console.group(`${ts} ${groupName} > [useDeepCompareMemo]`)
            console.log("🟡 CHANGED:")
            console.log(
                // "[useDeepCompareMemo]:\n",
                `- old:`, oldValues, `${oldValues.length} items\n`,
                `+ new:`, newValues, `${newValues.length} items\n`,
                "=> diffs (new->old):", diffs, ` ${diffs.length} items\n`,
                "==> first objectDiffs:", objectDiff,
            )
            console.groupEnd();
        } else {
            // console.log("✅ NO CHANGED:")
        }
    }

    if (!isEqual(dependenciesRef.current, dependencies)) {
        dependenciesRef.current = dependencies;
    }

    return useMemo(factory, dependenciesRef.current) as any;
}

/* transform dotKeyObject to RawObject
example:
const sourceObject = {
  'user.name': 'barney',
  'user.age': 40,
  'active': true
};
->TO
{
    "user": {
        "name": "barney",
        "age": 40
    },
    "active": true
}
* */

export function transformDotKeyObjectToRawObject(source: any) {

    // 1. Create an empty object for the result.
    const result = {};

    // 2. Iterate over the source object.
    forEach(source, (value, key) => {
        // 3. For each key-value pair, use _.set to place it in the result object.
        //    Lodash will parse the dot-notation key as a path.
        set(result, key, value);
    });
    return result;
}

export function calledFunction(): string {
    const stack = new Error().stack;
    // The stack trace will vary slightly by browser, but usually contains function names.
    // You'd need to parse this string.
    // Example of parsing (highly dependent on environment):
    if (!stack)
        return '[calledFunction] no name';
    const lines = stack.split('\n');
    if (lines.length > 2) {
        // line 0: Error
        // line 1: at calledFunction (...)
        // line 2: at callerFunction (...)
        const callerLine = lines[2];
        const match = callerLine.match(/at\s+([^\s]+)/);
        if (match && match[1]) {
            return match[1]
        }
    }
    return '[calledFunction] no name';
}

function getObjectDiff(obj1: any, obj2: any) {
    const diff = {} as Record<string, any>;

    // Find properties in obj1 that are different or missing in obj2
    forEach(obj1, (value, key) => {
        if (!has(obj2, key)) {
            diff[key] = {
                oldValue: value,
                newValue: undefined
            };
        } else if (!isEqual(value, obj2[key])) {
            if (isObject(value) && isObject(obj2[key])) {
                // Recursively find differences for nested objects
                const nestedDiff = getObjectDiff(value, obj2[key]);
                if (!isEmpty(nestedDiff)) {
                    diff[key] = nestedDiff;
                }
            } else {
                diff[key] = {
                    oldValue: value,
                    newValue: obj2[key]
                };
            }
        }
    });

    // Find properties in obj2 that are missing in obj1
    forEach(obj2, (value, key) => {
        if (!has(obj1, key)) {
            diff[key] = {
                oldValue: undefined,
                newValue: value
            };
        }
    });

    return diff;
}