import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
// @ts-ignore
import useGreetingApi from "./useGreetingApi"
import {filter, flatten, get, isEqual, isObject, isPlainObject, Many, merge, omit, orderBy, set, uniqBy} from 'lodash'
// @ts-ignore
import {GreetingIN, GreetingOUT, ResponseError} from "../"
import {atom, useAtom, useAtomValue} from "jotai";
import {atomWithReset, useResetAtom} from "jotai/utils"; // Đảm bảo đã import
import {
    ApiConfigParamsProps,
    calledFunction,
    errorToast,
    logDev,
    transformDotKeyObjectToRawObject,
    trimDataOnStream,
    Unpacked,
    useDeepCompareMemo,
    usePrevious
} from "./_useFnCommon";
import {InfinityScrollHereComponent, InfinityScrollHereProps} from "./InfinityScrollHereComponent";
import useInfiniteScroll from "react-infinite-scroll-hook";
import {InfinityLoading} from "./InfinityLoading";
import {DynamicForm, DynamicFormProps} from "./InputForm/InputForm"

// @ts-ignore
import {GreetingIN_defaultValues, GreetingINData_schema} from "../zodSchemas/Greeting_schema";
import {nativeComponentRegistry} from "./InputForm/nativeComponentRegistry";
/*
INData = IN['data'] = Map<string,any> | any
* */
type INData = GreetingIN['data']

/*
OUT = {result: Result}
* */
type OUT = GreetingOUT;

/*
Result = OUT['result'] = {count, length, data: any|Item[], pageToken,...}
* */
type OUTResult = GreetingOUT['result']
type Result = OUTResult;

/*
Data = OUT['result']['data'|'docs'] = Array<Item> | any;
* */
export type OUTResultMaybeData = OUTResult extends { data: infer U }
    ? U :
    OUTResult extends { docs: infer U2 }
        ? U2
        : any;

type Data = OUTResultMaybeData;

function valueOfData(result: unknown): OUTResultMaybeData | OUTResult | null {
    if (!result)
        return null;
    return get(result, "data") || get(result, "docs") || null
}

/*
Item = Unpacked<Data> = any
* */
export type OUTResultMaybeDataItem = Unpacked<Data>
export type Item = OUTResultMaybeDataItem;

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

type DataListConfig = {
    orderBy?: {
        iteratees: Many<keyof Item | ((value: Item) => any)>,
        orders?: Many<'asc' | 'desc'>
    };
    filter?: Record<keyof Item | string, any> | ((value: Item) => boolean) | string;
    uniqBy?: keyof Item | string;
}

type InfiniteScrollConfig = {
    scrollTo?: "bottom" | "top" | "right" | "left";
}

type FormPropsType = Omit<DynamicFormProps<any>, 'formSchema'>;

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
    hasMorePath?: keyof Result | string | ((result: any) => boolean);
    nextCursorPath?: keyof Result | string;
    nextCursorQuerySetPath?: string;
    countPath?: keyof Result | string;
    dataPath?: keyof Result | string;
    cachedDataListFilter?: string | Record<string, any>;
    useInfinityScroll?: boolean;
    infiniteScrollConfig?: InfiniteScrollConfig;
    dataListConfig?: DataListConfig;
    inDataDebugger?: boolean;
    useForm?: boolean;
    formProps?: FormPropsType;
}

type IGreetingResponseAtom = Record<string, GreetingOUT>;

