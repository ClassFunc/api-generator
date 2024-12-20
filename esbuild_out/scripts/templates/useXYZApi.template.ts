// @ts-nocheck
import {useEffect, useState} from "react";
import {ConfigurationParameters, GreetingApi} from "../";
import {useConfiguration} from "./_useConfiguration";

export interface ApiConfigOptions {
    useCachedValue?: boolean;
}

const useGreetingApi = (
    configParams?: ConfigurationParameters,
    options?: ApiConfigOptions
) => {
    const conf = useConfiguration({
        ...configParams,
    });
    const [value, setValue] = useState<GreetingApi>();
    useEffect(() => {
        if (!conf)
            return;
        setValue(new GreetingApi(conf));
    }, [conf]);

    return {api: value, apiConf: conf};
}

export default useGreetingApi;