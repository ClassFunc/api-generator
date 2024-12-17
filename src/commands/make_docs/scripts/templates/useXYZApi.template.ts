import {useEffect, useState} from "react";
import {ConfigurationParameters, GreetingApi} from "../";
import {useConfiguration} from "./_useConfiguration";
import {getAuth} from "firebase/auth";

export interface ApiConfigOptions {
    useCachedValue?: boolean;
}

const useGreetingApi = (
    configParams?: ConfigurationParameters,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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