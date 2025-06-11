// @ts-nocheck

import {ReactNode, useEffect, useMemo, useRef} from "react";
import {ConfigurationParameters} from "../";
import isEqual from "lodash/isEqual";

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
    const ref = useRef<typeof value>();

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

export function useDeepCompareMemo(factory, dependencies) {
    const dependenciesRef = useRef();

    if (!isEqual(dependenciesRef.current, dependencies)) {
        dependenciesRef.current = dependencies;
    }

    return useMemo(factory, dependenciesRef.current);
}