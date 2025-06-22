// /Users/lethanh/WebstormProjects/apiyaml/src/commands/make_docs/scripts/templates/InfiniteScrollers/VerticalElementScroll.tsx
import useInfiniteScroll, {UseInfiniteScrollHookArgs} from "react-infinite-scroll-hook";
import React, {useMemo} from "react";
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

    // SỬA ĐỔI: Dùng useMemo để tối ưu hóa việc tạo danh sách item.
    // Hoặc có thể map trực tiếp trong JSX nếu không cần tối ưu hóa cao.
    const renderedItems = useMemo(() => {
        return items.map(ItemComponent);
    }, [items, ItemComponent]);

    const commonContent = (
        <>
            {renderedItems}
            {hasNextPage && <div ref={infiniteRef}><Loading/></div>}
        </>
    );

    if (rootRef) return (
        <div
            ref={rootRef}
            className={className}
        >
            {commonContent}
        </div>
    );
    return (
        <div className={className}>
            {commonContent}
        </div>
    );
}

    export const VerticalElementScrollMemo = React.memo(VerticalElementScroll);