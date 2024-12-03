import {useEffect, useState} from "react";
import {Configuration, ConfigurationParameters} from "../";
import {getAuth} from "firebase/auth";

export const useConfiguration = (configParams?: ConfigurationParameters) => {
    const [conf, setConf] = useState<Configuration>()
    useEffect(() => {
        const conf = new Configuration(
            {
                accessToken: () => getAuth().currentUser?.getIdToken() || Promise.resolve(""),
                ...configParams,
                ...{
                    basePath: process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        ? process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        : undefined
                }
            }
        )
        setConf(conf)
    }, [])

    return conf;
}