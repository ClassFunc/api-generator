// @ts-nocheck
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import useGreetingApi from "./useGreetingApi"
import {get, isEqual, isPlainObject, omit} from 'lodash'

import {GreetingIN, GreetingOUT, ResponseError} from "../"
import {atom, useAtom, useAtomValue} from "jotai";
import {useResetAtom} from "jotai/utils";
import {
    ApiConfigParamsProps,
    errorToast,
    logDev,
    trimDataOnStream,
    Unpacked,
    useDeepCompareMemo,
    usePrevious
} from "./_useFnCommon";

type INData = Unpacked<GreetingIN['data']>
type OUTResult = Unpacked<GreetingOUT['result']>
export type OUTResultMaybeData = OUTResult extends { data: infer U }
    ? U
    : OUTResult
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
    fireIf?: (data?: INData) => boolean;
    fireEffectDeps?: Array<any>;
    cachedResponseStoreValuesFilter?: {
        path?: string;
        fn: (item: any) => boolean;
    };
    abortAble?: boolean;
}

type IGreetingResponseAtom = Record<string, GreetingOUT>;

export const greetingOUTStoreAtom = atom<IGreetingResponseAtom>({})
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
        fireIf,
        fireEffectDeps,
        cachedResponseStoreValuesFilter,
        abortAble = true,
    }: Props
) => {
    const {api} = useGreetingApi(apiConfigParams, apiConfigOptions);
    const [_inData, setInData] = useAtom<INData | undefined>(useDeepCompareMemo(()=>atom(inData),[inData]));
    const [response, setResponse] = useAtom<GreetingOUT>(lastGreetingOUTAtom)
    const resetResponse = useResetAtom(lastGreetingOUTAtom)
    const [streamResponseStore, setStreamResponseStore] = useState<any[]>([])
    const [greetingOUTStore, setGreetingOUTStore] = useAtom(greetingOUTStoreAtom)
    const [loading, setLoading] = useState<boolean>(false)
    const prevResponse = usePrevious(response);

    const abortControllerRef = useRef<AbortController | null>(null);
    // Ref để lưu trữ inData của request đang được theo dõi bởi abortControllerRef
    const activeRequestInDataRef = useRef<INData | undefined | null>(null);


    const memoStream = useAtomValue(
        useMemo(
            () => {
                return atom(stream)
            },
            [stream]
        )
    )
    const prevFireEffectDepsAtom = usePrevious(fireEffectDeps);
    const [fireEffectDepsChanged, setFireEffectDepsChanged] = useAtom(
        useDeepCompareMemo(
            () => {
                const isChanged = !isEqual(prevFireEffectDepsAtom, fireEffectDeps)
                return atom(isChanged);
            }, [fireEffectDeps, prevFireEffectDepsAtom]
        )
    )
    useEffect(() => {
        if (!api)
            return;
        if (fireEffectDepsChanged) {
            fire(_inData).then();
            setFireEffectDepsChanged(false);
        }
    }, [fireEffectDepsChanged, api, _inData])

    const cachedKey = (__inData: any) => {
        return "/greetingPost;in=" + JSON.stringify(__inData)
    }

    useEffect(
        () => {
            if (!api)
                return;

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

    const fire = async (inDataParam?: INData) => {
        const currentCallInData: INData | undefined = inDataParam ?? _inData;

        let localAbortController: AbortController | null = null;
        let localSignal: AbortSignal | undefined = undefined;

        if (abortAble) {
            // Kiểm tra nếu có request đang active và inData của nó giống với request hiện tại
            if (abortControllerRef.current && isEqual(activeRequestInDataRef.current, currentCallInData)) {
                logDev("Aborting previous request with identical inData:", activeRequestInDataRef.current);
                abortControllerRef.current.abort();
                // abortControllerRef.current và activeRequestInDataRef.current sẽ được dọn dẹp
                // bởi finally của request bị abort nếu nó là request đang active,
                // hoặc sẽ được ghi đè bởi request mới này.
            } else if (abortControllerRef.current) {
                logDev("New request with different inData. Previous active request (inData:", activeRequestInDataRef.current, ") continues. New request inData:", currentCallInData);
            }

            // Tạo AbortController mới cho request hiện tại
            localAbortController = new AbortController();
            localSignal = localAbortController.signal;

            // Request hiện tại trở thành request "có thể abort" chính
            abortControllerRef.current = localAbortController;
            activeRequestInDataRef.current = currentCallInData;
        }


        try {
            console.group("🔥 /greeting")
            setLoading(true);
            if (!api) {
                setLoading(false)
                console.error(`greetingApi is undefined`)
                console.groupEnd()
                return;
            }

            // currentInData đã được xác định là currentCallInData ở trên
            // if (!currentCallInData) { // Không cần nữa
            //     currentCallInData = _inData;
            // }

            if (fireIf && !fireIf(currentCallInData)) {
                return;
            }

            logDev("🚀", currentCallInData)

            if (abortAble && localSignal?.aborted) {
                logDev("Request aborted before sending for inData:", currentCallInData);
                return;
            }

            const greetingResponse = await api.greetingPostRaw(
                {
                    greetingIN: {
                        data: currentCallInData!,
                    },
                    stream: !!memoStream,
                },
                {
                    signal: abortAble ? localSignal : undefined,
                }
            );

            if (abortAble && localSignal?.aborted) {
                logDev("Request aborted after receiving headers for inData:", currentCallInData);
                return;
            }

            switch (greetingResponse.raw.status) {
                case 200:
                    if (memoStream) {
                        const contentType = greetingResponse.raw.headers.get('content-type');
                        if (contentType && contentType.includes('text/')) {
                            const reader = greetingResponse.raw.body?.getReader();
                            const textDecoder = new TextDecoder();
                            if (!reader) {
                                errorToast("error: greetingResponse.raw.body?.getReader() is null")
                                return;
                            }

                            const readChunk = async () => {
                                try {
                                    if (abortAble && localSignal?.aborted) {
                                        logDev("Stream reading aborted by signal for inData:", currentCallInData);
                                        if (typeof reader.cancel === 'function') {
                                            await reader.cancel("Aborted by user");
                                        }
                                        return;
                                    }

                                    const {done, value} = await reader.read();
                                    if (done) {
                                        if (abortAble && localSignal?.aborted) logDev("Stream finished for inData:", currentCallInData, ", but signal was aborted.");
                                        return;
                                    }
                                    if (abortAble && localSignal?.aborted) {
                                        logDev("Stream reading aborted by signal after read() for inData:", currentCallInData);
                                        return;
                                    }

                                    let chunkText = textDecoder.decode(value, {stream: true}).trim();
                                    if (!chunkText) {
                                        return;
                                    }
                                    try {
                                        chunkText = trimDataOnStream(chunkText)
                                        const j = JSON.parse(chunkText);
                                        setStreamResponseStore(prev => [...prev, j])
                                    } catch (e: any) {
                                        const lastChunks = chunkText.split(/\r\n|\n|\r/g)
                                        logDev({lastChunks})
                                        for (let c of lastChunks) {
                                            c = c.trim();
                                            if (!c) {
                                                continue;
                                            }
                                            try {
                                                const jString = trimDataOnStream(c);
                                                logDev("trying parse:", jString)
                                                let data
                                                try {
                                                    data = JSON.parse(jString)
                                                } catch (e: unknown) {
                                                    // Ignore
                                                }
                                                if (!data) {
                                                    continue
                                                }
                                                setStreamResponseStore(prev => [...prev, data])
                                            } catch (e: any) {
                                                logDev(e.message)
                                            }
                                        }
                                    }
                                    await readChunk();
                                } catch (e: any) {
                                    if (abortAble && (e.name === 'AbortError' || localSignal?.aborted)) {
                                        logDev("Stream reading aborted for inData:", currentCallInData, "Error:", e.message);
                                    } else {
                                        logDev("Error reading stream chunk for inData:", currentCallInData, "Error:", e);
                                    }
                                }
                            }

                            await readChunk()
                            if (abortAble && localSignal?.aborted) {
                                logDev("Stream processing loop finished due to abort for inData:", currentCallInData);
                                return;
                            }
                            setTimeout(
                                () => {
                                    if (!abortAble || (abortAble && !localSignal?.aborted)) {
                                        logDev("Reset streamResponseStore for inData:", currentCallInData)
                                        setStreamResponseStore(() => [])
                                    } else {
                                        logDev("Stream was aborted for inData:", currentCallInData, ", not resetting streamResponseStore via timeout.")
                                    }
                                }, 1000
                            )
                            return;
                        }
                    } else {
                        if (abortAble && localSignal?.aborted) {
                            logDev("Request aborted before reading non-streamed value for inData:", currentCallInData);
                            return;
                        }
                        const v = await greetingResponse.value()
                        if (abortAble && localSignal?.aborted) {
                            logDev("Request aborted during/after reading non-streamed value for inData:", currentCallInData);
                            return;
                        }
                        setResponse(v)
                        if (useCachedResponse) {
                            setGreetingOUTStore(pre => (
                                {
                                    ...pre,
                                    [cachedKey(currentCallInData)]: v
                                }
                            ))
                        }
                        logDev("✅", v)
                        return v;
                    }
                    break;
                case 204:
                    return null;
                default:
                    if (abortAble && localSignal?.aborted) {
                        logDev("Request aborted before reading error value for inData:", currentCallInData);
                        return;
                    }
                    return await greetingResponse.value();
            }

        } catch (e: any) {
            if (abortAble && (e.name === 'AbortError' || (localSignal && localSignal.aborted))) {
                logDev("Fetch operation aborted for inData:", currentCallInData, "Error:", e.message);
            } else {
                e = e as ResponseError
                if (useCachedResponse) {
                    setGreetingOUTStore(pre => omit(pre, [cachedKey(currentCallInData)]))
                }
                console.error(e)
                const {response: errorResponse} = e
                if (!errorResponse) {
                    errorToast(`no response:`, e.message)
                    return;
                }
                const serror = (await errorResponse?.json())?.error;
                errorToast(
                    `call api \`greetingPost\` error: ${errorResponse.status} (${get(serror, 'status')})`,
                    <pre>{get(serror, 'message')}</pre>
                )
                throw e;
            }
        } finally {
            setLoading(false)
            if (abortAble && localAbortController) {
                // Nếu AbortController của *request này* vẫn là controller đang active trong ref,
                // có nghĩa là request này đã hoàn thành (hoặc bị abort) và nó là request cuối cùng set ref.
                // Vậy nên, dọn dẹp global refs.
                if (abortControllerRef.current === localAbortController) {
                    abortControllerRef.current = null;
                    activeRequestInDataRef.current = null;
                    logDev("Cleared global abort refs for inData:", currentCallInData);
                } else {
                    logDev("Global abort refs were for a different/newer request. Not clearing for inData:", currentCallInData);
                }
            }
            console.groupEnd()
        }
    }

    const abort = useCallback(() => {
        if (abortAble && abortControllerRef.current) {
            logDev("User explicitly called abort(). Aborting request with inData:", activeRequestInDataRef.current);
            abortControllerRef.current.abort();
            // Khối finally của hàm fire() tương ứng sẽ xử lý việc dọn dẹp abortControllerRef và activeRequestInDataRef
        } else if (!abortAble) {
            logDev("abort() called, but abortAble is false. No action taken.");
        }
    }, [abortAble]);


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
        [response, loading, CustomOUTComponent, LoadingComponent, EmptyComponent]
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
        [response, loading, CustomResultComponent, LoadingComponent, EmptyComponent]
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
        [response, loading, CustomDataComponent, LoadingComponent, EmptyComponent]
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
                                <div className={dataItemClassName ?? ""} key={get(item, 'id', `noID-${index}`)}>
                                    {JSON.stringify(item, null, 4)}
                                </div>
                            )
                        })
                    }
                </div>
            )
        },
        [response, loading, CustomDataItemComponent, mainClassName, dataItemClassName, LoadingComponent, EmptyComponent]
    )

    const cachedResponse = useMemo(() => {
        const keyLookup = _inData !== undefined ? _inData : inData;
        return greetingOUTStore[cachedKey(keyLookup)];
    }, [greetingOUTStore, _inData, inData])

    const responseSWR = useMemo(
        () => {
            return cachedResponse || response;
        },
        [cachedResponse, response]
    )

    const cachedResponseStoreFilteredValues: any[] = useDeepCompareMemo(
        () => {
            if (!greetingOUTStore || !cachedResponseStoreValuesFilter) {
                return []
            }
            const filterPath = cachedResponseStoreValuesFilter.path || 'result.data'
            return Object.values(greetingOUTStore)
                .flatMap(r => get(r, filterPath))
                .filter(cachedResponseStoreValuesFilter.fn)
        },
        [greetingOUTStore]
    )

    return {
        response,
        responseSWR,
        resetResponse,
        streamResponseStore,
        isResponseChanged,
        fire,
        postAction: fire,
        abort,
        setInData,
        loading,
        api,
        cachedResponseStore: greetingOUTStore,
        cachedResponseStoreFilteredValues,
        cachedResponse,
        DataItemComponent,
        DataComponent,
        ResultComponent,
        OUTComponent,
        cachedKey
    }
}