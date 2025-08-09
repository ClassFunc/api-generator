import {startCase} from "lodash";
import React, {JSX, useEffect, useMemo, useState} from "react";

/**
 * Lấy giá trị lồng nhau từ một object bằng chuỗi path (ví dụ: 'owner.name').
 * @param obj Object để tìm kiếm.
 * @param path Chuỗi path phân tách bằng dấu chấm hoặc mảng các key.
 * @returns Giá trị tìm thấy hoặc undefined.
 */
const getValueByPath = (obj: any, path: string | string[]): any => {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    return pathArray.reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Xóa một thuộc tính lồng nhau khỏi object. Hàm này sẽ thay đổi object gốc.
 * @param obj Object để thay đổi.
 * @param path Chuỗi path đến thuộc tính cần xóa.
 * @returns true nếu xóa thành công, ngược lại false.
 */
const unsetByPath = (obj: any, path: string | string[]): boolean => {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    const lastKey = pathArray.pop();
    if (!lastKey) return false;

    const parent = pathArray.length > 0 ? getValueByPath(obj, pathArray) : obj;

    if (parent && typeof parent === 'object' && lastKey in parent) {
        delete parent[lastKey];
        return true;
    }
    return false;
};

type ActionSubmitHook<T> = (options?: { fireImmediately?: boolean }) => {
    fire: (data: T) => Promise<any>;
    loading: boolean;
    error: Error | null;
    data: any;
};

/**
 * Cấu hình cho một hành động trên hàng của bảng.
 * - `button`: Hiển thị một nút bấm.
 * - `checkbox`: Hiển thị một ô kiểm.
 */
export type RowAction = ({
    type: 'button';
    label: string | React.ReactNode;
    className?: string;
} & ({
    onClick: (rowData: any) => void;
    useSubmitHook?: never;
    mapData?: never;
} | {
    onClick?: never;
    useSubmitHook: ActionSubmitHook<any>;
    /**
     * An optional function to transform the row data before it's passed to the `fire` function.
     * If not provided, the entire `rowData` object is passed.
     * @param rowData The data for the current row.
     * @returns The data payload for the `fire` function.
     */
    mapData?: (rowData: any) => any;
})) | {
    type: 'checkbox';
    /** The field in rowData that holds the initial boolean checked state. Used to pre-select rows when `rowKeyField` is present. */
    initialCheckedField?: string;
    /** Optional: Callback for when an individual checkbox changes. */
    onChange?: (rowData: any, isChecked: boolean) => void;
    className?: string;
};

/**
 * Cấu hình cho một hành động trên toàn bộ bảng (ví dụ: xóa các hàng đã chọn).
 */
export type TableAction = {
    key?: string;
    label: string | React.ReactNode;
    className?: string;
    /** If true, the button will be disabled. */
    isBusy?: boolean;
    /** If true, the button will be enabled even if there is no selection. Defaults to false. */
    ignoreSelection?: boolean;
} & ({
    onClick: (selectedKeys: Set<any>, selectedRows: any[]) => void;
    useSubmitHook?: never;
} | {
    onClick?: never;
    useSubmitHook: ActionSubmitHook<any>;
    /**
     * An optional function to transform the selection data before it's passed to the `fire` function.
     * If not provided, the entire selection object `{ selectedKeys, selectedRows }` is passed.
     * @param selection The selection object containing `selectedKeys` and `selectedRows`.
     * @returns The data payload for the `fire` function.
     */
    mapSelection?: (selection: { selectedKeys: Set<any>, selectedRows: any[] }) => any;
});

/**
 * Cấu hình cho một trường có thể hiển thị, bao gồm đường dẫn và cách render.
 */
export type DataPathFieldConfig = {
    path: string;
    title?: string | React.ReactNode;
    as?: 'text' | 'image' | 'video' | 'url' | 'checkbox';
    className?: string;
    clickable?: boolean;
};

const RowActionButton: React.FC<{
    action: Extract<RowAction, { type: 'button' }>;
    rowData: any;
    componentRegistry?: Record<string, React.ComponentType<any>>;
}> = ({action, rowData, componentRegistry}) => {
    const {className, label} = action;
    const ButtonComponent = componentRegistry?.['button'] as React.ElementType | undefined;

    if (action.useSubmitHook) {
        const {fire, loading} = action.useSubmitHook({fireImmediately: false});
        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            const dataToSend = action.mapData ? action.mapData(rowData) : rowData;
            fire(dataToSend).catch(err => console.error("[RowAction] Submit hook error:", err));
        };

        if (ButtonComponent) {
            return (
                <ButtonComponent size="sm" className={className} onClick={handleClick} disabled={loading}>
                    {loading ? '...' : label}
                </ButtonComponent>
            );
        }
        return (
            <button
                onClick={handleClick}
                disabled={loading}
                className={`px-2 py-1 text-xs rounded-md transition-colors disabled:opacity-50 ${className || 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
            >
                {loading ? '...' : label}
            </button>
        );
    }

    // Fallback to simple onClick
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        action.onClick(rowData);
    };

    if (ButtonComponent) {
        return (
            <ButtonComponent size="sm" className={className} onClick={handleClick}>
                {label}
            </ButtonComponent>
        );
    }
    return (
        <button
            onClick={handleClick}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${className || 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
        >
            {label}
        </button>
    );
};

const RowActionCheckbox: React.FC<{
    action: Extract<RowAction, { type: 'checkbox' }>;
    rowData: any;
    componentRegistry?: Record<string, React.ComponentType<any>>;
}> = ({action, rowData, componentRegistry}) => {
    // Lấy giá trị checked ban đầu từ dữ liệu của hàng.
    const initialCheckedValue = action.initialCheckedField ? getValueByPath(rowData, action.initialCheckedField) : false;

    // Quản lý trạng thái checked trong component.
    const [isChecked, setIsChecked] = useState(!!initialCheckedValue);

    // Đồng bộ trạng thái nếu dữ liệu ban đầu từ props thay đổi.
    useEffect(() => {
        setIsChecked(!!initialCheckedValue);
    }, [initialCheckedValue]);

    const handleChange = (checked: boolean | React.ChangeEvent<HTMLInputElement>) => {
        const isCheckedBool = typeof checked === 'boolean' ? checked : checked.target.checked;
        // Cập nhật trạng thái nội bộ.
        setIsChecked(isCheckedBool);
        // Gọi callback onChange của người dùng (nếu có).
        action.onChange?.(rowData, isCheckedBool);
    };

    const CheckboxComponent = componentRegistry?.['checkbox'] as React.ElementType;
    const commonProps = {
        checked: isChecked,
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        className: action.className,
    };

    if (CheckboxComponent) {
        return (
            <CheckboxComponent
                {...commonProps}
                onCheckedChange={handleChange}
            />
        );
    }

    return (
        <input
            type="checkbox"
            {...commonProps}
            onChange={handleChange}
            className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 ${action.className || ''}`}
        />
    );
};


const TableActionButton: React.FC<{
    action: TableAction;
    selection: { selectedKeys: Set<any>, selectedRows: any[] };
    componentRegistry?: Record<string, React.ComponentType<any>>;
}> = ({action, selection, componentRegistry}) => {
    const {className, label, isBusy, ignoreSelection} = action;
    const hasSelection = selection.selectedKeys.size > 0;
    const isEnabled = ignoreSelection || hasSelection;
    const ButtonComponent = componentRegistry?.['button'] as React.ElementType | undefined;

    if (action.useSubmitHook) {
        const {fire, loading} = action.useSubmitHook({fireImmediately: false});
        const handleClick = () => {
            const dataToSend = action.mapSelection ? action.mapSelection(selection) : selection;
            fire(dataToSend).catch(err => console.error("[TableAction] Submit hook error:", err));
        };
        const busy = isBusy || loading;

        if (ButtonComponent) {
            return <ButtonComponent variant="outline" size="sm" className={className}
                                    disabled={!isEnabled || busy}
                                    onClick={handleClick}>{busy ? '...' : label}</ButtonComponent>
        }
        return <button disabled={!isEnabled || busy} onClick={handleClick}
                       className={`px-3 py-1 text-sm border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className || 'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600'}`}>{busy ? '...' : label}</button>
    }

    // Simple onClick
    const handleClick = () => {
        action.onClick(selection.selectedKeys, selection.selectedRows);
    };

    if (ButtonComponent) {
        return <ButtonComponent variant="outline" size="sm" className={className} disabled={!isEnabled || isBusy}
                                onClick={handleClick}>{isBusy ? '...' : label}</ButtonComponent>
    }
    return <button disabled={!isEnabled || isBusy} onClick={handleClick}
                   className={`px-3 py-1 text-sm border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className || 'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-600'}`}>{isBusy ? '...' : label}</button>
};

/**
 * Component đệ quy để hiển thị mọi loại dữ liệu.
 * Nó sẽ tự động render bảng cho object và array, và tiếp tục gọi chính nó
 * cho các giá trị lồng nhau, tạo ra một cấu trúc bảng phân cấp.
 */
const RecursiveRenderer = (
    {
        data,
        dataPathFields,
        renderAs,
        onRowClick,
        rowActions,
        rowKeyField,
        selectedKeys,
        onSelectionChange,
        selectOnRowClick,
        clickable,
        selectedRowClassName,
        className,
        componentRegistry,
        showDataTableHeaders,
        showRowNumber,
        InfiniteLoading
    }: {
        data: any,
        dataPathFields?: DataPathFieldConfig[],
        renderAs?: DataPathFieldConfig['as'],
        onRowClick?: (rowData: any) => void,
        rowActions?: RowAction[],
        rowKeyField?: string,
        selectedKeys?: Set<any>,
        onSelectionChange?: (row: any, isChecked: boolean) => void,
        selectOnRowClick?: boolean,
        clickable?: boolean,
        selectedRowClassName?: string,
        className?: string,
        componentRegistry?: Record<string, React.ComponentType<any>>,
        showDataTableHeaders?: boolean,
        showRowNumber?: boolean,
        InfiniteLoading?: React.ComponentType<any>,
    }): JSX.Element | null => {
    // --- Các trường hợp cơ bản (điểm dừng của đệ quy) ---
    if (data === null || data === undefined) {
        return <span className="italic text-gray-500 dark:text-gray-400">Not Provided</span>;
    }

    const CheckboxComponent = componentRegistry?.['checkbox'] as React.ElementType;

    if (typeof data === 'boolean') {
        if (renderAs === 'checkbox') {
            if (data) {
                if (CheckboxComponent) {
                    return <div className="flex justify-center"><CheckboxComponent checked={true} disabled/></div>;
                }
                return <div className="flex justify-center"><input type="checkbox" checked={true} disabled
                                                                   className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"/>
                </div>;
            }
            return null; // Không hiển thị gì nếu giá trị là false
        }
        return <span
            className={`font-medium ${data ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{data ? 'Yes' : 'No'}</span>;
    }

    if (typeof data !== 'object') {
        // Dành cho string, number, etc.
        let content: JSX.Element;
        let isLink = false;

        if (typeof data === 'string') {
            const lowercasedData = data.toLowerCase();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
            const isImageUrl = imageExtensions.some(ext => lowercasedData.endsWith(ext)) || lowercasedData.startsWith('data:image/');
            const isHttpUrl = lowercasedData.startsWith('http://') || lowercasedData.startsWith('https://');

            if (renderAs === 'image' || (!renderAs && isImageUrl)) {
                content = (
                    <a href={data} target="_blank" rel="noopener noreferrer" title="Click to open in new tab"
                       className="inline-flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={data}
                            alt="Preview"
                            className={`max-w-[100px] h-auto object-cover hover:scale-110 transition-transform duration-200 ease-in-out ${className || ''}`}
                        />
                    </a>
                );
                isLink = true;
            } else if (renderAs === 'video') {
                content = <video src={data} controls className="max-w-[250px] rounded-md"/>;
            } else if (renderAs === 'url' || (!renderAs && isHttpUrl)) {
                content = (
                    <a href={data} target="_blank" rel="noopener noreferrer"
                       className="text-blue-500 hover:underline dark:text-blue-400"
                       onClick={(e) => e.stopPropagation()}>
                        {data}
                    </a>
                );
                isLink = true;
            } else {
                // Default to text for string, including renderAs === 'text'
                content = <span className={'break-words'}>{String(data)}</span>;
            }
        } else {
            // Default for number, etc.
            content = <span className={'break-words'}>{String(data)}</span>;
        }

        // Apply `clickable` prop if the content is not already a link
        if (clickable && !isLink && data) {
            return (
                <a href={String(data)} target="_blank" rel="noopener noreferrer"
                   className="text-blue-500 hover:underline dark:text-blue-400"
                   onClick={(e) => e.stopPropagation()}>
                    {content}
                </a>
            );
        }

        return content;
    }

    // --- Trường hợp đệ quy: Array ---
    if (Array.isArray(data)) {
        if (data.length === 0) {
            return <span className="italic text-gray-500 dark:text-gray-400">Empty List</span>;
        }

        const firstItem = data[0];
        const isArrayOfObjects = typeof firstItem === 'object' && firstItem !== null;

        // Nếu là mảng các object, tạo bảng nhiều cột
        if (isArrayOfObjects) {
            const hasActions = rowActions && rowActions.length > 0;
            let headers: DataPathFieldConfig[];

            // Nếu có dataPathFields, nó sẽ quyết định các cột.
            // Ngược lại, tự động phát hiện các cột từ key của object.
            if (dataPathFields && dataPathFields.length > 0) {
                headers = dataPathFields;
            } else {
                const autoHeaders = Array.from(new Set(data.flatMap(item => (typeof item === 'object' && item !== null) ? Object.keys(item) : [])));
                headers = autoHeaders.map(h => ({path: h})); // `as` is undefined, allowing auto-detection
            }

            const colSpan = (showRowNumber ? 1 : 0) + (selectOnRowClick && rowKeyField ? 1 : 0) + headers.length + (hasActions ? 1 : 0);

            return (
                <div className="border rounded-md bg-muted/20 my-1 dark:border-gray-700 dark:bg-gray-800/20">
                    <table className="w-full text-sm">
                        {(showDataTableHeaders ?? true) && (
                            <thead className="bg-muted/40 dark:bg-gray-700/40">
                            <tr className="border-b dark:border-gray-700">
                                {showRowNumber && (
                                    <th className="p-2 w-12 text-center font-semibold text-foreground">#</th>
                                )}
                                {selectOnRowClick && rowKeyField && (
                                    <th className="p-2 w-4"></th>
                                )}
                                {headers.map(headerConfig => (
                                    <th key={headerConfig.path}
                                        className={`p-2 text-center font-semibold text-foreground break-words max-w-[250px] ${headerConfig.className || ''}`}>
                                        {headerConfig.title ?? startCase(headerConfig.path)}
                                    </th>
                                ))}
                                {hasActions && (
                                    <th className="p-2 text-center font-semibold text-foreground">Actions</th>
                                )}
                            </tr>
                            </thead>
                        )}
                        <tbody>
                        {data.map((item, index) => {
                            const key = rowKeyField ? getValueByPath(item, rowKeyField) : undefined;
                            const isSelected = key !== undefined && !!selectedKeys?.has(key);

                            return (
                                <tr key={index}
                                    className={`border-b last:border-b-0 hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-gray-700/50 ${(onRowClick || (selectOnRowClick && rowKeyField)) ? 'cursor-pointer' : ''} ${isSelected ? selectedRowClassName || '' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Handle selection toggle if enabled
                                        if (selectOnRowClick && rowKeyField && onSelectionChange) {
                                            const key = getValueByPath(item, rowKeyField);
                                            if (key !== undefined) {
                                                const isCurrentlySelected = selectedKeys?.has(key) ?? false;
                                                onSelectionChange(item, !isCurrentlySelected);
                                            }
                                        }
                                        // Always call the user's onRowClick if provided
                                        if (onRowClick) {
                                            onRowClick(item);
                                        }
                                    }}>
                                    {showRowNumber && (
                                        <td className="p-2 align-middle text-center text-muted-foreground">{index + 1}</td>
                                    )}
                                    {selectOnRowClick && rowKeyField && (
                                        <td className="p-2 align-middle text-center">
                                            <div className="flex justify-center">
                                                {CheckboxComponent ? (
                                                    <CheckboxComponent
                                                        checked={isSelected}
                                                        onCheckedChange={(checked: boolean) => onSelectionChange?.(item, checked)}
                                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => onSelectionChange?.(item, e.target.checked)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    {headers.map(headerConfig => (
                                        <td key={headerConfig.path}
                                            className={`p-2 align-middle text-center text-muted-foreground break-words max-w-[250px] ${headerConfig.as !== 'image' ? headerConfig.className || '' : ''}`}>
                                            {/* Lấy giá trị theo path nếu header là dạng nested */}
                                            {/* Không truyền rowActions xuống dưới để tránh lặp lại cột action trong bảng con */}
                                            <RecursiveRenderer data={getValueByPath(item, headerConfig.path)}
                                                               renderAs={headerConfig.as} onRowClick={onRowClick}
                                                               clickable={headerConfig.clickable}
                                                               className={headerConfig.className}
                                                               componentRegistry={componentRegistry}/>
                                        </td>
                                    ))}
                                    {hasActions && (
                                        <td className="p-2 align-middle">
                                            <div className="flex items-center gap-2">
                                                {rowActions.map((action, actionIndex) => {
                                                    if (action.type === 'button') {
                                                        return <RowActionButton key={actionIndex} action={action}
                                                                                rowData={item}
                                                                                componentRegistry={componentRegistry}/>
                                                    }
                                                    if (action.type === 'checkbox') {
                                                        if (!action.initialCheckedField && process.env.NODE_ENV === 'development') {
                                                            console.warn(`[DataDisplayTable] Checkbox action should have an 'initialCheckedField' to determine its state.`, {
                                                                action,
                                                                item
                                                            });
                                                        }
                                                        return <RowActionCheckbox
                                                            key={actionIndex}
                                                            action={action}
                                                            rowData={item}
                                                            componentRegistry={componentRegistry}
                                                        />;
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {InfiniteLoading && (
                            <tr>
                                <td colSpan={colSpan} className="p-0"><InfiniteLoading/></td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Nếu là mảng các giá trị đơn, tạo bảng một cột
        return (
            <div className="border rounded-md bg-muted/20 my-1 dark:border-gray-700 dark:bg-gray-800/20">
                <table className="w-full text-sm">
                    {(showDataTableHeaders ?? true) && (
                        <thead className="bg-muted/40 dark:bg-gray-700/40">
                        <tr className="border-b dark:border-gray-700">
                            {showRowNumber && (
                                <th className="p-2 w-12 text-center font-semibold text-foreground">#</th>
                            )}
                            <th className="p-2 text-center font-semibold text-foreground">Value</th>
                        </tr>
                        </thead>
                    )}
                    <tbody>
                    {data.map((item, index) => (
                        <tr key={index}
                            className={`border-b last:border-b-0 hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-gray-700/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                            onClick={(e) => {
                                // Selection on row click is not supported for simple arrays as they lack a stable key.
                                // However, the onRowClick prop is still supported.
                                if (onRowClick) {
                                    e.stopPropagation();
                                    onRowClick(item);
                                }
                            }}>
                            {showRowNumber && (
                                <td className="p-2 align-middle text-center text-muted-foreground">{index + 1}</td>
                            )}
                            <td className="p-2 align-middle text-center text-muted-foreground break-words">
                                {/* Đệ quy ở đây, không truyền showableFields xuống cấp dưới */}
                                <RecursiveRenderer data={item} onRowClick={onRowClick}
                                                   selectOnRowClick={selectOnRowClick}
                                                   componentRegistry={componentRegistry}/>
                            </td>
                        </tr>
                    ))}
                    {InfiniteLoading && (
                        <tr>
                            <td colSpan={showRowNumber ? 2 : 1} className="p-0"><InfiniteLoading/></td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

        );
    }

    // --- Trường hợp đệ quy: Object ---
    if (Object.keys(data).length === 0) {
        return <span className="italic text-gray-500 dark:text-gray-400">Empty Object</span>;
    }

    return (
        <div className="border rounded-md bg-muted/20 my-1 dark:border-gray-700 dark:bg-gray-800/20">
            <table className="w-full text-sm align-top">
                <tbody>
                {Object.entries(data)
                    .filter(([key]) => {
                        // Nếu không có dataPathFields, hiển thị tất cả.
                        if (!dataPathFields || dataPathFields.length === 0) {
                            return true;
                        }
                        // Ngược lại, chỉ hiển thị các key khớp hoặc là prefix của một path trong dataPathFields.
                        return dataPathFields.some(field => field.path === key || field.path.startsWith(key + '.'));
                    })
                    .map(([key, value]) => {
                        // Tìm cấu hình render cho key hiện tại
                        const fieldConfig = dataPathFields?.find(f => f.path === key);

                        // Tính toán dataPathFields mới cho cấp đệ quy tiếp theo.
                        const newDataPathFields = dataPathFields
                            ?.filter(field => field.path.startsWith(key + '.'))
                            .map(field => ({
                                ...field,
                                path: field.path.substring(key.length + 1)
                            }))
                            .filter(field => field.path); // Bỏ các chuỗi rỗng

                        return (
                            <tr key={key}
                                className={`border-b last:border-b-0 hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-gray-700/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                                onClick={(e) => {
                                    // Selection on row click is not supported for object key-value pairs.
                                    // The onRowClick prop is still supported.
                                    if (onRowClick) {
                                        e.stopPropagation();
                                        onRowClick({[key]: value});
                                    }
                                }}>
                                <th className="p-2 text-left font-semibold text-foreground capitalize w-1/3 break-words">
                                    {key.replace(/_/g, ' ')}
                                </th>
                                <td className="p-2 text-muted-foreground break-words">
                                    {/* Đệ quy ở đây, truyền showableFields đã được xử lý cho cấp dưới */}
                                    <RecursiveRenderer data={value}
                                                       renderAs={fieldConfig?.as}
                                                       clickable={fieldConfig?.clickable}
                                                       className={fieldConfig?.className}
                                                       dataPathFields={newDataPathFields && newDataPathFields.length > 0 ? newDataPathFields : undefined}
                                                       onRowClick={onRowClick}
                                                       selectOnRowClick={selectOnRowClick}
                                                       componentRegistry={componentRegistry}/>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


/**
 * Component chính, đóng vai trò là điểm bắt đầu cho việc render đệ quy.
 * Tự động tách và hiển thị dữ liệu chính và các thông tin phụ từ response.
 */
export const DataDisplayTable = (
    {
        response,
        dataPath,
        title,
        dataPathFields,
        showResponseDetailsHeader = false,
        showDataTableHeaders = true,
        showRowNumber = false,
        onRowClick,
        rowActions,
        rowKeyField,
        onSelectionChange,
        tableActions,
        selectOnRowClick,
        selectedRowClassName,
        componentRegistry,
        selectedKeys = new Set(),
        rootRefSetter,
        handleRootScroll,
        InfiniteLoading,
    }: {
        response: any,
        dataPath?: string,
        title?: string,
        dataPathFields?: DataPathFieldConfig[],
        showResponseDetailsHeader?: boolean,
        showDataTableHeaders?: boolean,
        showRowNumber?: boolean,
        onRowClick?: (rowData: any) => void,
        rowActions?: RowAction[],
        rowKeyField?: string,
        onSelectionChange?: (row: any, isChecked: boolean) => void;
        tableActions?: TableAction[],
        selectOnRowClick?: boolean,
        selectedRowClassName?: string,
        componentRegistry?: Record<string, React.ComponentType<any>>,
        selectedKeys?: Set<any>,
        rootRefSetter?: (node: HTMLDivElement | null) => void,
        handleRootScroll?: () => void,
        InfiniteLoading?: React.ComponentType<any>,
    }) => {

    const isComplexResponse = dataPath && typeof response === 'object' && response !== null && !Array.isArray(response);
    const mainData = isComplexResponse ? getValueByPath(response, dataPath) : response;

    const selectedRows = useMemo(() => {
        if (!rowKeyField || !Array.isArray(mainData)) return [];
        return mainData.filter(row => {
            const key = getValueByPath(row, rowKeyField);
            return key !== undefined && selectedKeys.has(key);
        });
    }, [mainData, selectedKeys, rowKeyField]);

    const hasSelection = selectedKeys.size > 0;

    const tableActionsToolbar = tableActions && tableActions.length > 0 && (
        <div className="flex items-center gap-2">
            {tableActions.map((action, index) => (
                <TableActionButton
                    key={action.key || index}
                    action={action}
                    selection={{selectedKeys, selectedRows}}
                    componentRegistry={componentRegistry}
                />
            ))}
        </div>
    );

    // Nếu không phải là response phức tạp cần tách, render toàn bộ
    if (!isComplexResponse) {
        return (
            <div className="w-full" ref={rootRefSetter} onScroll={handleRootScroll}>
                <div className="flex justify-between items-center mb-4">
                    {title ? (
                        <h4 className="text-lg font-medium text-foreground">{title}</h4>
                    ) : (
                        <div/> /* Placeholder to push toolbar to the right */
                    )}
                    {tableActionsToolbar}
                </div>
                <div className="rounded-lg">
                    <RecursiveRenderer data={response}
                                       dataPathFields={dataPathFields}
                                       onRowClick={onRowClick}
                                       rowActions={rowActions}
                                       rowKeyField={rowKeyField}
                                       selectedKeys={selectedKeys}
                                       onSelectionChange={onSelectionChange}
                                       selectOnRowClick={selectOnRowClick}
                                       selectedRowClassName={selectedRowClassName}
                                       componentRegistry={componentRegistry}
                                       showDataTableHeaders={showDataTableHeaders}
                                       showRowNumber={showRowNumber}
                                       InfiniteLoading={InfiniteLoading}
                    />
                </div>
            </div>
        );
    }

    // Tách dữ liệu chính và các thông tin phụ
    const otherData = JSON.parse(JSON.stringify(response)); // Clone để không ảnh hưởng object gốc
    unsetByPath(otherData, dataPath);
    const hasOtherData = Object.keys(otherData).length > 0;

    // Tạo tiêu đề dễ đọc cho phần dữ liệu chính
    const mainDataTitle = title ?? startCase(dataPath.split('.').join(' '));

    return (
        <div className="w-full" ref={rootRefSetter} onScroll={handleRootScroll}>
            {showResponseDetailsHeader && (
                <div className="flex justify-between items-center mb-4">
                    {/*<h3 className="text-xl font-semibold text-foreground">*/}
                    {/*    Submission Result*/}
                    {/*</h3>*/}
                </div>
            )}
            <div className="space-y-6 rounded-lg overflow-x-auto">
                {/* Hiển thị các thông tin phụ của response */}
                {showResponseDetailsHeader && hasOtherData && (
                    <div>
                        <h4 className="text-lg font-medium text-foreground mb-2 pb-2 border-b dark:border-gray-700">Response
                            Details</h4>
                        {/* Actions không áp dụng cho phần details phụ */}
                        <RecursiveRenderer data={otherData} onRowClick={onRowClick}
                                           componentRegistry={componentRegistry}
                                           showDataTableHeaders={showDataTableHeaders}
                                           showRowNumber={showRowNumber}/>
                    </div>
                )}

                {/* Hiển thị dữ liệu chính nếu có */}
                {mainData !== undefined && (
                    <div>
                        <div className="flex justify-between items-center mb-2 pb-2 border-b dark:border-gray-700">
                            <h4 className="text-lg font-medium text-foreground">{mainDataTitle}</h4>
                            <div className="flex items-center gap-4">
                                {tableActionsToolbar}
                            </div>
                        </div>
                        <RecursiveRenderer data={mainData}
                                           dataPathFields={dataPathFields}
                                           onRowClick={onRowClick}
                                           rowActions={rowActions}
                                           rowKeyField={rowKeyField}
                                           selectedKeys={selectedKeys}
                                           onSelectionChange={onSelectionChange}
                                           selectOnRowClick={selectOnRowClick}
                                           selectedRowClassName={selectedRowClassName}
                                           componentRegistry={componentRegistry}
                                           showDataTableHeaders={showDataTableHeaders}
                                           showRowNumber={showRowNumber}
                                           InfiniteLoading={InfiniteLoading}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
