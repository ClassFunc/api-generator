// /Users/lethanh/WebstormProjects/audits-web/components/InputForm/DataDisplayTable.tsx
import {startCase} from "lodash";
import React, {JSX, useState} from "react";

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

/**
 * Cấu hình cho một trường có thể hiển thị, bao gồm đường dẫn và cách render.
 */
export type DataPathFieldConfig = {
    path: string;
    as?: 'text' | 'image' | 'video' | 'url';
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
        renderAs
    }: {
        data: any,
        dataPathFields?: DataPathFieldConfig[],
        renderAs?: DataPathFieldConfig['as']
    }): JSX.Element | null => {
    // --- Các trường hợp cơ bản (điểm dừng của đệ quy) ---
    if (data === null || data === undefined) {
        return <span className="italic text-gray-500">Not Provided</span>;
    }

    if (typeof data === 'boolean') {
        return <span className="font-medium">{data ? 'Yes' : 'No'}</span>;
    }

    if (typeof data !== 'object') {
        // Dành cho string, number,...
        if (typeof data === 'string') {
            // Ưu tiên render theo chỉ định `as`
            if (renderAs === 'image') {
                return (
                    <a href={data} target="_blank" rel="noopener noreferrer" title="Click to open in new tab">
                        <img
                            src={data}
                            alt="Preview"
                            className="max-w-[100px] h-auto rounded-md object-cover hover:scale-110 transition-transform duration-200 ease-in-out"
                        />
                    </a>
                );
            }
            if (renderAs === 'video') {
                return (
                    <video src={data} controls className="max-w-[250px] rounded-md"/>
                );
            }
            if (renderAs === 'text') {
                return <span className={'truncate'}>{String(data)}</span>;
            }

            // Tự động phát hiện nếu không có chỉ định `as` hoặc `as` là 'url'
            const lowercasedData = data.toLowerCase();
            // 1. Kiểm tra xem có phải là URL hình ảnh không (bao gồm cả base64)
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
            const isImageUrl = imageExtensions.some(ext => lowercasedData.endsWith(ext)) || lowercasedData.startsWith('data:image/');

            if (isImageUrl) {
                return (
                    <a href={data} target="_blank" rel="noopener noreferrer" title="Click to open in new tab">
                        <img
                            src={data}
                            alt="Preview"
                            className="max-w-[100px] h-auto rounded-md object-cover hover:scale-110 transition-transform duration-200 ease-in-out"
                        />
                    </a>
                );
            }

            // 2. Kiểm tra xem có phải là một URL thông thường không
            const isUrl = renderAs === 'url' || (!renderAs && (lowercasedData.startsWith('http://') || lowercasedData.startsWith('https://')));
            if (isUrl) {
                return (
                    <a href={data} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        {data}
                    </a>
                );
            }
        }
        // 3. Mặc định: hiển thị dưới dạng văn bản
        return <span className={'truncate'}>{String(data)}</span>;
    }

    // --- Trường hợp đệ quy: Array ---
    if (Array.isArray(data)) {
        if (data.length === 0) {
            return <span className="italic text-gray-500">Empty List</span>;
        }

        const firstItem = data[0];
        const isArrayOfObjects = typeof firstItem === 'object' && firstItem !== null;

        // Nếu là mảng các object, tạo bảng nhiều cột
        if (isArrayOfObjects) {
            let headers: DataPathFieldConfig[];

            // Nếu có dataPathFields, nó sẽ quyết định các cột.
            // Ngược lại, tự động phát hiện các cột từ key của object.
            if (dataPathFields && dataPathFields.length > 0) {
                headers = dataPathFields;
            } else {
                const autoHeaders = Array.from(new Set(data.flatMap(item => (typeof item === 'object' && item !== null) ? Object.keys(item) : [])));
                headers = autoHeaders.map(h => ({path: h})); // `as` is undefined, allowing auto-detection
            }

            return (
                <div className="border rounded-md bg-muted/20 my-1">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                        <tr className="border-b">
                            {headers.map(headerConfig => (
                                <th key={headerConfig.path}
                                    className="p-2 text-left font-semibold text-foreground capitalize break-words max-w-[250px]">
                                    {/* Hiển thị header dễ đọc hơn, thay . và _ bằng khoảng trắng */}
                                    {headerConfig.path.replace(/_/g, ' ').replace(/\./g, ' ')}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {data.map((item, index) => (
                            <tr key={index} className="border-b last:border-b-0 hover:bg-muted/30">
                                {headers.map(headerConfig => (
                                    <td key={headerConfig.path}
                                        className="p-2 align-top text-muted-foreground break-words max-w-[250px]">
                                        {/* Lấy giá trị theo path nếu header là dạng nested */}
                                        <RecursiveRenderer data={getValueByPath(item, headerConfig.path)}
                                                           renderAs={headerConfig.as}/>
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Nếu là mảng các giá trị đơn, tạo bảng một cột
        return (
            <div className="border rounded-md bg-muted/20 my-1">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                    <tr className="border-b">
                        <th className="p-2 text-left font-semibold text-foreground">Value</th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.map((item, index) => (
                        <tr key={index} className="border-b last:border-b-0 hover:bg-muted/30">
                            <td className="p-2 align-top text-muted-foreground break-words">
                                {/* Đệ quy ở đây, không truyền showableFields xuống cấp dưới */}
                                <RecursiveRenderer data={item}/>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // --- Trường hợp đệ quy: Object ---
    if (Object.keys(data).length === 0) {
        return <span className="italic text-gray-500">Empty Object</span>;
    }

    return (
        <div className="border rounded-md bg-muted/20 my-1">
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
                            <tr key={key} className="border-b last:border-b-0 hover:bg-muted/30">
                                <th className="p-2 text-left font-semibold text-foreground capitalize w-1/3 break-words">
                                    {key.replace(/_/g, ' ')}
                                </th>
                                <td className="p-2 text-muted-foreground break-words">
                                    {/* Đệ quy ở đây, truyền showableFields đã được xử lý cho cấp dưới */}
                                    <RecursiveRenderer data={value}
                                                       renderAs={fieldConfig?.as}
                                                       dataPathFields={newDataPathFields && newDataPathFields.length > 0 ? newDataPathFields : undefined}/>
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
export const DataDisplayTable = ({
                                     response,
                                     dataPath,
                                     dataPathFields,
                                     showResponseDetails: initialShowDetails = false
                                 }: {
    response: any,
    dataPath?: string,
    dataPathFields?: DataPathFieldConfig[],
    showResponseDetails?: boolean
}) => {
    const [isDetailsVisible, setIsDetailsVisible] = useState(initialShowDetails);
    const isComplexResponse = dataPath && typeof response === 'object' && response !== null && !Array.isArray(response);

    // Nếu không phải là response phức tạp cần tách, render toàn bộ
    if (!isComplexResponse) {
        return (
            <div className="w-full">
                <h3 className="text-xl font-semibold text-foreground mb-4">
                    Submission Result
                </h3>
                <div className="rounded-lg">
                    <RecursiveRenderer data={response} dataPathFields={dataPathFields}/>
                </div>
            </div>
        );
    }

    // Tách dữ liệu chính và các thông tin phụ
    const mainData = getValueByPath(response, dataPath);
    const otherData = JSON.parse(JSON.stringify(response)); // Clone để không ảnh hưởng object gốc
    unsetByPath(otherData, dataPath);
    const hasOtherData = Object.keys(otherData).length > 0;

    // Tạo tiêu đề dễ đọc cho phần dữ liệu chính
    const mainDataTitle = startCase(dataPath.split('.').join(' '));

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-foreground">
                    Submission Result
                </h3>
                {hasOtherData && (
                    <button
                        onClick={() => setIsDetailsVisible(v => !v)}
                        className="text-sm font-medium text-primary hover:underline focus:outline-none"
                    >
                        {isDetailsVisible ? 'Hide Details' : 'Show Details'}
                    </button>
                )}
            </div>
            <div className="space-y-6 rounded-lg overflow-x-auto">
                {/* Hiển thị các thông tin phụ của response */}
                {isDetailsVisible && hasOtherData && (
                    <div>
                        <h4 className="text-lg font-medium text-foreground mb-2 pb-2 border-b">Response Details</h4>
                        <RecursiveRenderer data={otherData}/>
                    </div>
                )}

                {/* Hiển thị dữ liệu chính nếu có */}
                {mainData !== undefined && (
                    <div>
                        <h4 className="text-lg font-medium text-foreground mb-2 pb-2 border-b">{mainDataTitle}</h4>
                        <RecursiveRenderer data={mainData} dataPathFields={dataPathFields}/>
                    </div>
                )}
            </div>
        </div>
    );
};