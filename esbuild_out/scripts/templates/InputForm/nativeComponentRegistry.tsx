// /Users/lethanh/WebstormProjects/audits-web/components/InputForm/nativeComponentRegistry.tsx

import React from 'react';
// @ts-ignore
import defaultFormStyles from './InputForm.module.css';
import {IInputTypeSchema, UiMetadataSchema} from "./InputFormHelpers";
import {z} from "zod";

export interface NativeFormControlProps {
    tag?: z.infer<typeof UiMetadataSchema['shape']['component']>;
    type?: IInputTypeSchema,
    options?: { value: any; label: string }[];
    className?: string;
    label?: string;
    id?: string;
    [key: string]: any; // Để nhận các props từ register của react-hook-form
}

/**
 * Component đa năng để render các thẻ HTML form gốc (input, textarea, select).
 * Tự động xử lý việc hiển thị label cho các control như radio và checkbox.
 */
export const NativeFormControl = ({
                                      tag: Tag = 'input',
                                      type,
                                      options,
                                      className,
                                      label,
                                      id,
                                      ...props
                                  }: NativeFormControlProps) => {

    // --- Case 1: Render một checkbox hoặc radio button đơn lẻ với label ---
    // Logic này được kích hoạt khi InputForm render một checkbox/switch đơn lẻ,
    // hoặc khi lặp qua các lựa chọn để render một nhóm radio.
    if ((type === 'radio' || type === 'checkbox' || type === 'switch') && label && id) {
        const isRadio = type === 'radio';
        const wrapperClass = isRadio ? defaultFormStyles.radioWrapper : defaultFormStyles.checkboxWrapper;
        const inputClass = isRadio ? defaultFormStyles.radio : defaultFormStyles.checkbox;
        const labelClass = isRadio ? defaultFormStyles.radioLabel : defaultFormStyles.checkboxLabel;

        // Switch về bản chất là một checkbox, nên type của input vẫn là 'checkbox'
        const inputType = type === 'switch' ? 'checkbox' : type;

        return (
            <div className={wrapperClass}>
                <input
                    {...props}
                    id={id}
                    type={inputType}
                    className={`${inputClass} ${className || ''}`.trim()}
                />
                <label htmlFor={id} className={labelClass}>
                    {label}
                </label>
            </div>
        );
    }

    // --- Case 2: Render thẻ <select> ---
    if (Tag === 'select') {
        const finalClassName = `${defaultFormStyles.select} ${className || ''}`.trim();
        return (
            <select {...props} id={id} className={finalClassName}>
                {props.placeholder && <option value="">{props.placeholder}</option>}
                {options?.map((option, index) => (
                    <option key={option.value !== undefined ? String(option.value) : index} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    // --- Case 3: Render các thẻ input/textarea thông thường ---
    const finalClassName = `${defaultFormStyles[Tag] || defaultFormStyles.input} ${className || ''}`.trim();
    // @ts-ignore
    return <Tag {...props} id={id} type={type} className={finalClassName}/>;
};


// --- Đăng ký các component native ---
// Registry giờ đây chỉ cần trỏ đến NativeFormControl đa năng.
// Nó sẽ nhận `tag` và `type` từ InputForm để render chính xác.
export const nativeComponentRegistry: Record<string, React.ComponentType<any>> = {
    'input': (props: any) => <NativeFormControl {...props} tag="input"/>,
    'textarea': (props: any) => <NativeFormControl {...props} tag="textarea"/>,
    'select': (props: any) => <NativeFormControl {...props} tag="select"/>,

    // Chuyển đổi 'checkbox' và 'switch' thành <input type="checkbox" />
    'checkbox': (props: any) => <NativeFormControl {...props} tag="input" type="checkbox"/>,
    'switch': (props: any) => <NativeFormControl {...props} tag="input" type="switch"/>,

    // Không cần 'radio' ở đây vì InputForm đã xử lý bằng cách truyền trực tiếp
    // tag="input" và type="radio" cho ResolvedComponent.
};