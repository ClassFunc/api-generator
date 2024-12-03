import {z} from "zod";
import {GlobalCommandInputSchema} from "@/types/GlobalCommandInputSchema";
import {getCommandInputDeclarationCode, getParsedData,} from "@/util/commandParser";
import {last} from "lodash";
import {logDone, logError} from "@/util/logger";
import * as process from "node:process";
import path from "node:path";
import {execSync} from "node:child_process";
import {copyFileSync} from "node:fs";
import {makeDir} from "@/util/pathUtils";

const CommandInputSchema = GlobalCommandInputSchema.extend({
    // from commander;
    inputYaml: z.string(),
    outDir: z.string(),
    name: z.string().optional(),
    genDefaults: z.boolean().optional().default(false),
});

type ICommandInput = z.infer<typeof CommandInputSchema>;
let commandInputDeclarationCode = "";

export function make_docs() {
    const data = getParsedData(arguments, CommandInputSchema);
    commandInputDeclarationCode = getCommandInputDeclarationCode(data);
    const code = get_code(data);
    // implementations

    //"docs:api:gen": "rm -fr app/docs/api && curl https://docs.akasach.io/api.yaml -o app/docs/api.yaml && npx @openapitools/openapi-generator-cli generate -i app/docs/api.yaml --generator-name typescript-fetch -o app/docs/api && yarn run docs:uses:gen api",
    //"docs:uses:gen": "app/docs/__generators__/scripts/generateUses.script.ts",
    //"docs:defaults:gen": "app/docs/__generators__/scripts/writeINData_default.script.ts",
    const nameYaml = last(data.inputYaml.split('/')) || '';
    const name = data.name || nameYaml.split('.')?.[0];
    if (!name) {
        logError(new Error(`can not get name`))
        process.exit(1)
    }
    const outDirFull = path.join(data.outDir, name)
//     remove old
    execSync(`rm -fr ${outDirFull}`);
//     download or copy .yaml to outDir
    const yamlDestPath = path.join(data.outDir, nameYaml);
    makeDir(data.outDir)
    if (data.inputYaml.startsWith(`https`)) {
        execSync(`curl ${data.inputYaml} -o ${yamlDestPath}`)
    } else {
        copyFileSync(data.inputYaml, yamlDestPath)
    }
    // base generator
    execSync(`npx @openapitools/openapi-generator-cli generate -i ${yamlDestPath} --generator-name typescript-fetch -o ${outDirFull}`)
    logDone(`openapi-generator:`, outDirFull);
// generate uses
    execSync(`npx tsx ${__dirname}/scripts/generateUses.script.ts ${outDirFull}`)
    logDone(`generated uses`, outDirFull + `/uses`)
//     generate defaults
}

function get_code(data: ICommandInput) {
    // work with input

    return `
${commandInputDeclarationCode}

// other codes...
`;
}

const _useConfigurationTs_code = (data: ICommandInput, outDirFull: string) => {
    return `
import {useEffect, useState} from "react";
import {Configuration, ConfigurationParameters} from "@/${outDirFull}";
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
    `
}


const _useFnCommonTs_code = (data: ICommandInput, outDirFull: string) => {
    return String.raw`
import {ReactNode, useEffect, useRef} from "react";
import {isError} from "lodash";
import {toast} from "sonner";
import {ConfigurationParameters} from "@/${outDirFull}";

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
}`
}