export const greetingOUTStoreAtom = atomWithReset<IGreetingResponseAtom>({})
export const lastGreetingOUTAtom = atomWithReset<GreetingOUT | null>(null)

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
        hasMorePath = 'hasMore',
        nextCursorPath = 'nextCursor',
        countPath = 'count',
        dataPath = 'data',
        useInfinityScroll = false,
        infiniteScrollConfig,
        dataListConfig = {uniqBy: "id"},
        inDataDebugger = false,
        useForm = false,
        formProps,
        nextCursorQuerySetPath,
    }: Props
) => {
    const {api} = useGreetingApi(apiConfigParams, apiConfigOptions);
    const [_inData, setInData] = useAtom<INData | undefined>(useDeepCompareMemo(() => atom(inData), [inData]));
    // @ts-ignore
    const [response, setResponse] = useAtom<GreetingOUT>(lastGreetingOUTAtom)
    const resetResponse = useResetAtom(lastGreetingOUTAtom)
    const [streamResponseStore, setStreamResponseStore] = useState<any[]>([])
    const [greetingOUTStore, setGreetingOUTStore] = useAtom(greetingOUTStoreAtom)
    const resetGreetingOUTStore = useResetAtom(greetingOUTStoreAtom); // <--- Thêm dòng này
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<ResponseError | Error | null>(null); // <--- THÊM STATE LỖI
    const [lastFiredInData, setLastFiredInData] = useState<INData | undefined>();
    const prevResponse = usePrevious(response);

    const abortControllerRef = useRef<AbortController | null>(null);
    // Ref để lưu trữ inData của request đang được theo dõi bởi abortControllerRef
    const activeRequestInDataRef = useRef<INData | undefined | null>(null);
    const [_fireImmediately, setFireImmediately] = useState<boolean | undefined>(fireImmediately);


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

    const inDataDebugFn = useDeepCompareMemo(
        () => {
            // if (!inDataDebugger)
            //     return;
            // const now = new Date()
            // const ts = now.getSeconds() + "." + now.getMilliseconds()
            // console.log(`${ts} [inDataDebugger]:`, JSON.stringify(activeRequestInDataRef.current, null, 2))
        }
        , [activeRequestInDataRef.current]
        , inDataDebugger,
        `[inDataDebugger] > ${calledFunction()}`
    );

    useEffect(() => {
        if (inDataDebugger) {
            inDataDebugFn?.();
        }
    }, [activeRequestInDataRef.current])

    useEffect(
        () => {
            if (!api)
                return;

            if (_inData && (typeof _fireImmediately === "undefined" || _fireImmediately)) {
                fire(_inData).then()
                setFireImmediately(false); // did change, no set again
            }
        },
        [_fireImmediately, api, _inData]
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
            } else if (abortControllerRef.current) {
                logDev("New request with different inData. Previous active request (inData:", activeRequestInDataRef.current, ") continues. New request inData:", currentCallInData);
            }

            localAbortController = new AbortController();
            localSignal = localAbortController.signal;

            abortControllerRef.current = localAbortController;
            activeRequestInDataRef.current = currentCallInData;
        }


        try {
            console.group("🔥 /greeting")
            setLoading(true);
            setError(null); // <-- XÓA LỖI CŨ KHI BẮT ĐẦU YÊU CẦU MỚI
            if (!api) {
                setLoading(false)
                console.error(`greetingApi is undefined`)
                console.groupEnd()
                return;
            }

            if (fireIf && !fireIf(currentCallInData)) {
                setLoading(false); // Đảm bảo setLoading(false) nếu không fire
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
                    ...{
                        stream: !!memoStream
                    },
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
                                        // Sửa: return readChunk() để tiếp tục đọc nếu chunk rỗng nhưng stream chưa done
                                        await readChunk();
                                        return;
                                    }
                                    try {
                                        chunkText = trimDataOnStream(chunkText)
                                        const j = JSON.parse(chunkText);
                                        setStreamResponseStore(prev => [...prev, j])
                                    } catch (e: any) {
                                        const lastChunks = chunkText.split(/\r\n|\n|\r/g)
                                        // logDev({lastChunks})
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
                                        // Cân nhắc việc throw lỗi ở đây hoặc xử lý khác để báo hiệu stream bị lỗi
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
                            return; // Sửa: return ở đây để không chạy vào phần non-stream
                        }
                    }
                    // Sửa: Chuyển phần xử lý non-stream ra ngoài if (memoStream)
                    if (abortAble && localSignal?.aborted) {
                        logDev("Request aborted before reading non-streamed value for inData:", currentCallInData);
                        return;
                    }
                    const v = await greetingResponse.value()
                    if (abortAble && localSignal?.aborted) {
                        logDev("Request aborted during/after reading non-streamed value for inData:", currentCallInData);
                        return;
                    }
                    setLastFiredInData(currentCallInData);
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
                case 204:
                    logDev("✅ Received 204 No Content for inData:", currentCallInData);
                    setLastFiredInData(currentCallInData);
                    setResponse(null as any);
                    return null;
                default:
                    if (abortAble && localSignal?.aborted) {
                        logDev("Request aborted before reading error value for inData:", currentCallInData);
                        return;
                    }
                    const errorValue = await greetingResponse.value();
                    setError(errorValue as unknown as ResponseError); // <-- SET LỖI TỪ API RESPONSE
                    setResponse(null as any); // Xóa response cũ
                    if (useCachedResponse) {
                        setGreetingOUTStore(pre => omit(pre, [cachedKey(currentCallInData)]));
                    }
                    errorToast(`API Error ${greetingResponse.raw.status} for /greeting`,
                        <pre>{JSON.stringify(errorValue, null, 2)}</pre>);
                    logDev("❌ API Error:", errorValue);
                    return errorValue;
            }

        } catch (e: any) {
            if (abortAble && (e.name === 'AbortError' || (localSignal && localSignal.aborted))) {
                logDev("Fetch operation aborted for inData:", currentCallInData, "Error:", e.message);
            } else {
                // console.error("💥 Exception in fire() `greetingPost`:", e)
                if (useCachedResponse) {
                    setGreetingOUTStore(pre => omit(pre, [cachedKey(currentCallInData)]))
                }
                if (e instanceof ResponseError) {
                    const {response: errorResponse} = e;
                    if (!errorResponse) {
                        errorToast(`Network error or no response:`, e.message);
                        return;
                    }
                    let errJson = await errorResponse?.json()
                    if (errJson) {
                        setError(errJson);
                    }
                    const errMsg = get(errJson, 'message')
                    if (errMsg) {
                        errorToast(errMsg);
                    }
//                     console.error(
//                         `
// 💥 Call API \`greetingPost\` error:
// URL: ${errorResponse.url}
// STATUS: ${errorResponse.status} ${errorResponse.statusText}
// >>　👷 RESPONSE HEADERS >>
// ${JSON.stringify(Object.fromEntries(e.response.headers.entries()), null, 2)}
// << 👷 END RESPONSE HEADERS <<
// >> 🚩 IN DATA >>
// ${JSON.stringify(currentCallInData, null, 2)}
// << 🚩 END IN DATA <<
// >> 🟥 ERROR DETAILS >>
// ${JSON.stringify(errJson, null, 2)}
// << 🟥 END ERROR DETAILS <<
// `);
                } else {
                    setError(e); // <-- SET LỖI TỪ EXCEPTION (VD: LỖI MẠNG)
                    errorToast(`Unexpected error:`, e.message);
                }
            }
        } finally {
            setLoading(false)
            if (abortAble && localAbortController) {
                if (abortControllerRef.current === localAbortController) {
                    abortControllerRef.current = null;
                    activeRequestInDataRef.current = null;
                    logDev("--- Cleared global abort refs for inData ---", /*currentCallInData*/);
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

            return CustomOUTComponent(response)
        },
        [response, loading, CustomOUTComponent, LoadingComponent, EmptyComponent]
    )

    const ResultComponent = useCallback(
        () => {
            if (!CustomResultComponent)
                return null;

            if (loading || !response?.result)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = response?.result;
            return CustomResultComponent(data as unknown as OUTResult)
        },
        [response, loading, CustomResultComponent, LoadingComponent, EmptyComponent]
    )

    const DataComponent = useCallback(
        () => {
            if (!CustomDataComponent)
                return null;

            const data = valueOfData(response?.result);

            if (loading && !data)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

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

            const data = valueOfData(response?.result);

            if (loading && !data)
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

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
                            return CustomDataItemComponent(item, index)
                        })
                    }
                </div>
            )
        },
        [response, loading, CustomDataItemComponent, mainClassName, LoadingComponent, EmptyComponent]
    )

    const cachedResponse = useMemo(() => {
        const keyLookup = _inData !== undefined ? _inData : inData;
        if (keyLookup === undefined) return undefined;
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
                .flatMap(r => {
                    const value = get(r, filterPath);
                    if (Array.isArray(value)) return value;
                    return value !== undefined && value !== null ? [value] : [];
                })
                .filter(item => item !== undefined && item !== null)
                .filter(cachedResponseStoreValuesFilter.fn)
        },
        [greetingOUTStore]
    )


    const result = useMemo(() => {
        if (!response)
            return null;
        return response?.result ?? response as unknown as Result;
    }, [response])

    const getDataFn = (response?: OUT, dataPath?: keyof Result | string, defaultValues: any = null) => {
        const result = response?.result as unknown as Result;
        if (!result || !dataPath || !isObject(result))
            return null;
        if (dataPath && dataPath in result) {
            return get(result, dataPath, defaultValues) as unknown as Data;
        }
        return get(response, dataPath, defaultValues) as unknown as Data;
    }
    const data = useMemo(() => {
        if (!response) {
            return []
        }
        return getDataFn(response, dataPath, []) as OUTResultMaybeData;
    }, [response, dataPath])

    const hasMore = useMemo(() => {
        if (!result || !hasMorePath || !isObject(result))
            return false;
        if (typeof hasMorePath === 'function') {
            return hasMorePath(result)
        }
        if (hasMorePath && hasMorePath in result) {
            return get(result, hasMorePath, false)
        }
        return !!get(response, hasMorePath, false);
    }, [response, result])

    const count = useMemo(() => {
        if (!result || !countPath || !isObject(result))
            return 0;
        if (countPath && countPath in result) {
            return get(result, countPath, 0)
        }
        return get(response, countPath, 0) as number;
    }, [response, result])

    const nextCursor = useMemo(() => {
        if (!result || !nextCursorPath || !isObject(result))
            return '';
        if (nextCursorPath && nextCursorPath in result) {
            return get(result, nextCursorPath, '')
        }
        return get(response, nextCursorPath, '') as string;
    }, [response, result])

    const cachedDataList = useMemo(() => {
        if (!dataPath || !dataListConfig) {
            return [];
        }
        const responseValues = Object.values(greetingOUTStore);
        if (!responseValues.length) {
            return [];
        }
        let data = flatten(
            responseValues.map(
                response => getDataFn(response, dataPath) as Data
            )
        ) as Item[];

        // uniq by
        const uniqByParam = dataListConfig.uniqBy ?? "id";
        if (uniqByParam) {
            data = uniqBy(
                data,
                uniqByParam,
            ) as Item[]
        }
        // filter
        if (dataListConfig.filter) {
            const _filterParams = isPlainObject(dataListConfig.filter) ?
                transformDotKeyObjectToRawObject(dataListConfig.filter) :
                dataListConfig.filter;
            data = filter(data, _filterParams) as Item[]
        }
        // orderby
        if (dataListConfig.orderBy) {
            data = orderBy(data, dataListConfig.orderBy.iteratees, dataListConfig.orderBy.orders) as Item[]
        }

        return data;
    }, [greetingOUTStore])

    /* @deprecated */
    const InfinityScrollHere = useCallback(
        ({
             loadMoreHandler,
             lastElementSelector = {
                 data: cachedDataList,
                 cssDataPathMap: {id: "id"},
             },
             scrollTo = "bottom",
             scrollIntoViewOptions = true,
             triggerElementHeight = 1,
             intersectionObserverOptions,
             viewportRef,
         }: Omit<InfinityScrollHereProps, 'hasMore' | 'isLoading'>) => {

            if (!useInfinityScroll) {
                return;
            }

            if (typeof lastElementSelector === 'object' && !('data' in lastElementSelector)) {
                lastElementSelector.data = cachedDataList;
            }
            return (
                <InfinityScrollHereComponent
                    lastElementSelector={lastElementSelector}
                    scrollTo={scrollTo}
                    loadMoreHandler={loadMoreHandler || fire}
                    viewportRef={viewportRef}
                    scrollIntoViewOptions={scrollIntoViewOptions}
                    triggerElementHeight={triggerElementHeight}
                    intersectionObserverOptions={intersectionObserverOptions}
                    isLoading={loading}
                    hasMore={hasMore}
                />
            )
        },
        [
            loading,
            hasMore,
            cachedDataList,
        ]
    )

    /* Scroll Region */
    const loadMoreHandler = useCallback(() => {
        if (loading || !hasMore || !useInfinityScroll) {
            return;
        }
        if (!nextCursor) {
            logDev("`nextCursor` is not available. Cannot load more.");
            return;
        }

        const newInData = merge( // Sử dụng inData của lần fire cuối cùng, fallback về _inData ban đầu
            lastFiredInData || _inData || {},
            set({}, nextCursorQuerySetPath || nextCursorPath, nextCursor)
        );

        logDev("Loading more with new inData:", newInData);
        fire(newInData as INData);

    }, [loading, hasMore, useInfinityScroll, nextCursor, lastFiredInData, _inData, fire, nextCursorQuerySetPath, nextCursorPath]);

    const scrollableRootRef = useRef<React.ComponentRef<'div'> | null>(null);
    const lastScrollDistanceToBottomRef = useRef<number>(0);

    const [infiniteRef, {rootRef: infiniteRootRef}] = useInfiniteScroll({
        loading,
        hasNextPage: hasMore,
        onLoadMore: loadMoreHandler,
        disabled: Boolean(loading || !hasMore || error), // <-- VÔ HIỆU HÓA NẾU CÓ LỖI
        // rootMargin: rootMargin,
    });

    const isReverseScroll = useMemo(
        () => ['top', 'left'].includes(infiniteScrollConfig?.scrollTo ?? ''),
        [infiniteScrollConfig?.scrollTo]
    )
    useLayoutEffect(() => {
        if (!useInfinityScroll || !isReverseScroll)
            return;
        const lastScrollDistanceToBottom = lastScrollDistanceToBottomRef.current;

        if (scrollableRootRef.current) {
            const {
                scrollHeight,
                scrollTop
            } = scrollableRootRef.current;
            const newRootScrollTop = scrollHeight - lastScrollDistanceToBottom;
            if (newRootScrollTop > 0)
                scrollableRootRef.current.scrollTop = newRootScrollTop;
        } else {
            document.documentElement.scrollTop = document.body.scrollHeight - lastScrollDistanceToBottom;
        }
    }, [cachedDataList, infiniteRootRef, useInfinityScroll]);

    const rootRefSetter = useCallback(
        (node: HTMLDivElement) => {
            if (!useInfinityScroll || !isReverseScroll)
                return;
            infiniteRootRef(node);
            scrollableRootRef.current = node;
        },
        [infiniteRootRef],
    );

    const handleRootScroll = useCallback(() => {
        const rootNode = scrollableRootRef.current || document.documentElement;
        if (rootNode) {
            lastScrollDistanceToBottomRef.current = rootNode.scrollHeight - rootNode.scrollTop;
        } else {
            lastScrollDistanceToBottomRef.current = document.documentElement.scrollHeight - document.documentElement.scrollTop;
        }
    }, [scrollableRootRef]);

    useEffect(() => {
        if (!useInfinityScroll || !isReverseScroll)
            return;
        let handleScroll: (this: Window, ev: Event) => any;
        if (!scrollableRootRef.current) {
            handleScroll = () => {
                const windowRootNode = document.documentElement;
                lastScrollDistanceToBottomRef.current = windowRootNode.scrollHeight - windowRootNode.scrollTop;
                console.log("window scroll distance:", lastScrollDistanceToBottomRef.current)
            }
            window.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (!scrollableRootRef.current && handleScroll) {
                window.removeEventListener('scroll', handleScroll);
            }
        };
    }, [scrollableRootRef]);

    const InfiniteLoading = useCallback(
        () => {
            return hasMore && (
                <div ref={infiniteRef} style={{height: '1px', marginTop: '1px'}} aria-hidden="true">
                    <InfinityLoading/>
                </div>
            )
        },
        [
            hasMore
        ]
    )

    /* END Scroll Region */

    /* START form*/
    const Form = useCallback((props: FormPropsType) => {
        if (!useForm)
            return;

        return (
            <DynamicForm
                formSchema={GreetingINData_schema as any}
                defaultValues={GreetingIN_defaultValues.data}
                {...{useSubmitHook: useGreetingPost}}
                componentRegistry={nativeComponentRegistry}
                {...({...formProps, ...props})}
            />
        )
    }, [useForm])
    /* END form*/

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
        error, // <--- EXPORT LỖI RA NGOÀI
        api,
        cachedResponseStore: greetingOUTStore,
        resetCachedResponseStore: resetGreetingOUTStore,
        cachedResponseStoreFilteredValues,
        cachedResponse,
        DataItemComponent,
        DataComponent,
        ResultComponent,
        OUTComponent,
        cachedKey,
        hasMore,
        nextCursor,
        count,
        data,
        docs: data,
        cachedDataList,
        dataList: cachedDataList,
        InfinityScrollHere,
        infiniteRef,
        infiniteRootRef,
        InfiniteLoading,
        rootRefSetter,
        scrollableRootRef,
        handleRootScroll,
        Form,
    }
}