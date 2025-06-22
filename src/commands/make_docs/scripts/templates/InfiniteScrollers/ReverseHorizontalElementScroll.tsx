import useInfiniteScroll, {UseInfiniteScrollHookArgs} from "react-infinite-scroll-hook";
import React, {useCallback, useLayoutEffect, useRef} from "react";
import {Item} from "../useFn.template";
import {Loading} from "./Loading";

export default function ReverseHorizontalElementScroll(
    {
        items,
        hasNextPage,
        className,
        ItemComponent,
        loading,
        onLoadMore,
        rootMargin
    }: UseInfiniteScrollHookArgs & {
        items: any[];
        className?: string;
        ItemComponent?: (item: Item, index: number) => React.ReactNode;
    }): React.ReactNode {

    const [infiniteRef, {rootRef}] = useInfiniteScroll({
        loading,
        hasNextPage: hasNextPage,
        onLoadMore: onLoadMore,
        // When there is an error, we stop infinite loading.
        // It can be reactivated by setting "error" state as undefined.
        disabled: Boolean(loading || !hasNextPage),
        // `rootMargin` is passed to `IntersectionObserver`.
        // We can use it to trigger 'onLoadMore' when the sentry comes near to become
        // visible, instead of becoming fully visible on the screen.
        rootMargin: rootMargin,
    });

    const scrollableRootRef = useRef<React.ComponentRef<'div'> | null>(null);
    const lastScrollDistanceToRightRef = useRef<number>(0)

    // We keep the scroll position when new items are added etc.
    useLayoutEffect(() => {
        const scrollableRoot = scrollableRootRef.current;
        const lastScrollDistanceToRight = lastScrollDistanceToRightRef.current;
        if (scrollableRoot) {
            scrollableRoot.scrollLeft =
                scrollableRoot.scrollWidth - lastScrollDistanceToRight;
        }
    }, [items, rootRef]);

    const rootRefSetter = useCallback(
        (node: HTMLDivElement) => {
            rootRef(node);
            scrollableRootRef.current = node;
        },
        [rootRef],
    );

    const handleRootScroll = useCallback(() => {
        const rootNode = scrollableRootRef.current;
        if (rootNode) {
            lastScrollDistanceToRightRef.current = rootNode.scrollWidth - rootNode.scrollLeft;
        }
    }, []);

    const ItemListComponent = useCallback(() => {
        if (!items.length)
            return;
        return items.map((item: Item, index) => ItemComponent?.(item, index))
    }, [items])

    if (rootRefSetter) return (
        <div
            ref={rootRefSetter}
            className={className}
            onScroll={handleRootScroll}
        >
            {hasNextPage && <div ref={infiniteRef}><Loading/></div>}
            <>
                <ItemListComponent/>
            </>
        </div>
    );
    return (
        <div>
            {hasNextPage && <div ref={infiniteRef}><Loading/></div>}
            <>
                <ItemListComponent/>
            </>
        </div>
    );
}

export const ReverseHorizontalElementScrollMemo = React.memo(ReverseHorizontalElementScroll)