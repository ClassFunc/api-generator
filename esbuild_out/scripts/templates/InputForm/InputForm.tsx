'use client';

import {Controller, FieldValues, FormProvider, Path, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {get, isArray, startCase} from 'lodash';
import React, {JSX, useCallback, useEffect, useMemo, useRef, useState, useTransition} from 'react';
import {
    FetchConfig,
    getAuthToken,
    getHtmlInputType,
    getUiMetadata,
    getZodInnerType,
    InputTypeSchema,
    makeSchemaPassthroughCompatible,
    resolvePlaceholders
} from './InputFormHelpers';
// @ts-ignore
import defaultFormStyles from './InputForm.module.css';
import {atom, useAtom} from "jotai";
import {NativeFormControl} from "./nativeComponentRegistry";
import {PassthroughFields} from "./PassthroughFields";
import {DataDisplayTable, DataPathFieldConfig, RowAction, TableAction} from "./DataDisplayTable";

export const dynamicOptionsAtom = atom<Record<string, any[]>>({});
export const fieldLoadingAtom = atom<Record<string, boolean>>({});
export const formSavingAtom = atom(false);

// --- Types ---
type SubmitHook<TData extends FieldValues> = (defaultConfig?: Record<string, any>) => {
    fire: (data: TData) => Promise<any>;
    loading: boolean;
    error: Error | null;
    data: any;
    dataList: any[];
    response: any;
    // infinite loading;
    InfiniteLoading: React.ComponentType<any>;
    rootRefSetter: (node: HTMLDivElement | null) => void;
    handleRootScroll: () => void;
    resetCachedResponseStore: () => void;
    endpoint: string | undefined;
};

type AllStyleKeys =
    keyof typeof defaultFormStyles
    | 'submitButton'
    | 'successMessage'
    | 'nestedObject'
    | 'helperText'
    | 'successContainer'
    | 'resetButton';
type AllStyles = { [K in AllStyleKeys]: string };
type CustomStyles = Partial<AllStyles>;
type DefaultConfigs = {
    inData?: Record<string, any>;
    fireImmediately: boolean;
}
// --- NÂNG CẤP PROPS ---
export interface DynamicFormProps<TData extends FieldValues> {
    //input settings
    formSchema: z.ZodObject<any, any, any>;
    useSubmitHook: SubmitHook<TData>;
    defaultValues?: TData;
    dynamicINDataValues?: Record<string, any>;
    customStyles?: CustomStyles;
    submitButtonText?: string;
    loadingButtonText?: string;
    componentRegistry?: Record<string, React.ComponentType<any>>;
    formId?: string;
    showSubmitButton?: boolean;
    TriggerSubmitComponent?: React.ComponentType<{ triggerSubmit: () => void; isBusy: boolean }>;
    showForm?: boolean;
    fireImmediately?: boolean;

    // ouput settings
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
    successMessage?: React.ReactNode;
    renderSuccessContent?: (result: {
        apiResponse: any,
        submittedValues: TData
    }) => React.ReactNode;
    // in auto-table settings, data is an Array<any>
    successDataPath?: string;
    resultTitle?: string;
    // columns on table by fields
    successDataPathFields?: DataPathFieldConfig[];
    showResponseDetailsHeader?: boolean;
    showDataTableHeaders?: boolean;
    showRowNumber?: boolean;

    // row actions
    rowActions?: RowAction[];
    onRowClick?: (rowData: any) => void;
    rowKeyField?: string;
    initialCheckedField?: string;
    selectOnRowClick?: boolean;
    selectedRowClassName?: string;
    onSelectionChange?: (selectedKeys: Set<any>, selectedRows: any[]) => void;
    // table actions
    tableActions?: TableAction[];
    showTableRefreshButton?: boolean;
}

export function DynamicForm<TData extends FieldValues>({
                                                           formSchema,
                                                           useSubmitHook,
                                                           defaultValues,
                                                           onSuccess,
                                                           onError,
                                                           submitButtonText = 'Submit',
                                                           loadingButtonText = 'Submitting...',
                                                           successMessage = 'Your submission was successful!',
                                                           successDataPath = 'result.data',
                                                           resultTitle,
                                                           renderSuccessContent,
                                                           customStyles = {},
                                                           componentRegistry, 
                                                           showResponseDetailsHeader = false,
                                                           showDataTableHeaders = true,
                                                           showRowNumber = false,
                                                           successDataPathFields,
                                                           rowActions,
                                                           onRowClick,
                                                           rowKeyField,
                                                           onSelectionChange,
                                                           tableActions,
                                                           selectOnRowClick,
                                                           selectedRowClassName,
                                                           dynamicINDataValues,
                                                           TriggerSubmitComponent,
                                                           formId,
                                                           showForm = true,
                                                           fireImmediately = false,
                                                           showTableRefreshButton = true,
                                                           showSubmitButton = true,
                                                           initialCheckedField,

                                                       }: DynamicFormProps<TData>) {
    const {
        fire,
        loading: hookLoading,
        error,
        response,
        dataList,
        InfiniteLoading,
        rootRefSetter,
        handleRootScroll,
        resetCachedResponseStore,
        endpoint,
    } = useSubmitHook({inData: defaultValues, fireImmediately} as DefaultConfigs);
    const [isPending, startTransition] = useTransition();
    const [isSaving, setIsSaving] = useAtom(formSavingAtom);
    const isBusy = isPending || hookLoading || isSaving;

    const [successState, setSuccessState] = useState<{
        apiResponse: any,
        submittedValues: TData
    } | null>(null);

    useEffect(() => {
        if (response) {
            setSuccessState({
                apiResponse: response,
                submittedValues: defaultValues ?? {} as TData
            })
        }
    }, [response])

    const [dynamicOptions, setDynamicOptions] = useAtom(dynamicOptionsAtom);
    const [fieldLoading, setFieldLoading] = useAtom(fieldLoadingAtom);
    const initialEffectsRan = useRef(false);
    const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
    const initialSelectionDone = useRef(false);

    const [selectedKeys, setSelectedKeys] = useState<Set<any>>(new Set());

    // Hợp nhất các style mặc định với các style tùy chỉnh và thêm hỗ trợ dark mode
    const styles: AllStyles = {
        ...defaultFormStyles,
        submitButton: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 m-auto",
        successMessage: "mt-4 text-green-600 dark:text-green-400",
        nestedObject: "space-y-4 rounded-lg border border-border bg-muted/20 p-4 dark:bg-muted/10",
        helperText: "whitespace-pre-wrap text-sm text-muted-foreground",
        successContainer: "p-6 border border-border rounded-lg bg-background shadow-sm text-center",
        resetButton: "mt-6 bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2",
        label: "block text-sm font-medium text-foreground mb-1.5",
        errorMessage: "mt-1 text-sm text-red-600 dark:text-red-400",
        ...customStyles,
    } as AllStyles;

    const processedSchema = useMemo(() => makeSchemaPassthroughCompatible(formSchema), [formSchema]);

    const formMethods = useForm<TData>({
        resolver: zodResolver(processedSchema as any),
        defaultValues: defaultValues as any,
    });
    const {
        handleSubmit,
        formState: {errors: formValidationErrors, isSubmitted},
        register,
        watch,
        setValue,
        getValues,
        trigger,
        control
    } = formMethods;

    const finalResultTitle = useMemo(() => {
        if (resultTitle) {
            return resultTitle;
        }
        if (endpoint) {
            // Lấy phần cuối của URL path, bỏ query params
            const path = endpoint.split('?')[0];
            // Tách theo '/', lọc bỏ các phần rỗng (ví dụ: từ // hoặc / ở cuối)
            const parts = path.split('/').filter(Boolean);
            // Lấy phần tử cuối cùng
            const lastPart = parts.pop() || '';
            // Chuyển thành dạng "Title Case" và trả về
            return startCase(lastPart);
        }
        return undefined;
    }, [resultTitle, endpoint]);

    const mainData = useMemo(() => {
        if (dataList.length > 0)
            return dataList;
        if (!successState?.apiResponse) return [];
        const data = successDataPath ? get(successState.apiResponse, successDataPath) : successState.apiResponse;
        return Array.isArray(data) ? data : [];
    }, [dataList, successState, successDataPath]);

    useEffect(() => {
        if (initialSelectionDone.current || !initialCheckedField || !rowKeyField || !selectOnRowClick || mainData.length === 0) {
            return;
        }

        const initialKeys = new Set<any>();
        for (const row of mainData) {
            const key = get(row, rowKeyField);
            if (key !== undefined) {
                const shouldBeSelected = get(row, initialCheckedField);
                if (shouldBeSelected) {
                    initialKeys.add(key);
                }
            }
        }

        if (initialKeys.size > 0) {
            setSelectedKeys(initialKeys);
            if (onSelectionChange) {
                const selectedRows = mainData.filter(row => initialKeys.has(get(row, rowKeyField!)));
                onSelectionChange(initialKeys, selectedRows);
            }
            initialSelectionDone.current = true;
        }
    }, [mainData, initialCheckedField, rowKeyField, selectOnRowClick, onSelectionChange]);

    const handleSelectionChange = useCallback((row: any, isChecked: boolean) => {
        if (!rowKeyField) return;
        const key = get(row, rowKeyField);
        if (key === undefined) return;

        const newSelectedKeys = new Set(selectedKeys);
        if (isChecked) {
            newSelectedKeys.add(key);
        } else {
            newSelectedKeys.delete(key);
        }
        setSelectedKeys(newSelectedKeys);

        if (onSelectionChange) {
            const newSelectedRows = mainData.filter(r => {
                const rKey = get(r, rowKeyField);
                return rKey !== undefined && newSelectedKeys.has(rKey);
            });
            onSelectionChange(newSelectedKeys, newSelectedRows);
        }
    }, [selectedKeys, mainData, rowKeyField, onSelectionChange]);

    const getVisibleFieldsRecursively = (schema: z.ZodTypeAny): z.ZodTypeAny[] => {
        const unwrapped = getZodInnerType(schema);

        if (unwrapped instanceof z.ZodObject) {
            return Object.values(unwrapped.shape).flatMap(subSchema => getVisibleFieldsRecursively(subSchema as any));
        }

        const ui = getUiMetadata(schema);
        if (ui?.type === 'hidden') {
            return [];
        }
        return [schema];
    }

    const internalShouldShowSubmitButton = useMemo(() => {
        const visibleFields = getVisibleFieldsRecursively(formSchema);
        if (visibleFields.length === 0) return false;

        const allAreSaveOnChange = visibleFields.every(schema => {
            const ui = getUiMetadata(schema as any);
            return !!ui?.saveOnChange;
        });
        return !allAreSaveOnChange;
    }, [formSchema]);

    const finalShowSubmitButton = showSubmitButton && internalShouldShowSubmitButton;

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

    const processPassthroughFields = (data: any): any => {
        if (Array.isArray(data)) {
            return data.map(item => processPassthroughFields(item));
        }
        if (typeof data === 'object' && data !== null) {
            const newData: Record<string, any> = {...data};
            if (newData.__additionalFields && Array.isArray(newData.__additionalFields)) {
                newData.__additionalFields.forEach((field: { key?: string; value?: any }) => {
                    if (field.key) {
                        newData[field.key] = field.value;
                    }
                });
                delete newData.__additionalFields;
            }
            Object.keys(newData).forEach(key => {
                newData[key] = processPassthroughFields(newData[key]);
            });
            return newData;
        }
        return data;
    };

    const handleAutoSave = useCallback(async () => {
        const isValid = await trigger();
        if (!isValid) return;

        const formData = getValues();
        const processedData = processPassthroughFields(formData);
        const finalData = { ...dynamicINDataValues, ...processedData };
        setIsSaving(true);
        fire(finalData)
            .then(result => {
                onSuccess?.(result);
            })
            .catch(err => {
                console.error("[AutoSave] Submission caught an error:", err);
                onError?.(err);
            })
            .finally(() => setIsSaving(false));
    }, [trigger, getValues, setIsSaving, fire, onSuccess, dynamicINDataValues, onError]);

    const handleRefresh = useCallback(() => {
        startTransition(() => {
            const doRefresh = async () => {
                try {
                    resetCachedResponseStore();
                    const valuesToUse = dynamicINDataValues ?? defaultValues ?? {} as TData;
                    console.log({valuesToUse})
                    const apiResponse = await fire(valuesToUse as TData);
                    onSuccess?.(apiResponse);
                    setSuccessState({apiResponse: apiResponse, submittedValues: valuesToUse as TData});
                } catch (e) {
                    console.error("Form refresh caught an error:", e);
                    onError?.(e);
                }
            };
            void doRefresh();
        })
    }, [resetCachedResponseStore, successState, defaultValues, fire, onSuccess, onError]);

    const finalTableActions = useMemo(() => {
        const allActions = [...(tableActions || [])];
        if (showTableRefreshButton) {
            allActions.unshift({
                key: 'refresh',
                label: 'Refresh',
                onClick: handleRefresh,
                ignoreSelection: true,
                isBusy: isBusy,
            });
        }
        return allActions;
    }, [tableActions, showTableRefreshButton, handleRefresh, isBusy]);

    const runEffectsRecursively = useCallback((
        schema: z.ZodTypeAny,
        pathPrefix: string,
        changedFieldName: string,
        allFormValues: TData
    ) => {
        const unwrappedSchema = getZodInnerType(schema);

        if (unwrappedSchema instanceof z.ZodObject) {
            Object.entries(unwrappedSchema.shape).forEach(([key, subSchema]) => {
                const newPrefix = pathPrefix ? `${pathPrefix}.${key}` : key;
                runEffectsRecursively(subSchema as z.ZodTypeAny, newPrefix, changedFieldName, allFormValues);
            });
        } else {
            const targetFieldName = pathPrefix;
            const ui = getUiMetadata(schema);
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
        }
    }, [setValue, setDynamicOptions, setFieldLoading, fetchFieldOptions]);

    useEffect(() => {
        const subscription = watch((value, {name, type}) => {
            if (!name || type !== 'change') return;

            runEffectsRecursively(formSchema, '', name, getValues());

            const pathParts = name.split('.');
            let deepestSchemaOwner: z.ZodTypeAny = formSchema;
            let currentSchema: any = formSchema;

            for (const part of pathParts) {
                const unwrapped = getZodInnerType(currentSchema);
                if (unwrapped instanceof z.ZodObject && unwrapped.shape[part]) {
                    currentSchema = unwrapped.shape[part];
                    deepestSchemaOwner = currentSchema;
                } else {
                    break;
                }
            }

            const ui = getUiMetadata(deepestSchemaOwner);
            if (ui?.saveOnChange) {
                if (debounceTimers.current[name]) clearTimeout(debounceTimers.current[name]);
                debounceTimers.current[name] = setTimeout(() => handleAutoSave(), 750);
            }
        });
        return () => {
            subscription.unsubscribe();
            Object.values(debounceTimers.current).forEach(clearTimeout);
        };
    }, [watch, getValues, formSchema, handleAutoSave, runEffectsRecursively]);

    useEffect(() => {
        if (!initialEffectsRan.current) {
            const runInitialEffects = (schema: z.ZodTypeAny, pathPrefix: string = '') => {
                const unwrappedSchema = getZodInnerType(schema);
                if (unwrappedSchema instanceof z.ZodObject) {
                    Object.entries(unwrappedSchema.shape).forEach(([key, subSchema]) => {
                        const newPrefix = pathPrefix ? `${pathPrefix}.${key}` : key;
                        runInitialEffects(subSchema as z.ZodTypeAny, newPrefix);
                    });
                } else {
                    const ui = getUiMetadata(schema);
                    if (ui?.fetchOnInit) fetchFieldOptions(pathPrefix, ui.fetchOnInit);
                    if (defaultValues && get(defaultValues, pathPrefix)) {
                        runEffectsRecursively(formSchema, '', pathPrefix, getValues());
                    }
                }
            };
            runInitialEffects(formSchema);
            initialEffectsRan.current = true;
        }
    }, [defaultValues, getValues, formSchema, fetchFieldOptions, runEffectsRecursively]);

    useEffect(() => {
        return () => {
            setDynamicOptions({});
            setFieldLoading({});
        };
    }, [setDynamicOptions, setFieldLoading]);

    const handleFormSubmit = (formData: TData) => {
        startTransition(() => {
            const doSubmit = async () => {
                try {
                    resetCachedResponseStore();
                    const processedData = processPassthroughFields(formData);
                    const finalData = {...dynamicINDataValues, ...processedData};
                    const apiResponse = await fire(finalData);
                    onSuccess?.(apiResponse);
                    setSuccessState({apiResponse: apiResponse, submittedValues: finalData});
                    // reset(defaultValues);
                } catch (e) {
                    console.error("Form submission caught an error:", e);
                    onError?.(e);
                }
            };
            void doSubmit();
        })
    };

    const handleResetForm = () => {
        setSuccessState(null);
        setSelectedKeys(new Set());
        initialSelectionDone.current = false;
    };

    const renderField = (key: string, schema: z.ZodTypeAny): JSX.Element | null => {
        const formKey = key as Path<TData>;
        const uiConfig = getUiMetadata(schema) || {};

        if (uiConfig.type === 'hidden') {
            return <input key={key} type="hidden" {...register(formKey)} />;
        }

        const coreComponentZod = getZodInnerType(schema);
        const inputType = InputTypeSchema.safeParse(uiConfig.type).data || getHtmlInputType(schema);
        const isLoading = fieldLoading[key];

        let finalComponentTag: string;
        if (inputType === 'radio') finalComponentTag = 'radio';
        else if (uiConfig.component) finalComponentTag = uiConfig.component;
        else if (coreComponentZod instanceof z.ZodEnum) finalComponentTag = 'select';
        else if (coreComponentZod instanceof z.ZodBoolean || coreComponentZod instanceof z.ZodArray) finalComponentTag = 'checkbox';
        else finalComponentTag = 'input';

        const ComponentToRender = componentRegistry ? componentRegistry[finalComponentTag] : undefined;
        if (uiConfig.component && !ComponentToRender && componentRegistry && finalComponentTag !== 'radio') {
            console.warn(`[DynamicForm] Component "${finalComponentTag}" for field "${key}" not in registry. Fallback to native.`);
        }

        const finalOptions: any[] = dynamicOptions[key]
            ?? uiConfig.options
            ?? (coreComponentZod instanceof z.ZodEnum ? coreComponentZod.options.map((val: any) => ({
                value: val,
                label: startCase(val)
            })) : []);

        const placeholderText = isLoading ? 'Loading...' : uiConfig.placeholder ?? (finalComponentTag === 'select' ? 'Select...' : undefined);
        const commonProps = {
            id: key,
            placeholder: placeholderText,
            disabled: isLoading || isBusy, ...uiConfig.inputProps
        };
        const isRadioGroup = finalComponentTag === 'radio';
        const isCheckboxGroup = (coreComponentZod instanceof z.ZodArray && finalComponentTag === 'checkbox');
        const isSingleCheckboxOrSwitch = !isCheckboxGroup && (finalComponentTag === 'checkbox' || finalComponentTag === 'switch');
        const showTopLabel = !isSingleCheckboxOrSwitch;
        const fieldName = key.split('.').pop() || key;

        return (
            <div key={key} className={styles.formGroup}>
                {showTopLabel && (
                    <label htmlFor={key} className={styles.label}>
                        {uiConfig.label || startCase(fieldName)}
                        {uiConfig.seeMoreLink && (
                            <a href={uiConfig.seeMoreLink} target="_blank" rel="noopener noreferrer"
                               className="ml-2 text-blue-500 hover:underline text-xs">[?]</a>
                        )}
                    </label>
                )}

                {(isRadioGroup || isCheckboxGroup || isSingleCheckboxOrSwitch || ComponentToRender) ? (
                    <Controller
                        name={formKey}
                        control={control}
                        render={({field}) => {
                            const ResolvedComponent = ComponentToRender || (componentRegistry && componentRegistry[finalComponentTag]) || NativeFormControl;
                            if (isRadioGroup) {
                                if (ComponentToRender && ComponentToRender !== NativeFormControl) {
                                    return <ResolvedComponent {...commonProps} {...field} options={finalOptions}/>;
                                }
                                return (
                                    <div className={styles.radioGroup ?? "flex items-center space-x-4 pt-1"}>
                                        {finalOptions.map((option) => (
                                            <NativeFormControl key={option.value} id={`${key}-${option.value}`}
                                                               name={field.name}
                                                               checked={String(field.value) === String(option.value)}
                                                               onChange={() => field.onChange(option.value)} tag="input"
                                                               type="radio" label={option.label} value={option.value}
                                                               disabled={commonProps.disabled}/>
                                        ))}
                                    </div>
                                );
                            }
                            if (isCheckboxGroup) {
                                return (
                                    <div className={styles.checkboxGroup ?? "flex flex-col space-y-2 pt-1"}>
                                        {finalOptions.map((option) => {
                                            const currentValues = Array.isArray(field.value) ? field.value : [];
                                            const isChecked = currentValues.some(v => String(v) === String(option.value));
                                            return (
                                                <ResolvedComponent key={option.value} id={`${key}-${option.value}`}
                                                                   name={field.name} checked={isChecked}
                                                                   onChange={(e: boolean | React.ChangeEvent<HTMLInputElement>) => {
                                                                       const isNowChecked = typeof e === 'boolean' ? e : e.target.checked;
                                                                       const filtered = currentValues.filter(v => String(v) !== String(option.value));
                                                                       const newValues = isNowChecked ? [...filtered, option.value] : filtered;
                                                                       field.onChange(newValues);
                                                                   }}
                                                                   label={option.label} disabled={commonProps.disabled}
                                                                   tag="input" type="checkbox"/>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            if (isSingleCheckboxOrSwitch) {
                                return <ResolvedComponent {...commonProps} {...field}
                                                          label={uiConfig.label || startCase(fieldName)}
                                                          checked={!!field.value} onChange={field.onChange}
                                                          tag="input"
                                                          type={finalComponentTag === 'switch' ? 'switch' : 'checkbox'}/>;
                            }
                            return <ResolvedComponent {...commonProps} {...field} options={finalOptions}
                                                      tag={finalComponentTag} type={inputType}/>;
                        }}
                    />
                ) : (
                    <NativeFormControl {...commonProps} {...register(formKey, {
                        valueAsNumber: (inputType === 'number') && coreComponentZod instanceof z.ZodNumber,
                    })} tag={finalComponentTag} type={inputType} options={finalOptions}/>
                )}

                {uiConfig.helperText && <p className={`${styles.helperText} mt-1.5 text-sm`}>{uiConfig.helperText}</p>}
                {get(formValidationErrors, formKey) && (
                    <span
                        className={styles.errorMessage}>{(get(formValidationErrors, formKey) as any)?.message as string}</span>
                )}
            </div>
        );
    };

    const renderSchema = (schema: z.ZodTypeAny, pathPrefix: string = ''): (JSX.Element | null)[] => {
        const unwrappedSchema = getZodInnerType(schema);
        if (unwrappedSchema instanceof z.ZodObject) {
            const uiConfig = getUiMetadata(schema) || {};
            const objectFields = Object.entries(unwrappedSchema.shape)
                .flatMap(([key, subSchema]) => {
                    const newPrefix = pathPrefix ? `${pathPrefix}.${key}` : key;
                    return renderSchema(subSchema as z.ZodTypeAny, newPrefix);
                });

            const isPassthrough = unwrappedSchema._def.catchall._def.typeName !== z.ZodFirstPartyTypeKind.ZodNever;

            if (isPassthrough) {
                objectFields.push(<PassthroughFields key={`${pathPrefix}-passthrough`} namePrefix={pathPrefix}/>);
            }

            if (pathPrefix) {
                const fieldName = pathPrefix.split('.').pop() || pathPrefix;
                return [
                    <fieldset key={pathPrefix} className={styles.nestedObject}>
                        <legend className={`${styles.label} text-base font-semibold text-foreground`}>
                            {uiConfig.label || startCase(fieldName)}
                            {uiConfig.seeMoreLink && (
                                <a href={uiConfig.seeMoreLink} target="_blank" rel="noopener noreferrer"
                                   className="ml-2 text-blue-500 hover:underline text-xs">[?]</a>
                            )}
                        </legend>
                        {objectFields}
                        {uiConfig.helperText && <p className={`${styles.helperText} text-sm`}>{uiConfig.helperText}</p>}
                    </fieldset>
                ];
            }

            const rootElements = [...objectFields];
            const hasHeaderContent = uiConfig.label || uiConfig.helperText;
            if (hasHeaderContent) {
                const headerBlock = (
                    <div key="form-header" className="col-span-full">
                        {uiConfig.label && (
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                                    {uiConfig.label}
                                </h2>
                                {uiConfig.seeMoreLink && (
                                    <a href={uiConfig.seeMoreLink} target="_blank" rel="noopener noreferrer"
                                       className="text-blue-500 hover:underline text-sm">[?]</a>
                                )}
                            </div>
                        )}
                        {uiConfig.helperText && (
                            <p className={`${styles.helperText} ${uiConfig.label ? 'mt-2' : ''}`}>
                                {uiConfig.helperText}
                            </p>
                        )}
                        <hr className="my-6 border-border"/>
                    </div>
                );
                rootElements.unshift(headerBlock);
            }
            return rootElements;
        }

        if (pathPrefix) {
            return [renderField(pathPrefix, schema)];
        }
        return [];
    };

    const renderOutput = () => {
        // Priority 1: Custom success content renderer. It takes precedence over all other outputs
        // once a successful submission has occurred.
        if (successState && !error && renderSuccessContent) {
            return (
                <div className={`${styles.successContainer}`}>
                    {renderSuccessContent(successState)}
                    {showForm && (
                        <button onClick={handleResetForm} className={styles.resetButton}>
                            Submit another response
                        </button>
                    )}
                </div>
            );
        }

        // Priority 2: Table view. This is the default for query-like forms.
        // It will render from the start if successDataPathFields are provided.
        const shouldShowTable = successDataPathFields && successDataPathFields.length > 0;
        if (shouldShowTable) {
            const tableResponseData = dataList.length > 0 ? dataList : successState?.apiResponse;
            return (
                <div className={`w-full text-left ${showForm ? 'mt-6' : ''}`}>
                    {/* Display hook error whenever it exists. It shows above the table. */}
                    {error && (
                         <div
                            className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400"
                            role="alert">
                            <span className="font-medium">Request Error:</span> {error.message}
                        </div>
                    )}
                    <DataDisplayTable
                        response={tableResponseData ?? []}
                        title={finalResultTitle}
                        dataPath={dataList.length > 0 ? undefined : successDataPath}
                        dataPathFields={successDataPathFields}
                        showResponseDetailsHeader={showResponseDetailsHeader}
                        showDataTableHeaders={showDataTableHeaders}
                        showRowNumber={showRowNumber}
                        rowActions={rowActions}
                        onRowClick={onRowClick}
                        rowKeyField={rowKeyField}
                        onSelectionChange={handleSelectionChange}
                        tableActions={finalTableActions}
                        selectOnRowClick={selectOnRowClick}
                        selectedRowClassName={selectedRowClassName}
                        componentRegistry={componentRegistry}
                        selectedKeys={selectedKeys}
                        rootRefSetter={rootRefSetter}
                        handleRootScroll={handleRootScroll}
                        InfiniteLoading={InfiniteLoading}
                    />
                    {/* Show reset button only after a submission has occurred */}
                    {successState && showForm && (
                        <div className="text-center mt-6">
                             <button onClick={handleResetForm} className={styles.resetButton}>
                                Submit another response
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        // Priority 3: Fallback for non-table, non-custom views after a submission attempt.
        if (successState) {
            if (error) {
                 return (
                    <div className={`${styles.successContainer}`}>
                        <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                            <span className="font-medium">Request Error:</span> {error.message}
                        </div>
                        {showForm && (
                            <button onClick={handleResetForm} className={styles.resetButton}>
                                Submit another response
                            </button>
                        )}
                    </div>
                );
            }
            // Simple success message
            return (
                 <div className={`${styles.successContainer}`}>
                    <div className="text-2xl text-green-500 dark:text-green-400 mb-4">✅</div>
                    <h3 className="text-xl font-semibold text-foreground">Success!</h3>
                    <div className={styles.successMessage}>{successMessage}</div>
                    {showForm && (
                        <button onClick={handleResetForm} className={styles.resetButton}>
                            Submit another response
                        </button>
                    )}
                </div>
            );
        }

        // Initially, if no other conditions are met, render nothing.
        return null;
    };

    return (
        <>
            {TriggerSubmitComponent && <TriggerSubmitComponent triggerSubmit={handleSubmit(handleFormSubmit)} isBusy={isBusy} />}
            {showForm && (
                <div className={styles.formContainer}>
                    <FormProvider {...formMethods}>
                        <form id={formId} onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
                            {renderSchema(formSchema)}

                            {finalShowSubmitButton && (
                                <div className="mt-8 flex items-center col-span-full justify-start">
                                    <button type="submit" disabled={isBusy} className={styles.submitButton}>
                                        {isSaving ? 'Saving...' : (isBusy ? loadingButtonText : submitButtonText)}
                                    </button>
                                    {isSaving && (
                                        <span className="ml-4 text-sm text-gray-500 animate-pulse">Processing...</span>
                                    )}
                                </div>
                            )}

                            {isSubmitted && !isBusy && !successState && error && (
                                <p className={`${styles.errorMessage} mt-4`}>{error.message}</p>
                            )}
                        </form>
                    </FormProvider>
                </div>
            )}
            {renderOutput()}
        </>
    );
}

DynamicForm.DataDisplayTable = DataDisplayTable;
