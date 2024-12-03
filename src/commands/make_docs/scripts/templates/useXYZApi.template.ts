import {useEffect, useState} from "react";
import {ConfigurationParameters, GreetingApi} from "../";
import {useConfiguration} from "./_useConfiguration";
import {getAuth} from "firebase/auth";

export interface ApiConfigOptions {
    useCachedValue?: boolean;
}

const useGreetingApi = (
    configParams?: ConfigurationParameters,
    options?: ApiConfigOptions
) => {
    const conf = useConfiguration({
        ...configParams,
    })
    const user = getAuth().currentUser
    const [value, setValue] = useState<GreetingApi>()
    useEffect(() => {
        if (!user || !conf)
            return;
        setValue(new GreetingApi(conf))
    }, [user, conf])

    return {api: value, apiConf: conf};
}

export default useGreetingApi;