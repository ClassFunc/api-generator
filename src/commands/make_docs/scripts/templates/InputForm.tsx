// /Users/lethanh/WebstormProjects/audits-web/components/InputForm/InputForm.tsx

'use client';

import {Controller, FieldValues, Path, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {get, isArray, startCase} from 'lodash';
import React, {JSX, useCallback, useEffect, useMemo, useRef, useTransition} from 'react';

import {
    FetchConfig,
    getAuthToken,
    getHtmlInputType,
    getUiMetadata,
    getZodInnerType,
    InputTypeSchema,
    resolvePlaceholders
} from './InputFormHelpers';
// @ts-ignore
import defaultFormStyles from './InputForm.module.css';
import {atom, useAtom} from "jotai";
import {NativeFormControl} from "./nativeComponentRegistry";

export const dynamicOptionsAtom = atom<Record<string, any[]>>({});
export const fieldLoadingAtom = atom<Record<string, boolean>>({});
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
    componentRegistry?: Record<string, React.ComponentType<any>>;
}

export function DynamicForm<TData extends FieldValues>({
                                                           formSchema,
                                                           useSubmitHook,
                                                           defaultValues,
                                                           onSuccess,
                                                           submitButtonText = 'Send',
                                                           loadingButtonText = 'Sending...',
                                                           successMessage = '',
                                                           customStyles = {},
                                                           componentRegistry,
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
        submitButton: "bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-300 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed",
        successMessage: "mt-4 text-green-600",
        ...defaultFormStyles,
        ...customStyles,
    } as AllStyles;

    const {
        register,
        handleSubmit,
        formState: {errors: formValidationErrors, isSubmitted},
        watch,
        setValue,
        getValues,
        trigger,
        control,
    } = useForm<TData>({
        resolver: zodResolver(formSchema as any),
        defaultValues: defaultValues as any,
    });

    const shouldShowSubmitButton = useMemo(() => {
        const visibleFields = Object.values(formSchema.shape).filter(schema => {
            const ui = getUiMetadata(schema as any);
            return ui?.type !== 'hidden';
        });

        if (visibleFields.length === 0) {
            return false;
        }

        const allAreSaveOnChange = visibleFields.every(schema => {
            const ui = getUiMetadata(schema as any);
            return !!ui?.saveOnChange;
        });

        return !allAreSaveOnChange;
    }, [formSchema.shape]);

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

            let mappedOptions: { value: any; label: string }[] = [];

            if (optionsData.length > 0) {
                const firstItem = optionsData[0];

                if (typeof firstItem === 'object' && firstItem !== null) {
                    const {valueField, labelField} = fetchConfig;
                    mappedOptions = optionsData.map((item: any) => ({
                        value: get(item, valueField!),
                        label: String(get(item, labelField!)),
                    }));
                } else if (typeof firstItem === 'string' || typeof firstItem === 'number') {
                    mappedOptions = optionsData.map((item: string | number) => ({
                        value: item,
                        label: String(item),
                    }));
                }
            }

            setDynamicOptions(prev => ({...prev, [targetFieldName]: mappedOptions}));

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
        fire(formData)
            .then(result => {
                onSuccess?.(result);
            })
            .catch(err => {
                console.error("[AutoSave] Submission caught an error:", err);
            })
            .finally(() => {
                setIsSaving(false);
            });

    }, [trigger, getValues, setIsSaving, fire, onSuccess]);

    useEffect(() => {
        const subscription = watch((value, {name, type}) => {
            if (!name || type !== 'change') return;

            runEffectsFor(name, getValues());

            const fieldSchema = formSchema.shape[name];
            if (!fieldSchema) return;

            const ui = getUiMetadata(fieldSchema);
            if (ui?.saveOnChange) {
                if (debounceTimers.current[name]) clearTimeout(debounceTimers.current[name]);
                debounceTimers.current[name] = setTimeout(() => {
                    handleAutoSave();
                }, 750);
            }
        });

        return () => {
            subscription.unsubscribe();
            Object.values(debounceTimers.current).forEach(clearTimeout);
        };
    }, [watch, getValues, runEffectsFor, formSchema.shape, handleAutoSave]);


    useEffect(() => {
        if (!initialEffectsRan.current) {
            const initialFormValues = getValues();
            Object.entries(formSchema.shape).forEach(([fieldName, fieldSchema]) => {
                const ui = getUiMetadata(fieldSchema as any);
                if (ui?.fetchOnInit) fetchFieldOptions(fieldName, ui.fetchOnInit);
            });
            if (defaultValues) {
                Object.keys(defaultValues).forEach(fieldName => {
                    if (getValues(fieldName as Path<TData>)) runEffectsFor(fieldName, getValues());
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
            } catch (e) {
                console.error("Form submission caught an error:", e);
            }
        });
    };

    const shouldShowStatusMessage = isSubmitted && !isBusy;



    const renderField = (key: string, schema: z.ZodTypeAny): JSX.Element | null => {
        const formKey = key as Path<TData>;
        const uiConfig = getUiMetadata(schema) || {};

        if (uiConfig.type === 'hidden') {
            return <input key={key} type="hidden" {...register(formKey)} />;
        }

        const coreComponentZod = getZodInnerType(schema);
        const inputType = InputTypeSchema.safeParse(uiConfig.type).data || getHtmlInputType(schema);
        const isLoading = fieldLoading[key];

        // --- 1. Xác định component để render với hệ thống ưu tiên rõ ràng ---
        let finalComponentTag: string;

        // Ưu tiên 1 (cao nhất): `type: 'radio'` sẽ luôn render radio buttons.
        if (inputType === 'radio') {
            finalComponentTag = 'radio';
        }
        // Ưu tiên 2: `component` được chỉ định trong metadata.
        else if (uiConfig.component) {
            finalComponentTag = uiConfig.component;
        }
        // Ưu tiên 3: Suy luận từ kiểu Zod.
        else if (coreComponentZod instanceof z.ZodEnum) {
            finalComponentTag = 'select';
        } else if (coreComponentZod instanceof z.ZodBoolean || coreComponentZod instanceof z.ZodArray) {
            finalComponentTag = 'checkbox';
        }
        // Ưu tiên 4 (mặc định): Fallback về input.
        else {
            finalComponentTag = 'input';
        }

        // Sau khi có `finalComponentTag`, tìm component tương ứng trong registry.
        const ComponentToRender = componentRegistry ? componentRegistry[finalComponentTag] : undefined;

        // Cảnh báo nếu component được yêu cầu tường minh nhưng không tìm thấy
        if (uiConfig.component && !ComponentToRender && componentRegistry) {
            console.warn(
                `[DynamicForm] Component "${uiConfig.component}" cho trường "${key}" không được tìm thấy trong componentRegistry. Sẽ fallback về logic thẻ HTML gốc.`
            );
        }

        // --- 2. Chuẩn bị props chung ---
        const finalOptions: any[] = dynamicOptions[key]
            ?? uiConfig.options
            ?? (coreComponentZod instanceof z.ZodEnum ? coreComponentZod.options.map((val: any) => ({
                value: val,
                label: startCase(val)
            })) : []);

        const placeholderText = isLoading
            ? 'Đang tải...'
            : uiConfig.placeholder ?? (finalComponentTag === 'select' ? 'Lựa chọn...' : undefined);

        const commonProps = {
            id: key,
            placeholder: placeholderText,
            disabled: isLoading || isBusy,
            ...uiConfig.inputProps,
        };

        // Suy luận các loại group từ `finalComponentTag` đã được chuẩn hóa
        const isRadioGroup = finalComponentTag === 'radio';
        const isCheckboxGroup = (coreComponentZod instanceof z.ZodArray && finalComponentTag === 'checkbox');
        const isSingleCheckboxOrSwitch = !isCheckboxGroup && (finalComponentTag === 'checkbox' || finalComponentTag === 'switch');
        const showTopLabel = !isSingleCheckboxOrSwitch;

        return (
            <div key={key} className={styles.formGroup}>
                {showTopLabel && (
                    <label htmlFor={key} className={styles.label}>
                        {uiConfig.label || startCase(key)}
                        {uiConfig.seeMoreLink && (
                            <a href={uiConfig.seeMoreLink} target="_blank" rel="noopener noreferrer"
                               className="ml-2 text-blue-500 hover:underline text-xs">[?]</a>
                        )}
                    </label>
                )}

                {/* --- 3. Render component (LOGIC HỢP NHẤT) --- */}
                {/* Sử dụng Controller cho các component phức tạp (checkbox, radio, switch, custom) */}
                {(isRadioGroup || isCheckboxGroup || isSingleCheckboxOrSwitch || ComponentToRender) ? (
                    <Controller
                        name={formKey}
                        control={control}
                        render={({field}) => {
                            // ResolvedComponent sẽ là component từ registry (ví dụ: ShadcnRadioGroup) hoặc NativeFormControl
                            const ResolvedComponent = ComponentToRender
                                || (componentRegistry && componentRegistry[finalComponentTag])
                                || NativeFormControl;

                            if (isRadioGroup) {
                                // Logic này lặp và render TỪNG radio item, truyền props cho item đó.
                                // Nó tương thích hoàn hảo với cả ShadcnRadioGroup và NativeFormControl.
                                if (ComponentToRender && ComponentToRender !== NativeFormControl) {
                                    // Đây là một component group tùy chỉnh (ví dụ: ShadcnRadioGroup).
                                    // Chúng ta render nó một lần và truyền tất cả options.
                                    return <ResolvedComponent {...commonProps} {...field} options={finalOptions} />;
                                } else {
                                    // Đây là trường hợp fallback về native. Render từng item.
                                    return (
                                        <div className={styles.radioGroup ?? "flex items-center space-x-4 pt-1"}>
                                            {finalOptions.map((option) => (
                                                <NativeFormControl
                                                    key={option.value}
                                                    id={`${key}-${option.value}`}
                                                    name={field.name}
                                                    checked={String(field.value) === String(option.value)}
                                                    onChange={() => field.onChange(option.value)}
                                                    tag="input"
                                                    type="radio"
                                                    label={option.label}
                                                    value={option.value}
                                                    disabled={commonProps.disabled}
                                                />
                                            ))}
                                        </div>
                                    );
                                }
                            }
                            if (isCheckboxGroup) {
                                return (
                                    <div className={styles.checkboxGroup ?? "flex flex-col space-y-2 pt-1"}>
                                        {finalOptions.map((option) => {
                                            const optionValue = option.value;
                                            const currentValues = Array.isArray(field.value) ? field.value : [];
                                            const isChecked = currentValues.some(v => String(v) === String(optionValue));

                                            return (
                                                <ResolvedComponent
                                                    key={optionValue}
                                                    id={`${key}-${optionValue}`}
                                                    name={field.name}
                                                    checked={isChecked}
                                                    onChange={(newCheckedState: boolean | React.ChangeEvent<HTMLInputElement>) => {
                                                        const isNowChecked = typeof newCheckedState === 'boolean' ? newCheckedState : newCheckedState.target.checked;
                                                        const filteredValues = currentValues.filter(v => String(v) !== String(optionValue));
                                                        const newValues = isNowChecked
                                                            ? [...filteredValues, optionValue]
                                                            : filteredValues;
                                                        field.onChange(newValues);
                                                    }}
                                                    label={option.label}
                                                    disabled={commonProps.disabled}
                                                    // Ghi đè props cho NativeFormControl
                                                    tag="input"
                                                    type="checkbox"
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            }

                            if (isSingleCheckboxOrSwitch) {
                                return (
                                    <ResolvedComponent
                                        {...commonProps}
                                        {...field}
                                        label={uiConfig.label || startCase(key)}
                                        checked={!!field.value}
                                        onChange={field.onChange}
                                        // Ghi đè props cho NativeFormControl
                                        tag="input"
                                        type={finalComponentTag === 'switch' ? 'switch' : 'checkbox'}
                                    />
                                );
                            }

                            // Các component tùy chỉnh khác (ví dụ: select, input, textarea...)
                            return <ResolvedComponent {...commonProps}
                                                      {...field}
                                                      options={finalOptions}
                                                      tag={finalComponentTag}
                                                      type={inputType}/>;
                        }}
                    />
                ) : (
                    // Fallback về các element HTML gốc không cần Controller (input, textarea)
                    <NativeFormControl
                        {...commonProps}
                        {...register(formKey, {
                            valueAsNumber: (inputType === 'number') && coreComponentZod instanceof z.ZodNumber,
                        })}
                        tag={finalComponentTag}
                        type={inputType}
                        options={finalOptions}
                    />
                )}

                {uiConfig.helperText && <p className={styles.helperText}>{uiConfig.helperText}</p>}
                {formValidationErrors[formKey] && (
                    <span className={styles.errorMessage}>{formValidationErrors[formKey]?.message as string}</span>
                )}
            </div>
        );
    };

    return (
        <div className={styles.formContainer}>
            <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
                {Object.entries(formSchema.shape).map(([key, schema]) => renderField(key, schema as any))}

                {shouldShowSubmitButton && (
                    <div className="flex items-center gap-4 mt-6">
                        <button type="submit" disabled={isBusy} className={styles.submitButton}>
                            {isSaving ? 'Saving...' : (isBusy ? loadingButtonText : submitButtonText)}
                        </button>
                        {isSaving && (
                            <span className="text-sm text-gray-500 animate-pulse">
                                Processing...
                            </span>
                        )}
                    </div>
                )}

                {shouldShowStatusMessage && error && (
                    <p className={`${styles.errorMessage} mt-4`}>{error.message}</p>
                )}
                {shouldShowStatusMessage && !error && data && successMessage && (
                    <p className={styles.successMessage}>{successMessage}</p>
                )}
            </form>
        </div>
    );
}