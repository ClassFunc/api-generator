// /Users/lethanh/WebstormProjects/audits-web/components/InputForm.tsx

'use client';

import {Controller, FieldValues, Path, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {get, isArray, startCase} from 'lodash';
import React, {JSX, useCallback, useEffect, useRef, useTransition} from 'react';

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
// import {getComponent} from "@/components/ComponentRegistry";


export const dynamicOptionsAtom = atom<Record<string, any[]>>({});
export const fieldLoadingAtom = atom<Record<string, boolean>>({});
export const formSavingAtom = atom(false);
/**
 * Component nội bộ để render các thẻ HTML form gốc.
 */
const NativeFormControl = ({tag: Tag = 'input', options, className, ...props}: {
    tag?: 'input' | 'textarea' | 'select';
    options?: { value: any; label: string }[];
    className?: string;
    [key: string]: any; // Để nhận các props từ register
}) => {
    // Sử dụng className mặc định từ module CSS và cho phép ghi đè
    const finalClassName = `${defaultFormStyles[Tag] || defaultFormStyles.input} ${className || ''}`;

    if (Tag === 'select') {
        return (
            <select {...props} className={finalClassName}>
                {props.placeholder && <option value="">{props.placeholder}</option>}
                {options?.map((option, index) => (
                    <option key={option.value !== undefined ? String(option.value) : index} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    // @ts-ignore
    return <Tag {...props} className={finalClassName}/>;
};

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
        control,
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

            // --- LOGIC MAPPING NÂNG CẤP ---
            let mappedOptions: { value: any; label: string }[] = [];

            if (optionsData.length > 0) {
                const firstItem = optionsData[0];

                // Trường hợp 1: Mảng các object
                if (typeof firstItem === 'object' && firstItem !== null) {
                    // Lấy ra valueField và labelField từ config.
                    // Zod schema trong InputFormHelpers đã có .default('value') và .default('label')
                    // nên chúng ta có thể yên tâm là fetchConfig luôn có các trường này.
                    const {valueField, labelField} = fetchConfig;
                    mappedOptions = optionsData.map((item: any) => ({
                        value: get(item, valueField!), // Dùng ! vì Zod đảm bảo nó tồn tại
                        label: String(get(item, labelField!)), // Ép kiểu label sang string cho an toàn
                    }));
                }
                // Trường hợp 2: Mảng các giá trị nguyên thủy (string, number)
                else if (typeof firstItem === 'string' || typeof firstItem === 'number') {
                    mappedOptions = optionsData.map((item: string | number) => ({
                        value: item,
                        label: String(item), // Dùng chính item đó làm cả value và label
                    }));
                }
            }
            // --- KẾT THÚC LOGIC MAPPING ---

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
                    if (getValues(fieldName as Path<TData>)) runEffectsFor(fieldName, getValues());
                });
            }
            initialEffectsRan.current = true;
        }
    }, [runEffectsFor, defaultValues, getValues, formSchema.shape, fetchFieldOptions]);

    useEffect(() => {
        // Cleanup function to reset atoms when the form unmounts
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
                    // Logic to show success message, e.g., using a toast library
                }
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

        const coreType = getZodInnerType(schema);
        const isLoading = fieldLoading[key];

        // --- 1. Xác định component để render theo thứ tự ưu tiên ---
        let ComponentToRender: React.ComponentType<any> | undefined;
        let isCustomComponent = false;
        let nativeTag: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' = 'input';

        // Ưu tiên 1: Tìm component trong registry nếu được cung cấp
        const requestedComponentKey = uiConfig.component;
        if (requestedComponentKey && componentRegistry) {
            ComponentToRender = componentRegistry[requestedComponentKey];
            if (ComponentToRender) {
                isCustomComponent = true;
            } else {
                console.warn(
                    `[DynamicForm] Component "${requestedComponentKey}" cho trường "${key}" không được tìm thấy trong componentRegistry. Sẽ fallback về thẻ HTML gốc.`
                );
            }
        }

        // Ưu tiên 2: Nếu không có custom component, fallback về thẻ HTML gốc
        if (!isCustomComponent) {
            if (requestedComponentKey === 'textarea') {
                nativeTag = 'textarea';
            } else if (requestedComponentKey === 'select' || coreType instanceof z.ZodEnum) {
                nativeTag = 'select';
            } else if (requestedComponentKey === 'checkbox' || requestedComponentKey === 'switch' || coreType instanceof z.ZodBoolean || coreType instanceof z.ZodArray) {
                // Mở rộng điều kiện để bao gồm cả ZodArray cho checkbox group
                nativeTag = 'checkbox';
            } else if (requestedComponentKey === 'radio') {
                nativeTag = 'radio';
            } else {
                nativeTag = 'input'; // Fallback cuối cùng
            }
        }

        // --- 2. Chuẩn bị props chung ---
        const finalOptions: any[] = dynamicOptions[key]
            ?? uiConfig.options
            ?? (coreType instanceof z.ZodEnum ? coreType.options.map((val: any) => ({
                value: val,
                label: startCase(val)
            })) : []);

        const placeholderText = isLoading
            ? 'Đang tải...'
            : uiConfig.placeholder ?? (nativeTag === 'select' ? 'Lựa chọn...' : undefined);

        const commonProps = {
            id: key,
            placeholder: placeholderText,
            disabled: isLoading || isBusy,
            ...uiConfig.inputProps,
        };

        // Xác định xem có nên hiển thị label ở trên không
        const isCheckboxGroup = (coreType instanceof z.ZodArray && (uiConfig.component === 'checkbox' || nativeTag === 'checkbox'));
        const isSingleCheckboxOrSwitch = !isCheckboxGroup && (nativeTag === 'checkbox' || uiConfig.component === 'switch');
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

                {/* --- 3. Render component --- */}
                {isCustomComponent && ComponentToRender ? (
                    <Controller
                        name={formKey}
                        control={control}
                        render={({field}) => {
                            // Xử lý nhóm checkbox tùy chỉnh (z.array)
                            if (isCheckboxGroup) {
                                return (
                                    <div className="flex flex-col space-y-2 pt-1">
                                        {finalOptions.map((option) => {
                                            const optionValue = option.value;
                                            const currentValues = Array.isArray(field.value) ? field.value : [];

                                            // KIỂM TRA TRẠNG THÁI (ROBUST)
                                            // So sánh dưới dạng chuỗi để xử lý an toàn các trường hợp như 1 và "1".
                                            const isChecked = currentValues.some(v => String(v) === String(optionValue));

                                            return (
                                                <ComponentToRender
                                                    key={optionValue}
                                                    id={`${key}-${optionValue}`}
                                                    name={field.name}
                                                    checked={isChecked}
                                                    // CẬP NHẬT GIÁ TRỊ (ROBUST)
                                                    onChange={(newCheckedState: boolean) => {
                                                        // Luôn lọc ra giá trị hiện tại (so sánh dạng chuỗi) để tránh lỗi type và trùng lặp.
                                                        const filteredValues = currentValues.filter(v => String(v) !== String(optionValue));

                                                        // Nếu người dùng chọn, thêm giá trị mới (với type gốc) vào mảng đã lọc.
                                                        // Nếu bỏ chọn, mảng đã lọc chính là kết quả cuối cùng.
                                                        const newValues = newCheckedState
                                                            ? [...filteredValues, optionValue]
                                                            : filteredValues;

                                                        field.onChange(newValues);
                                                    }}
                                                    label={option.label}
                                                    disabled={commonProps.disabled}
                                                />
                                            );
                                        })}
                                    </div>
                                );
                            }

                            // Xử lý switch hoặc checkbox đơn tùy chỉnh (z.boolean)
                            if (uiConfig.component === 'switch' || (uiConfig.component === 'checkbox' && coreType instanceof z.ZodBoolean)) {
                                return (
                                    <ComponentToRender
                                        {...commonProps}
                                        {...field}
                                        label={uiConfig.label || startCase(key)}
                                        checked={field.value}
                                        onChange={field.onChange}
                                    />
                                );
                            }

                            // Các component tùy chỉnh khác
                            return <ComponentToRender {...commonProps} {...field} options={finalOptions}
                                                      type={uiConfig.type || getHtmlInputType(schema)}/>;
                        }}
                    />
                ) : (
                    // Fallback về các element HTML gốc
                    (() => {
                        const inputType = uiConfig.type || getHtmlInputType(schema);

                        // =================================================================
                        // --- LOGIC MỚI: XỬ LÝ CHECKBOX GỐC (NATIVE HTML) ---
                        // =================================================================
                        if (nativeTag === 'checkbox') {
                            // Trường hợp 1: Nhóm checkbox (z.array)
                            if (coreType instanceof z.ZodArray) {
                                return (
                                    <div className={styles.checkboxGroup}>
                                        {finalOptions.map((option) => (
                                            <div key={`${key}-${option.value}`} className={styles.checkboxWrapper}>
                                                <input
                                                    type="checkbox"
                                                    id={`${key}-${option.value}`}
                                                    value={option.value}
                                                    {...register(formKey)}
                                                    disabled={commonProps.disabled}
                                                    className={styles.checkbox}
                                                />
                                                <label htmlFor={`${key}-${option.value}`}
                                                       className={styles.checkboxLabel}>
                                                    {option.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }

                            // Trường hợp 2: Checkbox đơn (z.boolean)
                            return (
                                <div className={styles.checkboxWrapper}>
                                    <input
                                        type="checkbox"
                                        {...commonProps}
                                        {...register(formKey)}
                                        className={styles.checkbox}
                                    />
                                    <label htmlFor={key} className={styles.checkboxLabel}>
                                        {uiConfig.label || startCase(key)}
                                    </label>
                                </div>
                            );
                        }

                        if (nativeTag === 'radio') {
                            const {id, ...restCommonProps} = commonProps;
                            return (
                                <div className={styles.radioGroup}>
                                    {finalOptions.map((option) => (
                                        <div key={`${key}-${option.value}`} className={styles.radioWrapper}>
                                            <input
                                                type="radio"
                                                id={`${key}-${option.value}`}
                                                value={option.value}
                                                {...restCommonProps}
                                                {...register(formKey)}
                                                className={styles.radio}
                                            />
                                            <label htmlFor={`${key}-${option.value}`} className={styles.radioLabel}>
                                                {option.label}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        return (
                            <NativeFormControl
                                {...commonProps}
                                {...register(formKey, {
                                    valueAsNumber: inputType === 'number' && coreType instanceof z.ZodNumber,
                                })}
                                tag={nativeTag}
                                type={inputType}
                                options={finalOptions}
                            />
                        );
                    })()
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

                <div className="flex items-center gap-4 mt-6">
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
                    <p className={`${styles.errorMessage} mt-4`}>{error.message}</p>
                )}
                {shouldShowStatusMessage && !error && data && successMessage && (
                    <p className={styles.successMessage}>{successMessage}</p>
                )}
            </form>
        </div>
    );
}