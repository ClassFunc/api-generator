import {useEffect, useState} from "react";
// @ts-ignore
import {Configuration, ConfigurationParameters} from "../";
import {getAuth} from 'firebase/auth'

export const useConfiguration = (configParams?: ConfigurationParameters) => {
    const [conf, setConf] = useState<Configuration>();
    useEffect(() => {
        const conf = new Configuration(
            {
                accessToken: getAuth().currentUser?.getIdToken(),
                ...{
                    basePath: process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        ? process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        : undefined,
                },
                ...configParams,
            },
        );
        setConf(conf);
    }, []);

    return conf;
};