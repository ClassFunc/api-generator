// --- ĐỊNH NGHĨA TYPE MỚI ---
import {z} from "zod";

/*
@note: Đồng bộ Schema này với server để có gợi ý tốt hơn
* */
export const InputFormHelpers = z.object({
    type: z.enum(['text', 'number', 'datetime-local', 'hidden', 'select']).optional(),
    placeholder: z.string().optional(),
    label: z.string().optional(),
    seeMoreLink: z.string().optional(),
    helperText: z.string().optional(),
    component: z.enum(['input', 'textarea', 'switch', 'radio', 'checkbox']).optional(),
    inputProps: z.record(z.union([z.string(), z.number()])).optional(),
    // Thêm 'options' cho radio và checkbox
    options: z.array(z.object({
        value: z.string(),
        label: z.string(),
    })).optional(),
}).passthrough().optional();
export type IParsedDescriptionUIType = z.infer<typeof InputFormHelpers>; // ... các hàm helper getZodInnerType, getUiMetadata, getHtmlInputType giữ nguyên ...

export const getZodInnerType = (zodType: z.ZodTypeAny): z.ZodTypeAny => {
    if (zodType._def.innerType) {
        return getZodInnerType(zodType._def.innerType);
    }
    return zodType;
};
export const getUiMetadata = (zodType: z.ZodTypeAny): IParsedDescriptionUIType | undefined => {
    const coreType = getZodInnerType(zodType);
    const description = coreType.description;

    if (!description) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(description);
        const result = InputFormHelpers.safeParse(parsed.ui);
        return result.success ? result.data : {};
    } catch (error) {
        return undefined;
    }
};
export const getHtmlInputType = (zodType: z.ZodTypeAny): string => {
    const coreType = getZodInnerType(zodType);
    if (coreType instanceof z.ZodEnum) {
        return 'select';
    }
    if (coreType instanceof z.ZodNumber) {
        return 'number';
    }
    if (coreType instanceof z.ZodString) {
        if (coreType.isDatetime) return 'datetime-local';
        if (coreType.isEmail) return 'email';
        if (coreType.isURL) return 'url';
    }
    return 'text';
};