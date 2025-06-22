import React, {useEffect, useRef} from 'react';
import {first, isString, last} from "lodash";
import get from "lodash/get";

type InfinityScrollType = "bottom" | "right" | "top" | "left";
type lastElementSelectorProps = {
    data?: any[];
    cssDataPathMap?: Record<string, any>; // `[keyCSS="dataPropPath"] ...` CSS selector
}

export interface InfinityScrollHereProps {
    lastElementSelector: string | lastElementSelectorProps;
    loadMoreHandler: () => void;
    hasMore: boolean;
    isLoading: boolean;
    scrollTo?: InfinityScrollType;
    //
    viewportRef?: React.RefObject<HTMLDivElement | null>;
    scrollIntoViewOptions?: boolean | ScrollIntoViewOptions;
    triggerElementHeight?: number;
    intersectionObserverOptions?: Omit<IntersectionObserverInit, 'root'>;
}

export const InfinityScrollHereComponent: React.FC<InfinityScrollHereProps> = (
    {
        lastElementSelector = {
            data: [],
            cssDataPathMap: {id: "id"},
        },
        scrollTo = "bottom",
        loadMoreHandler,
        hasMore,
        isLoading,
        viewportRef,
        scrollIntoViewOptions = true, //{behavior: 'instant', block: 'start'}
        triggerElementHeight = 1,//px
        intersectionObserverOptions = {},
    }) => {

    const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const triggerElement = loadMoreTriggerRef.current;
        const viewPort = viewportRef?.current || window.document.body;

        // Tạo một observer
        const observer = new IntersectionObserver(
            (entries) => {
                // Lấy entry đầu tiên (và duy nhất)
                const [entry] = entries;

                // Nếu phần tử trigger đi vào trong viewport, và chúng ta không đang tải,
                // và vẫn còn tin nhắn để tải, thì kích hoạt onLoadMore.
                if (entry.isIntersecting && !isLoading && hasMore) {
                    loadMoreHandler();
                }
            },
            {
                // root: null có nghĩa là viewport của trình duyệt
                // rootMargin và threshold có thể được tùy chỉnh nếu cần
                root: viewPort,
                ...intersectionObserverOptions,
                // rootMargin: '1000px 0px 0px 0px',
                // threshold: 1, // Kích hoạt khi 100% phần tử hiển thị
            }
        );

        // Bắt đầu quan sát phần tử trigger nếu nó tồn tại
        if (triggerElement) {
            observer.observe(triggerElement);
        }

        // Hàm dọn dẹp: ngừng quan sát khi component unmount
        return () => {
            if (triggerElement) {
                observer.unobserve(triggerElement);
            }
        };
        // Effect này sẽ chạy lại nếu các dependency thay đổi,
        // đảm bảo observer luôn có được state mới nhất.
    }, [loadMoreTriggerRef, loadMoreHandler, hasMore, isLoading]);

    useEffect(() => {
        const viewPort = viewportRef?.current || window.document.body;
        if (!isLoading) {
            requestAnimationFrame(() => {
                let anchorElement
                if (isString(lastElementSelector)) {
                    anchorElement = viewPort.querySelector(lastElementSelector);
                }
                if (!anchorElement) {
                    lastElementSelector = lastElementSelector as lastElementSelectorProps;
                    let fn;
                    switch (scrollTo) {
                        case "top":
                        case "left":
                            fn = first;
                            break;
                        case "bottom":
                        case "right":
                        default:
                            fn = last;
                    }
                    const selector = Object.entries(lastElementSelector.cssDataPathMap as Record<string, any>)
                        .map(([cssKey, dataPropPath]) => {
                            const val = get(fn(get(lastElementSelector, 'data')), dataPropPath)
                            return `[${cssKey}="${CSS.escape(val)}"]`
                        }).join(" ");
                    anchorElement = viewPort.querySelector(selector)
                }
                if (anchorElement) {
                    anchorElement.scrollIntoView(scrollIntoViewOptions);
                }
            });
        }
    }, [isLoading]);

    return (hasMore && !isLoading) && (
        <div
            ref={loadMoreTriggerRef}
            // Thêm một chút chiều cao để đảm bảo observer có thể "thấy" nó
            style={{
                height: `${triggerElementHeight}px`,
                width: '100%'
            }}
        />
    )
}