import {ReactNode, useEffect, useRef} from "react";
import {isError} from "lodash";
import {toast} from "sonner";
import {ConfigurationParameters} from "../";

// types
export type Unpacked<T> =
    T extends (infer U)[] ? U :
        T extends (...args: any[]) => infer U ? U :
            T;

export interface ApiConfigOptions {
    useCachedValue?: boolean;
}

export interface ApiConfigParamsProps {
    apiConfigParams?: ConfigurationParameters
    apiConfigOptions?: ApiConfigOptions
}

//helpers
export function errorToast(msg: string | Error, description?: string | ReactNode) {
    if (isError(msg))
        msg = msg.message;

    toast.error(msg, {
        description,
        position: 'bottom-center',
        duration: 3000
    })
    console.error(msg, description)
}

export function usePrevious(value: any) {
    // create a new reference
    const ref = useRef();

    // store current value in ref
    useEffect(() => {
        ref.current = value;
    }, [value]); // only re-run if value changes

    // return previous value (happens before update in useEffect above)
    return ref.current;
}

export function logDev(...value: any) {
    if (process.env.NEXT_PUBLIC_APP_ENV === "development") {
        console.log(...value)
    }
}

export function trimDataOnStream(text: string): string {
    text = text.trim()
    if (text.startsWith('data:')) {
        text = text.replace("data:", '')
    }
    return text;
}