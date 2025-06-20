// @ts-nocheck
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import useGreetingApi from "./useGreetingApi"
import {flatten, get, isEqual, isPlainObject, omit, uniqBy, values} from 'lodash'

import {GreetingIN, GreetingOUT, ResponseError} from "../"
import {atom, useAtom, useAtomValue} from "jotai";
import {useResetAtom} from "jotai/utils"; // Đảm bảo đã import
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
    hasMorePath?: string;
    nextCursorPath?: string;
    dataPath?: string;
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
        hasMorePath = 'result.hasMore',
        nextCursorPath = 'result.nextCursor',
        countPath = 'result.count',
        dataPath = 'result.data',
    }: Props
) => {
    const {api} = useGreetingApi(apiConfigParams, apiConfigOptions);
    const [_inData, setInData] = useAtom<INData | undefined>(useDeepCompareMemo(() => atom(inData), [inData]));
    const [response, setResponse] = useAtom<GreetingOUT>(lastGreetingOUTAtom)
    const resetResponse = useResetAtom(lastGreetingOUTAtom)
    const [streamResponseStore, setStreamResponseStore] = useState<any[]>([])
    const [greetingOUTStore, setGreetingOUTStore] = useAtom(greetingOUTStoreAtom)
    const resetGreetingOUTStore = useResetAtom(greetingOUTStoreAtom); // <--- Thêm dòng này
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
                    setResponse(null as any); // Hoặc một giá trị biểu thị "no content"
                    // Không nên cache giá trị null nếu logic cache không xử lý được
                    // if (useCachedResponse) {
                    //     setGreetingOUTStore(pre => ({ ...pre, [cachedKey(currentCallInData)]: null as any }));
                    // }
                    return null;
                default:
                    if (abortAble && localSignal?.aborted) {
                        logDev("Request aborted before reading error value for inData:", currentCallInData);
                        return;
                    }
                    // Sửa: Xử lý lỗi một cách nhất quán
                    const errorValue = await greetingResponse.value(); // Thường là { error: ... }
                    setResponse(errorValue as GreetingOUT); // Cập nhật response với lỗi
                    if (useCachedResponse) {
                        // Có thể bạn muốn cache cả lỗi, hoặc xóa cache entry
                        setGreetingOUTStore(pre => omit(pre, [cachedKey(currentCallInData)]));
                        // Hoặc: setGreetingOUTStore(pre => ({ ...pre, [cachedKey(currentCallInData)]: errorValue as GreetingOUT }));
                    }
                    errorToast(`API Error ${greetingResponse.raw.status} for /greeting`,
                        <pre>{JSON.stringify(errorValue, null, 2)}</pre>);
                    logDev("❌ API Error:", errorValue);
                    return errorValue; // Trả về lỗi để bên gọi có thể xử lý nếu cần
            }

        } catch (e: any) {
            if (abortAble && (e.name === 'AbortError' || (localSignal && localSignal.aborted))) {
                logDev("Fetch operation aborted for inData:", currentCallInData, "Error:", e.message);
            } else {
                // e = e as ResponseError // Không cần ép kiểu ở đây nữa nếu đã xử lý ở default case
                if (useCachedResponse) {
                    setGreetingOUTStore(pre => omit(pre, [cachedKey(currentCallInData)]))
                }
                console.error("💥 Exception in fire():", e)
                // Xử lý lỗi chung nếu không phải AbortError
                // (Ví dụ: lỗi mạng không phải từ API response status)
                if (e instanceof ResponseError) { // Kiểm tra nếu là ResponseError từ generated client
                    const {response: errorResponse} = e;
                    if (!errorResponse) {
                        errorToast(`Network error or no response:`, e.message);
                        return;
                    }
                    const serror = (await errorResponse?.json())?.error;
                    errorToast(
                        `Call API \`greetingPost\` error: ${errorResponse.status} (${get(serror, 'status')})`,
                        <pre>{get(serror, 'message')}</pre>
                    );
                } else {
                    errorToast(`Unexpected error:`, e.message);
                }
                // Không throw e ở đây nữa nếu đã xử lý và hiển thị toast
                // throw e;
            }
        } finally {
            setLoading(false)
            if (abortAble && localAbortController) {
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
        } else if (!abortAble) {
            logDev("abort() called, but abortAble is false. No action taken.");
        }
    }, [abortAble]);


    const OUTComponent = useCallback(
        () => {
            if (!CustomOUTComponent)
                return null;

            if (loading || !response) // Sửa: Kiểm tra response có tồn tại không
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = response;
            // if (!data) { // Đã kiểm tra ở trên
            //     return EmptyComponent ? <EmptyComponent/> : <div>(data is empty)</div>;
            // }
            return CustomOUTComponent(data)
        },
        [response, loading, CustomOUTComponent, LoadingComponent, EmptyComponent]
    )

    const ResultComponent = useCallback(
        () => {
            if (!CustomResultComponent)
                return null;

            if (loading || !response?.result) // Sửa: Kiểm tra response và response.result
                return LoadingComponent ? <LoadingComponent/> : <div>loading...</div>;

            const data = response?.result;
            // if (!data) { // Đã kiểm tra ở trên
            //     return EmptyComponent ? <EmptyComponent/> : <div>(data is empty)</div>;
            // }
            return CustomResultComponent(data as unknown as OUTResult)
        },
        [response, loading, CustomResultComponent, LoadingComponent, EmptyComponent]
    )

    const DataComponent = useCallback(
        () => {
            if (!CustomDataComponent)
                return null;

            const data = valueOfOUTResultMaybeData(response?.result);

            if (loading && !data) // Sửa: Hiển thị loading nếu đang load và chưa có data
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

            const data = valueOfOUTResultMaybeData(response?.result);

            if (loading && !data) // Sửa: Hiển thị loading nếu đang load và chưa có data
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
                            // Sửa: Không cần kiểm tra CustomDataItemComponent nữa vì đã kiểm tra ở đầu hàm
                            return CustomDataItemComponent(item, index)
                            // Dòng dưới đây sẽ không bao giờ được thực thi nếu CustomDataItemComponent tồn tại
                            // return (
                            //     <div className={dataItemClassName ?? ""} key={get(item, 'id', `noID-${index}`)}>
                            //         {JSON.stringify(item, null, 4)}
                            //     </div>
                            // )
                        })
                    }
                </div>
            )
        },
        [response, loading, CustomDataItemComponent, mainClassName, /*dataItemClassName,*/ LoadingComponent, EmptyComponent]
    )

    const cachedResponse = useMemo(() => {
        const keyLookup = _inData !== undefined ? _inData : inData;
        if (keyLookup === undefined) return undefined; // Tránh lỗi nếu keyLookup là undefined
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
                    // Đảm bảo chỉ flatMap nếu value là array, nếu không trả về mảng chứa value đó (nếu có)
                    if (Array.isArray(value)) return value;
                    return value !== undefined && value !== null ? [value] : [];
                })
                .filter(item => item !== undefined && item !== null) // Lọc ra các item undefined/null sau flatMap
                .filter(cachedResponseStoreValuesFilter.fn)
        },
        [greetingOUTStore]
    )

    const hasMore = useMemo(() => {
        if (!response || !hasMorePath)
            return false;
        return !!get(response, hasMorePath, false);
    }, [response])

    const count = useMemo(() => {
        if (!response || !countPath)
            return 0;
        return get(response, countPath, 0) as number;
    }, [response])

    const nextCursor = useMemo(() => {
        if (!response || !nextCursorPath)
            return '';
        return get(response, nextCursorPath, '') as string;
    }, [response])

    const data = useMemo(() => {
        if (!response || !dataPath)
            return;
        return get(response, dataPath, null) as OUTResultMaybeData;
    }, [response])

    const cachedDataList = useMemo(() => {
        if (!dataPath) {
            return [];
        }
        return uniqBy(
            flatten(
                values(greetingOUTStore)
                    .map(
                        response => get(response, dataPath) as OUTResultMaybeData
                    )
            )
            , 'id'
        ) as OUTResultMaybeDataItem[]
    }, [greetingOUTStore])

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
        resetCachedResponseStore: resetGreetingOUTStore, // <--- Thêm hàm reset vào đây
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
        cachedDataList,
    }
}