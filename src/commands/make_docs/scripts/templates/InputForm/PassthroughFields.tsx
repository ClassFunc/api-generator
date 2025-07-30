'use client';

import {useFieldArray, useFormContext} from 'react-hook-form';
import React from 'react';

interface PassthroughFieldsProps {
    namePrefix: string;
}

export function PassthroughFields({namePrefix}: PassthroughFieldsProps) {
    const {control, register} = useFormContext();
    const name = `${namePrefix}.__additionalFields`;

    const {fields, append, remove} = useFieldArray({
        control,
        name,
    });

    // Các lớp CSS cơ bản để style cho thẻ HTML thông thường
    const inputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2";
    // const labelClasses = "block text-xs font-medium text-gray-500";
    const addButtonClasses = "inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";
    const removeButtonClasses = "inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-red-600 hover:bg-red-50 h-9 w-9";

    return (
        <div className="col-span-full mt-4 space-y-4">
            {fields.length > 0 && (
                <label className="text-sm font-medium text-gray-900">Additional Parameters</label>
            )}
            {fields.map((field, index) => (
                <div key={field.id} className="flex flex-row items-center gap-2 p-2 border rounded-md border-gray-300 shadow-sm">
                    <input
                        id={`${name}.${index}.key`}
                        placeholder="Key"
                        className={inputClasses}
                        {...register(`${name}.${index}.key` as const)}
                    />
                    <input
                        id={`${name}.${index}.value`}
                        placeholder="Value"
                        className={inputClasses}
                        {...register(`${name}.${index}.value` as const)}
                    />
                    <button
                        type="button"
                        className={removeButtonClasses}
                        onClick={() => remove(index)}
                        aria-label="Remove parameter"
                    >
                        {/* Sử dụng ký tự '×' (multiplication sign) cho nút xóa */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            ))}
            <button
                type="button"
                className={addButtonClasses}
                onClick={() => append({key: '', value: ''})}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="-ml-1 mr-2 h-4 w-4">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Parameter
            </button>
        </div>
    );
}