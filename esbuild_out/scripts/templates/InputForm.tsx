'use client';

import {FieldValues, Path, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {startCase} from 'lodash';
import {JSX, ReactNode, useState, useTransition} from 'react';

import {getHtmlInputType, getUiMetadata, getZodInnerType} from './InputFormHelpers';
import defaultFormStyles from './InputForm.module.css';

// --- Định nghĩa Types cho Props ---
type SubmitHook<TData extends FieldValues> = (options?: { fireImmediately?: boolean }) => {
    fire: (data: TData) => Promise<any>;
    loading: boolean;
    error: Error | null;
    data: any;
};

// NEW: Định nghĩa kiểu cho tất cả các class style có thể có
// Nó bao gồm các style từ CSS Module và các style được định nghĩa inline (Tailwind)
type AllStyleKeys = keyof typeof defaultFormStyles | 'submitButton' | 'successMessage';
type AllStyles = { [K in AllStyleKeys]: string };

// Type cho customStyles giờ đây sẽ an toàn hơn
type CustomStyles = Partial<AllStyles>;

export interface DynamicFormProps<TData extends FieldValues> {
    formSchema: z.ZodObject<any, any, any>;
    useSubmitHook: SubmitHook<TData>;
    defaultValues?: TData;
    onSuccess?: (data: any) => void;
    submitButtonText?: string;
    loadingButtonText?: string;
    successMessage?: string;
    customStyles?: CustomStyles;
}

// --- Component DynamicForm ---
/* DynamicForm
usage:
// 1. Với CSS Module
import myCustomStyles from './MyForm.module.css';
<DynamicForm
    formSchema={mySchema}
    useSubmitHook={useMyApiHook}
    customStyles={myCustomStyles}
/>

// 2. Với Tailwind CSS (ghi đè từng phần)
<DynamicForm
    formSchema={mySchema}
    useSubmitHook={useMyApiHook}
    customStyles={{
        input: 'border-gray-500 rounded-full',
        submitButton: 'bg-purple-500 hover:bg-purple-600',
    }}
/>
* */
export function DynamicForm<TData extends FieldValues>({
                                                           formSchema,
                                                           useSubmitHook,
                                                           defaultValues,
                                                           onSuccess,
                                                           submitButtonText = 'Send',
                                                           loadingButtonText = 'Sending...',
                                                           successMessage = '',
                                                           customStyles = {},
                                                       }: DynamicFormProps<TData>) {
    const {fire, loading: hookLoading, error, data} = useSubmitHook({fireImmediately: false});
    const [isPending, startTransition] = useTransition();
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const isBusy = isPending || hookLoading;

    // Tạo một object chứa tất cả các style mặc định trước
    const allDefaultStyles: AllStyles = {
        ...defaultFormStyles,
        submitButton: "bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-300 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed",
        successMessage: "mt-4 text-green-600",
    };

    // Sau đó, trộn object mặc định với style tùy chỉnh.
    const styles: AllStyles = {
        ...allDefaultStyles,
        ...customStyles,
    } as AllStyles;

    const {
        register,
        handleSubmit,
        formState: {errors: formValidationErrors},
    } = useForm<TData>({
        resolver: zodResolver(formSchema as any),
        defaultValues: defaultValues as any,
    });

    const handleFormSubmit = (formData: TData) => {
        if (!hasSubmitted) setHasSubmitted(true);
        startTransition(async () => {
            try {
                const result = await fire(formData);
                onSuccess?.(result);
            } catch (e) {
                console.error("Form submission caught an error:", e);
            }
        });
    };

    const shouldShowStatusMessage = hasSubmitted && !isBusy;

    // --- Hàm Render Field ---
    const renderField = (key: string, schema: z.ZodTypeAny): JSX.Element => {
        const formKey = key as Path<TData>;
        const coreType = getZodInnerType(schema);
        const uiConfig = getUiMetadata(schema) || {};
        const componentType = uiConfig.component || 'input';
        const inputType = uiConfig.type || getHtmlInputType(schema);

        if (inputType === 'hidden') {
            return <input key={key} type="hidden" {...register(formKey)} />;
        }

        let fieldElement: ReactNode;
        const inputClassName = styles.input;

        switch (componentType) {
            case 'textarea':
                fieldElement = (
                    <textarea
                        id={key}
                        {...register(formKey)}
                        placeholder={uiConfig.placeholder || key}
                        className={inputClassName}
                        rows={4}
                        {...uiConfig.inputProps}
                    />
                );
                break;
            case 'radio':
                fieldElement = (
                    <div className={styles.fieldSet} role="radiogroup">
                        {(uiConfig.options || []).map(option => (
                            <label key={option.value} htmlFor={`${key}-${option.value}`}
                                   className={styles.optionLabel}>
                                <input type="radio" id={`${key}-${option.value}`}
                                       value={option.value} {...register(formKey)} {...uiConfig.inputProps} />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                );
                break;
            case 'checkbox':
                fieldElement = (
                    <div className={styles.fieldSet}>
                        {(uiConfig.options || []).map(option => (
                            <label key={option.value} htmlFor={`${key}-${option.value}`}
                                   className={styles.optionLabel}>
                                <input type="checkbox" id={`${key}-${option.value}`}
                                       value={option.value} {...register(formKey)} {...uiConfig.inputProps} />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                );
                break;
            default:
                if (coreType instanceof z.ZodEnum) {
                    fieldElement = (
                        <select id={key} {...register(formKey)}
                                className={inputClassName} {...uiConfig.inputProps}>
                            {coreType.options.map((optionValue: string) => (
                                <option key={optionValue} value={optionValue}>{optionValue}</option>
                            ))}
                        </select>
                    );
                } else {
                    fieldElement = (
                        <input
                            id={key}
                            type={inputType}
                            {...register(formKey, {valueAsNumber: coreType instanceof z.ZodNumber})}
                            placeholder={uiConfig.placeholder || key}
                            className={inputClassName}
                            {...uiConfig.inputProps}
                        />
                    );
                }
                break;
        }

        return (
            <div key={key} className={styles.formGroup}>
                <label htmlFor={key} className={styles.label}>
                    {uiConfig.label || startCase(key)}
                    {uiConfig.seeMoreLink && (
                        <a href={uiConfig.seeMoreLink} target="_blank" rel="noopener noreferrer"
                           className="ml-2 text-blue-500 hover:underline" title="Learn more">[?]</a>
                    )}
                </label>
                {fieldElement}
                {uiConfig.helperText && <p className={styles.helperText}>{uiConfig.helperText}</p>}
                {formValidationErrors[formKey] &&
                    <span className={styles.errorMessage}>{formValidationErrors[formKey]?.message as string}</span>}
            </div>
        );
    };

    return (
        <div className={styles.formContainer}>
            <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
                {Object.entries(formSchema.shape).map(([key, schema]) => renderField(key, schema as any))}

                <button type="submit" disabled={isBusy} className={styles.submitButton}>
                    {isBusy ? loadingButtonText : submitButtonText}
                </button>

                {shouldShowStatusMessage && error && (
                    <p className={styles.errorMessage}>{error.message}</p>
                )}
                {shouldShowStatusMessage && !error && (
                    <p className={styles.successMessage}>{successMessage}</p>
                )}
            </form>
        </div>
    );
}