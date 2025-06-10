// @ts-nocheck
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react"; // Added useRef
import useGreetingApi from "./useGreetingApi"
import {get, isEqual, isPlainObject, omit} from 'lodash'

import {GreetingIN, GreetingOUT, ResponseError} from "../"
import {atom, useAtom, useAtomValue} from "jotai";
import {useResetAtom} from "jotai/utils";
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
    fireIf?: (data?: INData) => boolean;
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
    }: Props
) => {
    const {api} = useGreetingApi(apiConfigParams, apiConfigOptions);
    const [_inData, setInData] = useState<INData | undefined>(inData)
    const [response, setResponse] = useAtom<GreetingOUT>(lastGreetingOUTAtom)
    const resetResponse = useResetAtom(lastGreetingOUTAtom)
    const [streamResponseStore, setStreamResponseStore] = useState<any[]>([])
    const [greetingOUTStore, setGreetingOUTStore] = useAtom(greetingOUTStoreAtom)
    const [loading, setLoading] = useState<boolean>(false)
    const prevResponse = usePrevious(response);
    const abortControllerRef = useRef<AbortController | null>(null); // For aborting requests

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
        [fireImmediately, api, _inData] // fire should not be in dependencies to avoid re-triggering
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
        // Abort any previous ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            logDev("Previous request aborted");
        }

        // Create a new AbortController for this request
        const currentAbortController = new AbortController();
        abortControllerRef.current = currentAbortController;
        const signal = currentAbortController.signal;

        let currentInData = inDataParam;

        try {
            console.group("🔥 /greeting")
            setLoading(true);
            if (!api) {
                setLoading(false)
                console.error(`greetingApi is undefined`)
                console.groupEnd()
                return;
            }

            if (!currentInData) {
                // use last saved inData
                currentInData = _inData;
            }

            if (fireIf && !fireIf(currentInData)) {
                // setLoading(false); // Handled by finally
                return;
            }

            logDev("↙️", currentInData)

            // Check if aborted before making the API call
            if (signal.aborted) {
                logDev("Request aborted before sending.");
                // setLoading(false); // Handled by finally
                return;
            }

            const greetingResponse = await api.greetingPostRaw(
                { // API parameters
                    greetingIN: {
                        data: currentInData!,
                    },
                    stream: !!memoStream, // Assuming 'stream' is an API parameter for the endpoint
                },
                { // RequestInit options for fetch
                    signal: signal, // Pass the abort signal
                }
            );

            // Check if aborted after receiving headers but before processing body
            if (signal.aborted) {
                logDev("Request aborted after receiving headers.");
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
                                    // Check signal before each read
                                    if (signal.aborted) {
                                        logDev("Stream reading aborted by signal.");
                                        if (typeof reader.cancel === 'function') {
                                            await reader.cancel("Aborted by user");
                                        }
                                        return;
                                    }

                                    const {done, value} = await reader.read();
                                    if (done) {
                                        if (signal.aborted) logDev("Stream finished, but signal was aborted around the same time.");
                                        return;
                                    }
                                    if (signal.aborted) { // Check again after value is received
                                        logDev("Stream reading aborted by signal after read().");
                                        return;
                                    }

                                    let chunkText = textDecoder.decode(value, {stream: true}).trim();
                                    if (!chunkText) {
                                        return; // Continue to next read if chunk is empty
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
                                                    // Ignore parsing error for individual sub-chunks if needed
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
                                    if (e.name === 'AbortError' || signal.aborted) {
                                        logDev("Stream reading aborted:", e.message);
                                    } else {
                                        logDev("Error reading stream chunk:", e);
                                    }
                                }
                            }

                            await readChunk()
                            if (signal.aborted) {
                                logDev("Stream processing loop finished due to abort.");
                                return;
                            }
                            // END readChunks
                            setTimeout(
                                () => {
                                    if (!signal.aborted) { // Only reset if not aborted
                                        logDev("reset streamResponseStore")
                                        setStreamResponseStore(() => [])
                                    } else {
                                        logDev("Stream was aborted, not resetting streamResponseStore via timeout.")
                                    }
                                }, 1000
                            )
                            return;
                        }
                    } else {
                        if (signal.aborted) {
                            logDev("Request aborted before reading non-streamed value.");
                            return;
                        }
                        const v = await greetingResponse.value()
                        if (signal.aborted) { // Check after value() resolves
                            logDev("Request aborted during/after reading non-streamed value.");
                            return;
                        }
                        setResponse(v)
                        if (useCachedResponse) {
                            setGreetingOUTStore(pre => (
                                {
                                    ...pre,
                                    [cachedKey(currentInData)]: v
                                }
                            ))
                        }
                        logDev("↘️", v)
                        return v;
                    }
                    break; // Added break for clarity, though return exits.
                case 204:
                    return null;
                default:
                    if (signal.aborted) {
                        logDev("Request aborted before reading error value.");
                        return;
                    }
                    return await greetingResponse.value();
            }

        } catch (e: any) {
            if (e.name === 'AbortError' || (signal && signal.aborted)) {
                logDev("Fetch operation aborted:", e.message);
                // No error toast for user-initiated aborts
                // Cache is not modified on abort
            } else {
                e = e as ResponseError
                if (useCachedResponse) {
                    setGreetingOUTStore(pre => omit(pre, [cachedKey(currentInData)]))
                }
                console.error(e)
                const {response: errorResponse} = e
                if (!errorResponse) {
                    errorToast(`no response:`, e.message)
                    // setLoading(false); // Handled by finally
                    return;
                }
                const serror = (await errorResponse?.json())?.error;
                errorToast(
                    `call api \`greetingPost\` error: ${errorResponse.status} (${get(serror, 'status')})`,
                    <pre>{get(serror, 'message')}</pre>
                )
                throw e; // Re-throw non-abort errors
            }
        } finally {
            setLoading(false)
            // Clear the controller for this specific call if it's still the one in the ref
            if (abortControllerRef.current === currentAbortController) {
                abortControllerRef.current = null;
            }
            console.groupEnd()
        }
    }

    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            logDev("User explicitly called abort().");
            abortControllerRef.current.abort();
            // setLoading(false); // Optional: for immediate UI feedback, but finally in fire() handles it.
        }
    }, []);


    const OUTComponent = useCallback(
        // ... (no changes needed here, relies on `loading` and `response` state)
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
        // ... (no changes needed here)
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
        // ... (no changes needed here)
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
        // ... (no changes needed here)
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
        // Use _inData for consistency if inData prop is undefined initially
        const keyLookup = _inData !== undefined ? _inData : inData;
        return greetingOUTStore[cachedKey(keyLookup)];
    }, [greetingOUTStore, _inData, inData]) // Added _inData

    const responseSWR = useMemo(
        () => {
            return cachedResponse || response;
        },
        [cachedResponse, response]
    )

    return {
        response,
        responseSWR,
        resetResponse,
        streamResponseStore,
        isResponseChanged,
        fire,
        postAction: fire,
        abort, // Expose the abort function
        setInData,
        loading,
        api,
        cachedResponseStore: greetingOUTStore,
        cachedResponse,
        DataItemComponent,
        DataComponent,
        ResultComponent,
        OUTComponent,
        cachedKey
    }
}