import useInfiniteScroll, {UseInfiniteScrollHookArgs} from "react-infinite-scroll-hook";
import React, {useCallback} from "react";
import {Item} from "../useFn.template";
import {Loading} from "./Loading";

export default function VerticalElementScroll(
    {
        items,
        hasNextPage,
        className,
        ItemComponent,
        loading,
        onLoadMore,
        rootMargin
    }: UseInfiniteScrollHookArgs &
        {
            items: Item[];
            className?: string;
            ItemComponent: (item: Item, index: number) => React.ReactNode;
        }
): React.ReactNode {

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

    const ItemListComponent = useCallback(() => {
        if (!items.length)
            return;
        console.log("processing ItemListComponent")
        return items.map(ItemComponent)
    }, [items])

    if (rootRef) return (
        <div
            ref={rootRef}
            className={className}
        >
            <>
                <ItemListComponent/>
            </>
            {hasNextPage && <div ref={infiniteRef}><Loading/></div>}
        </div>
    );
    return (
        <div>
            <>
                <ItemListComponent/>
            </>
            {hasNextPage && <div ref={infiniteRef}><Loading/></div>}
        </div>
    );
}