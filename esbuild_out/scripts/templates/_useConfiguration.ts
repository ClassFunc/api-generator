import { useEffect, useState } from "react";
import { Configuration, ConfigurationParameters } from "../";

export const useConfiguration = (configParams?: ConfigurationParameters) => {
    const [conf, setConf] = useState<Configuration>();
    useEffect(() => {
        const conf = new Configuration(
            {
                accessToken: new Promise((resolve) => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        import("firebase/auth").then(({ getAuth }) => {
                            const idToken = getAuth().currentUser?.getIdToken();
                            resolve(idToken);
                        });
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (e: unknown) {
                        resolve("");
                    }
                }),
                ...configParams,
                ...{
                    basePath: process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        ? process.env.NEXT_PUBLIC_DEV_API_BASE_URL
                        : undefined,
                },
            },
        );
        setConf(conf);
    }, []);

    return conf;
};