// @ts-nocheck
import {useEffect, useState} from "react";
import {Configuration, ConfigurationParameters} from "../";

export const useConfiguration = (configParams?: ConfigurationParameters) => {
    const [conf, setConf] = useState<Configuration>();
    useEffect(() => {
        const conf = new Configuration(
            {
                accessToken: new Promise((resolve) => {
                    try {
                        import("firebase/auth").then(({getAuth}) => {
                            const idToken = getAuth().currentUser?.getIdToken();
                            resolve(idToken);
                        });
                    } catch (e: unknown) {
                        resolve("");
                    }
                }),
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