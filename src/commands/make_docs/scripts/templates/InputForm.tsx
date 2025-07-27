// /Users/lethanh/WebstormProjects/audits-web/components/InputForm.tsx

'use client';

import {FieldValues, Path, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {get, isArray, startCase} from 'lodash';
import React, {JSX, ReactNode, useCallback, useEffect, useRef, useTransition} from 'react';

import {
    FetchConfig,
    getAuthToken,
    getHtmlInputType,
    getUiMetadata,
    getZodInnerType,
    resolvePlaceholders
} from './InputFormHelpers';
// @ts-ignore
import defaultFormStyles from './InputForm.module.css';
import {atom, useAtom} from "jotai";

export const dynamicOptionsAtom = atom<Record<string, any[]>>({});
export const fieldLoadingAtom = atom<Record<string, boolean>>({});

/**
 * Atom để theo dõi trạng thái tự động lưu của form.
 * Giúp hiển thị chỉ báo loading mà không xung đột với state của nút submit chính.
 */
export const formSavingAtom = atom(false);


// --- Types ---
type SubmitHook<TData extends FieldValues> = (options?: { fireImmediately?: boolean }) => {
    fire: (data: TData) => Promise<any>;
    loading: boolean;
    error: Error | null;
    data: any;
};

type AllStyleKeys = keyof typeof defaultFormStyles | 'submitButton' | 'successMessage';
type AllStyles = { [K in AllStyleKeys]: string };
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

// --- Component ---
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
    const [isSaving, setIsSaving] = useAtom(formSavingAtom);
    const isBusy = isPending || hookLoading || isSaving;

    const [dynamicOptions, setDynamicOptions] = useAtom(dynamicOptionsAtom);
    const [fieldLoading, setFieldLoading] = useAtom(fieldLoadingAtom);
    const initialEffectsRan = useRef(false);
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const styles: AllStyles = {
        ...defaultFormStyles,
        submitButton: "bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-300 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed",
        successMessage: "mt-4 text-green-600",
        ...customStyles,
    } as AllStyles;

    const {
        register,
        handleSubmit,
        formState: {errors: formValidationErrors, isSubmitted},
        watch,
        setValue,
        getValues,
        trigger, // Dùng để validate form một cách có chủ đích
    } = useForm<TData>({
        resolver: zodResolver(formSchema as any),
        defaultValues: defaultValues as any,
    });

    const fetchFieldOptions = useCallback(async (targetFieldName: string, fetchConfig: FetchConfig) => {
        setFieldLoading(prev => ({...prev, [targetFieldName]: true}));
        setDynamicOptions(prev => ({...prev, [targetFieldName]: []}));

        try {
            const token = await getAuthToken();
            const currentFormValues = getValues();
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                ...resolvePlaceholders(fetchConfig.headers, currentFormValues),
            } as Record<string, any>;
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const requestOptions: RequestInit = {method: fetchConfig.method || 'GET', headers};
            if (requestOptions.method !== 'GET' && fetchConfig.body) {
                requestOptions.body = JSON.stringify(resolvePlaceholders(fetchConfig.body, currentFormValues));
            }

            const response = await fetch(fetchConfig.endpoint, requestOptions);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const responseData = await response.json();

            let optionsData = fetchConfig.optionsPath ? get(responseData, fetchConfig.optionsPath) : responseData;
            if (!isArray(optionsData)) {
                console.warn(`[DynamicForm] Expected an array for field '${targetFieldName}'. Received:`, optionsData);
                optionsData = [];
            }
            setDynamicOptions(prev => ({...prev, [targetFieldName]: optionsData}));
        } catch (err) {
            console.error(`[DynamicForm] Failed to fetch options for ${targetFieldName}:`, err);
            setDynamicOptions(prev => ({...prev, [targetFieldName]: []}));
        } finally {
            setFieldLoading(prev => ({...prev, [targetFieldName]: false}));
        }
    }, [getValues, setDynamicOptions, setFieldLoading]);

    const runEffectsFor = useCallback((changedFieldName: string, allFormValues: TData) => {
        Object.entries(formSchema.shape).forEach(([targetFieldName, targetFieldSchema]) => {
            const ui = getUiMetadata(targetFieldSchema as any);
            if (!ui?.effects) return;

            ui.effects.forEach(effect => {
                if (effect.listensTo === changedFieldName) {
                    const listenedValue = get(allFormValues, changedFieldName);
                    setValue(targetFieldName as Path<TData>, '' as any, {shouldValidate: true});
                    setDynamicOptions(prev => ({...prev, [targetFieldName]: []}));

                    if (listenedValue && effect.action === 'fetchOptions') {
                        fetchFieldOptions(targetFieldName, effect);
                    } else {
                        setFieldLoading(prev => ({...prev, [targetFieldName]: false}));
                    }
                }
            });
        });
    }, [formSchema, setValue, setDynamicOptions, setFieldLoading, fetchFieldOptions]);

    const handleAutoSave = useCallback(async () => {
        const isValid = await trigger();
        if (!isValid) {

            return;
        }

        const formData = getValues();
        setIsSaving(true);
        const promise = fire(formData)
            .then(result => {
                onSuccess?.(result);
                return result; // Trả về result cho toast.promise
            })
            .catch(err => {
                console.error("[AutoSave] Submission caught an error:", err);
                throw err; // Ném lỗi để toast.promise bắt được
            })
            .finally(() => {
                setIsSaving(false);
            });

    }, [trigger, getValues, setIsSaving, fire, onSuccess]);

    useEffect(() => {
        const subscription = watch((value, {name, type}) => {
            if (!name || type !== 'change') return;

            // 1. Chạy các effect phụ thuộc
            runEffectsFor(name, getValues());

            // 2. Kiểm tra và kích hoạt auto-save
            const fieldSchema = formSchema.shape[name];
            if (!fieldSchema) return;

            const ui = getUiMetadata(fieldSchema);
            if (ui?.saveOnChange) {
                if (debounceTimers.current[name]) clearTimeout(debounceTimers.current[name]);
                debounceTimers.current[name] = setTimeout(() => {
                    handleAutoSave();
                }, 750); // Delay 750ms
            }
        });

        return () => {
            subscription.unsubscribe();
            Object.values(debounceTimers.current).forEach(clearTimeout); // Dọn dẹp timers khi unmount
        };
    }, [watch, getValues, runEffectsFor, formSchema.shape, handleAutoSave]);

    useEffect(() => {
        if (initialEffectsRan.current === false) {
            const initialFormValues = getValues();
            Object.entries(formSchema.shape).forEach(([fieldName, fieldSchema]) => {
                const ui = getUiMetadata(fieldSchema as any);
                if (ui?.fetchOnInit) fetchFieldOptions(fieldName, ui.fetchOnInit);
            });
            if (defaultValues) {
                Object.keys(defaultValues).forEach(fieldName => {
                    if (initialFormValues[fieldName]) runEffectsFor(fieldName, initialFormValues);
                });
            }
            initialEffectsRan.current = true;
        }
    }, [runEffectsFor, defaultValues, getValues, formSchema.shape, fetchFieldOptions]);

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
                if (successMessage) {

                }
            } catch (e) {
                console.error("Form submission caught an error:", e);
            }
        });
    };

    const shouldShowStatusMessage = isSubmitted && !isBusy;

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
        if (dynamicOptions[key]) finalOptions = dynamicOptions[key];
        else if (uiConfig.options) finalOptions = uiConfig.options;
        else if (coreType instanceof z.ZodEnum) finalOptions = coreType.options.map((val: any) => ({
            value: val,
            label: val
        }));

        if (componentType === 'select' || coreType instanceof z.ZodEnum) {
            fieldElement = (
                <select id={key} {...register(formKey)} className={inputClassName} {...uiConfig.inputProps}
                        disabled={isLoading}>
                    <option
                        value="">{isLoading ? 'Đang tải...' : (uiConfig.placeholder || 'Chọn một giá trị...')}</option>
                    {finalOptions.map((option: any) => {
                        const value = typeof option === 'object' ? option.value : option;
                        const label = typeof option === 'object' ? option.label : option;
                        return <option key={value} value={value}>{label}</option>
                    })}
                </select>
            );
        } else {
            // Các component khác giữ nguyên
            fieldElement = <input id={key}
                                  type={inputType} {...register(formKey, {valueAsNumber: coreType instanceof z.ZodNumber})}
                                  placeholder={uiConfig.placeholder || key}
                                  className={inputClassName} {...uiConfig.inputProps} />;
        }

        return (
            <div key={key} className={styles.formGroup}>
                <label htmlFor={key} className={styles.label}>
                    {uiConfig.label || startCase(key)}
                    {uiConfig.seeMoreLink && <a href={uiConfig.seeMoreLink} target="_blank" rel="noopener noreferrer"
                                                className="ml-2 text-blue-500 hover:underline">[?]</a>}
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

                <div className="flex items-center gap-4 mt-4">
                    <button type="submit" disabled={isBusy} className={styles.submitButton}>
                        {isSaving ? 'Đang lưu...' : (isBusy ? loadingButtonText : submitButtonText)}
                    </button>
                    {isSaving && (
                        <span className="text-sm text-gray-500 animate-pulse">
                            Đang xử lý...
                        </span>
                    )}
                </div>

                {shouldShowStatusMessage && error && (
                    <p className={styles.errorMessage}>{error.message}</p>
                )}
                {shouldShowStatusMessage && !error && data && successMessage && (
                    <p className={styles.successMessage}>{successMessage}</p>
                )}
            </form>
        </div>
    );
}