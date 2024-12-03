import React, {useCallback, useEffect, useMemo, useState} from "react";
import useGreetingApi from "./useGreetingApi"
import {get, isEqual, isPlainObject, omit} from 'lodash'

import {GreetingIN, GreetingOUT, ResponseError} from "../"
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
                errorToast(`greetingApi is undefined`)
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
                                        const lastChunks = chunkText.split(/\r\n|\n|\r/g)
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
                errorToast(`no response:`, e.message)
                return;
            }
            const serror = (await response?.json())?.error;
            errorToast(
                `call api \`greetingPost\` error: ${response.status} (${get(serror, 'status')})`,
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
}