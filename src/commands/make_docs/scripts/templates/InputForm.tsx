'use client';

import {FieldValues, Path, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {get, isArray, startCase} from 'lodash';
import React, {JSX, ReactNode, useCallback, useEffect, useRef, useTransition} from 'react'; // +++ IMPORT useRef

import {getAuthToken, getHtmlInputType, getUiMetadata, getZodInnerType, resolvePlaceholders} from './InputFormHelpers';
// @ts-ignore
import defaultFormStyles from './InputForm.module.css';
import {atom, useAtom} from "jotai";

export const dynamicOptionsAtom = atom<Record<string, any[]>>({});

/**
 * Atom để theo dõi trạng thái loading của từng field khi đang fetch options.
 * Ví dụ: { city: true }
 */
export const fieldLoadingAtom = atom<Record<string, boolean>>({});


// --- Định nghĩa Types cho Props ---
type SubmitHook<TData extends FieldValues> = (options?: { fireImmediately?: boolean }) => {
    fire: (data: TData) => Promise<any>;
    loading: boolean;
    error: Error | null;
    data: any;
};

// NEW: Định nghĩa kiểu cho tất cả các class style có thể có
// Nó bao gồm các style từ CSS Module và các style được định nghĩa inline (Tailwind)
// Định nghĩa tất cả các "key" style có thể có
type AllStyleKeys = keyof typeof defaultFormStyles | 'submitButton' | 'successMessage';
// Tạo một type yêu cầu tất cả các key phải có giá trị string
type AllStyles = { [K in AllStyleKeys]: string };
// Prop `customStyles` là một phần của AllStyles
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
    const isBusy = isPending || hookLoading;
    const [dynamicOptions, setDynamicOptions] = useAtom(dynamicOptionsAtom);
    const [fieldLoading, setFieldLoading] = useAtom(fieldLoadingAtom)

    // +++ NEW: Ref để đảm bảo các effect ban đầu chỉ chạy một lần
    const initialEffectsRan = useRef(false);

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
        formState: {errors: formValidationErrors, isSubmitted},
        watch,
        setValue,
        getValues,
    } = useForm<TData>({
        resolver: zodResolver(formSchema as any),
        defaultValues: defaultValues as any,
    });

    const runEffectsFor = useCallback((changedFieldName: string, allFormValues: TData) => {
        Object.entries(formSchema.shape).forEach(([targetFieldName, targetFieldSchema]) => {
            const ui = getUiMetadata(targetFieldSchema as any);
            if (!ui?.effects) return;

            ui.effects.forEach(async effect => {
                if (effect.listensTo === changedFieldName) {
                    console.log(`[Effect Triggered] Field '${targetFieldName}' is listening to '${changedFieldName}'.`);

                    const listenedValue = get(allFormValues, changedFieldName);

                    setValue(targetFieldName as Path<TData>, '' as any, {shouldValidate: true});
                    setDynamicOptions(prev => ({...prev, [targetFieldName]: []}));

                    if (!listenedValue) {
                        setFieldLoading(prev => ({...prev, [targetFieldName]: false}));
                        return;
                    }
                    const currentFormValues = getValues();

                    if (effect.action === 'fetchOptions') {
                        setFieldLoading(prev => ({...prev, [targetFieldName]: true}));

                        const token = await getAuthToken();
                        const headers: HeadersInit = {
                            'Content-Type': 'application/json',
                            ...resolvePlaceholders(effect.headers, currentFormValues),
                        } as Record<string, any>;
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }

                        const requestOptions: RequestInit = {
                            method: effect.method || 'POST',
                            headers: headers,
                        };

                        if (requestOptions.method !== 'GET' && effect.body) {
                            requestOptions.body = JSON.stringify(resolvePlaceholders(effect.body, currentFormValues));
                        }

                        fetch(effect.endpoint, requestOptions)
                            .then(res => res.json())
                            .then(data => {
                                let optionsData = effect.optionsPath ? get(data, effect.optionsPath) : data;
                                if (!isArray(optionsData)) {
                                    console.warn(`[DynamicForm] Expected an array for field '${targetFieldName}'...`);
                                    optionsData = [];
                                }
                                setDynamicOptions(prev => ({...prev, [targetFieldName]: optionsData}));
                            })
                            .catch(err => {
                                console.error(`Failed to fetch options for ${targetFieldName}:`, err);
                                setDynamicOptions(prev => ({...prev, [targetFieldName]: []}));
                            })
                            .finally(() => {
                                setFieldLoading(prev => ({...prev, [targetFieldName]: false}));
                            });
                    }
                }
            });
        });
    }, [formSchema, getValues, setDynamicOptions, setFieldLoading, setValue]);


    // +++ MODIFIED: Effect để chạy các side-effect cho giá trị mặc định KHI MOUNT +++
    useEffect(() => {
        // Chỉ chạy effect này một lần duy nhất khi component mount,
        // ngay cả trong React Strict Mode (chạy 2 lần ở dev).
        // Ref `initialEffectsRan` sẽ giữ nguyên giá trị qua các lần re-render
        // và cả chu trình unmount/remount của Strict Mode.
        if (initialEffectsRan.current === false) {
            console.log("[DynamicForm] Component mounted. Running initial effects for the first time...");
            if (defaultValues) {
                const initialFormValues = getValues();
                Object.keys(defaultValues).forEach(fieldName => {
                    // Chỉ chạy effect nếu field đó có giá trị mặc định
                    if (initialFormValues[fieldName]) {
                        runEffectsFor(fieldName, initialFormValues);
                    }
                });
            }
            // Đánh dấu là đã chạy để ngăn việc chạy lại
            initialEffectsRan.current = true;
        }
        // Dependency array vẫn giữ nguyên để đảm bảo runEffectsFor là phiên bản mới nhất,
        // nhưng logic bên trong sẽ ngăn việc chạy lại.
    }, [runEffectsFor, defaultValues, getValues]);


    useEffect(() => {
        const subscription = watch((value, {name, type}) => {
            if (!name || type !== 'change') return;
            runEffectsFor(name, getValues());
        });
        return () => subscription.unsubscribe();
    }, [watch, getValues, runEffectsFor]);


    useEffect(() => {
        return () => {
            setDynamicOptions({});
            setFieldLoading({});
        };
    }, [setDynamicOptions, setFieldLoading]);

    const handleFormSubmit = (formData: TData) => {
        startTransition(async () => {
            try {
                const result = await fire(formData);
                onSuccess?.(result);
            } catch (e) {
                console.error("Form submission caught an error:", e);
            }
        });
    };

    const shouldShowStatusMessage = isSubmitted && !isBusy;

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
        const isLoading = fieldLoading[key];

        let finalOptions: any[] = [];
        if (dynamicOptions[key]) {
            finalOptions = dynamicOptions[key];
        } else if (uiConfig.options) {
            finalOptions = uiConfig.options;
        } else if (coreType instanceof z.ZodEnum) {
            finalOptions = coreType.options.map((val: any) => ({ value: val, label: val }));
        }

        if (componentType === 'select' || coreType instanceof z.ZodEnum) {
            fieldElement = (
                <select id={key} {...register(formKey)}
                        className={inputClassName} {...uiConfig.inputProps} disabled={isLoading}>
                    <option value="">{isLoading ? 'Loading...' : (uiConfig.placeholder || 'Pick one value...')}</option>
                    {finalOptions.map((option: any) => {
                        const value = typeof option === 'object' ? option.value : option;
                        const label = typeof option === 'object' ? option.label : option;
                        return <option key={value} value={value}>{label}</option>
                    })}
                </select>
            );
        } else {
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
                            {isLoading && <span>Đang tải...</span>}
                            {!isLoading && finalOptions.map(option => (
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
                            {isLoading && <span>Đang tải...</span>}
                            {!isLoading && finalOptions.map(option => (
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
                    break;
            }
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
                {shouldShowStatusMessage && !error && data && (
                    <p className={styles.successMessage}>{successMessage}</p>
                )}
            </form>
        </div>
    );
}