const useFnTemplateTs_code = (data: ICommandInput, outDirFull: string) => {
    return `
import React, {useCallback, useEffect, useMemo, useState} from "react";
import useGreetingApi from "@/${outDirFull}/useGreetingApi"
import {get, isEqual, isPlainObject, omit} from 'lodash'

import {GreetingIN, GreetingOUT, ResponseError} from "@/app/docs/api"
import {atom, useAtom, useAtomValue} from "jotai";
import {ApiConfigParamsProps, errorToast, logDev, trimDataOnStream, Unpacked, usePrevious} from "./_useFnCommon";

type INData = Unpacked<GreetingIN['data']>
type OUTResult = Unpacked<GreetingOUT['result']>
export type OUTResultMaybeData = OUTResult extends { data: infer U }
    ? U // If 'data' exists, extract its type (U)
    : OUTResult // If 'data' doesn't exist, use the 'result' type itself
export type OUTResultMaybeDataItem = Unpacked<OUTResultMaybeData>

function valueOfOUTResultMaybeData(result: unknown): OUTResultMaybeData | OUTResult | null {
    if (!result)
        return null;
    return (isPlainObject(result) && get(result, "data")) ? get(result, 'data')! as OUTResultMaybeData : result as OUTResult
}

interface ResultDataInnerComponentProps {
    mainClassName?: string;
    dataItemClassName?: string;
    CustomDataItemComponent?: (item: OUTResultMaybeDataItem, index: number) => React.ReactNode;
    CustomDataComponent?: (data: OUTResultMaybeData) => React.ReactNode;
    CustomResultComponent?: (result: OUTResult) => React.ReactNode;
    CustomOUTComponent?: (out: GreetingOUT) => React.ReactNode;
    LoadingComponent?: () => React.ReactNode;
    EmptyComponent?: () => React.ReactNode;
}


interface Props extends ResultDataInnerComponentProps, ApiConfigParamsProps {
    inData?: INData;
    stream?: boolean;
    streamCallback?: (streamStore: any[]) => any;
    fireImmediately?: boolean;
    useCachedResponse?: boolean;
}

type IGreetingResponeAtom = Record<string, GreetingOUT>;

export const greetingOUTStoreAtom = atom<IGreetingResponeAtom>({})
export const lastGreetingOUTAtom = atom<GreetingOUT | null>(null)

export const useGreetingPost = (
    {
        inData,
        mainClassName,
        dataItemClassName,
        CustomDataItemComponent,
        CustomDataComponent,
        CustomResultComponent,
        CustomOUTComponent,
        LoadingComponent,
        EmptyComponent,
        apiConfigParams,
        apiConfigOptions,
        stream = false,
        streamCallback,
        fireImmediately = undefined,
        useCachedResponse = true,
    }: Props
) => {
    const {api} = useGreetingApi(apiConfigParams, apiConfigOptions);
    const [_inData, setInData] = useState<INData | undefined>(inData)
    const [response, setResponse] = useAtom(lastGreetingOUTAtom)
    const [streamResponseStore, setStreamResponseStore] = useState<any[]>([])
    const [greetingOUTStore, setGreetingOUTStore] = useAtom(greetingOUTStoreAtom)
    const [loading, setLoading] = useState<boolean>(false)
    const prevResponse = usePrevious(response);
    const memoStream = useAtomValue(
        useMemo(
            () => {
                return atom(stream)
            },
            [stream]
        )
    )

    const cachedKey = (__inData: any) => {
        return "/greetingPost;in=" + JSON.stringify(__inData)
    }

    useEffect(
        () => {
            if (!api)
                return;

            // automatically fire if _inData is set.
            if (_inData && typeof fireImmediately === "undefined") {
                fire(_inData).then()
                return;
            }

            if (fireImmediately) {
                fire(_inData).then()
            }
        },
        [fireImmediately, api, _inData]
    )

    const isResponseChanged = useMemo(
        () => {
            return !isEqual(response, prevResponse)
        },
        [response, prevResponse]
    )

    useEffect(
        () => {
            if (!streamCallback || !streamResponseStore)
                return;
            streamCallback(streamResponseStore)
        },
        [streamCallback, streamResponseStore]
    )

    const fire = async (inData?: INData) => {
        if (loading) {
            return;
        }
        try {
            console.group("🔥 /greeting")
            setLoading(true);
            if (!api) {
                setLoading(false)
                errorToast(\`greetingApi is undefined\`)
                console.groupEnd()
                return;
            }

            if (!inData) {
                // use last saved inData
                inData = _inData;
            }

            logDev("↙️", inData)

            const greetingResponse = await api.greetingPostRaw(
                {
                    greetingIN: {
                        data: inData!,
                    },
                    ...{stream: !!memoStream}
                }
            );

            switch (greetingResponse.raw.status) {
                case 200:
                    if (memoStream) {
                        const contentType = greetingResponse.raw.headers.get('content-type');
                        if (contentType && contentType.includes('text/')) {// text/plain or text/event-stream
                            const reader = greetingResponse.raw.body?.getReader();
                            const textDecoder = new TextDecoder();
                            if (!reader) {
                                errorToast("error: greetingResponse.raw.body?.getReader() is null")
                                return;
                            }

                            // readChunks
                            const readChunk = async () => {
                                try {
                                    const {done, value} = await reader.read();
                                    if (done) {
                                        return;
                                    }
                                    let chunkText = textDecoder.decode(value, {stream: true}).trim();
                                    if (!chunkText) {
                                        return;
                                    }
                                    try {
                                        chunkText = trimDataOnStream(chunkText)
                                        // console.log({chunkText})
                                        const j = JSON.parse(chunkText);
                                        setStreamResponseStore(prev => [...prev, j])
                                    } catch (e: any) {
                                        const lastChunks = chunkText.split(/\\r\\n|\\n|\\r/g)
                                        logDev({lastChunks})
                                        for (let c of lastChunks) {
                                            c = c.trim();
                                            if (!c) {//case of empty string
                                                continue;
                                            }
                                            try {
                                                const jString = trimDataOnStream(c);
                                                logDev("trying parse:", jString)
                                                setStreamResponseStore(prev => [...prev, JSON.parse(jString)])
                                            } catch (e: any) {
                                                logDev(e.message)
                                            }
                                        }
                                    }

                                    await readChunk(); // đệ quy để đọc chunk tiếp theo.
                                } catch (e: any) {
                                    logDev(e)
                                }
                            }

                            await readChunk()
                            // END readChunks
                            // reset streamResponseStore
                            setTimeout(
                                () => {
                                    // reset stream data for next
                                    logDev("reset streamResponseStore")
                                    setStreamResponseStore(prev => [])
                                }, 1000
                            )

                            return;
                        }
                    } else {

                        const v = await greetingResponse.value()
                        setResponse(v)

                        // set cached response
                        if (useCachedResponse) {
                            setGreetingOUTStore(pre => (
                                {
                                    ...pre,
                                    [cachedKey(inData)]: v
                                }
                            ))
                        }
                        logDev("↘️", v)
                        return v;
                    }
                case 204:
                    return null;
                default:
                    return await greetingResponse.value();
            }

        } catch (e: any) {
            e = e as ResponseError
            if (useCachedResponse) {
                setGreetingOUTStore(pre => omit(pre, [cachedKey(inData)]))
            }
            console.error(e)
            const {response} = e
            if (!response) {
                errorToast(\`no response:\`, e.message)
                return;
            }
            const serror = (await response?.json())?.error;
            errorToast(
                \`call api "greetingPost" error: \${response.status} (\${get(serror, 'status')})\`,
                <pre>{get(serror, 'message')}</pre>
            )
            throw e;
        } finally {
            setLoading(false)
            console.groupEnd()
        }
    }

    const OUTComponent = useCallback(
        () => {
            if (!CustomOUTComponent)
                return null;

            if (loading || !response)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = response;
            if (!data) {
                return EmptyComponent ? <EmptyComponent/> : <div>(data is empty)</div>;
            }
            return CustomOUTComponent(data)
        },
        [response, loading, CustomOUTComponent]
    )

    const ResultComponent = useCallback(
        () => {
            if (!CustomResultComponent)
                return null;

            if (loading || !response)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = response?.result;
            if (!data) {
                return EmptyComponent ? <EmptyComponent/> : <div>(data is empty)</div>;
            }
            return CustomResultComponent(data as unknown as OUTResult)
        },
        [response, loading, CustomResultComponent]
    )

    const DataComponent = useCallback(
        () => {
            if (!CustomDataComponent)
                return null;

            if (loading || !response)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = valueOfOUTResultMaybeData(response?.result);
            if (!data) {
                return EmptyComponent ? <EmptyComponent/> : <div>(data is empty)</div>;
            }
            return CustomDataComponent(data as unknown as OUTResultMaybeData)
        },
        [response, loading, CustomDataComponent]
    )

    const DataItemComponent = useCallback(
        () => {
            if (!CustomDataItemComponent)
                return null;

            if (loading || !response)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = valueOfOUTResultMaybeData(response?.result);
            if (!data)
                return EmptyComponent ? <EmptyComponent/> : <div>(data is empty)</div>;

            if (!Array.isArray(data)) {
                return (
                    <div className={mainClassName ?? ""}>
                        <div className={"text-yellow-400"}>
                            data may not be an array:
                        </div>
                        <div>
                            {JSON.stringify(data, null, 4)}
                        </div>
                    </div>
                )
            }

            return (
                <div className={mainClassName ?? ""}>
                    {
                        data.map((item: OUTResultMaybeDataItem, index) => {
                            if (CustomDataItemComponent) {
                                return CustomDataItemComponent(item, index)
                            }
                            return (
                                // use item
                                <div className={dataItemClassName ?? ""} key={get(item, 'id', 'nokey')}>
                                    {JSON.stringify(item, null, 4)}
                                </div>
                            )
                        })
                    }
                </div>
            )
        },
        [response, loading, CustomDataItemComponent]
    )

    return {
        response,
        streamResponseStore,
        isResponseChanged,
        fire,
        postAction: fire,
        setInData,
        loading,
        api,
        cachedResponseStore: greetingOUTStore,
        DataItemComponent,
        DataComponent,
        ResultComponent,
        OUTComponent,
        cachedKey
    }
}`
}

const useXYZApiTemplateTs_code = (data: ICommandInput, outDirFull: string) => {
    return `
import {useEffect, useState} from "react";
import {ConfigurationParameters, GreetingApi} from "@/${outDirFull}";
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

export default useGreetingApi;`
}