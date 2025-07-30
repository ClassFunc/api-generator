
// --- ĐỊNH NGHĨA TYPE MỚI ---
import {z} from "zod";
import {FieldValues} from "react-hook-form";
import {get} from "lodash";
import {getAuth} from "firebase/auth";


// =================================================================
// --- ZOD SCHEMA DEFINITIONS ---
// =================================================================

//TYPES

export const InputTypeSchema = z.enum([
    "text",
    "url",
    "password",
    "submit",
    "checkbox",
    "radio",
    "button",
    "file",
    "date",
    "email",
    "number",
    "range",
    "color",
    "hidden",
    "datetime-local",
    "date",
    "datetime",
    'switch'
]);

export type IInputTypeSchema = z.infer<typeof InputTypeSchema>;
/**
 * Schema cho cấu hình fetch API cơ bản.
 * Đây là nền tảng cho cả fetchOnInit và effects.
 */
export const FetchConfigSchema = z.object({
    /**
     * URL của API endpoint cần gọi.
     */
    endpoint: z.string().url({message: "Endpoint phải là một URL hợp lệ."}),

    /**
     * Phương thức HTTP. Mặc định là 'GET'.
     */
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET').optional(),

    /**
     * Headers cho request, hỗ trợ placeholder.
     */
    headers: z.record(z.any()).optional(),

    /**
     * Body của request (dành cho POST, PUT, PATCH), hỗ trợ placeholder.
     */
    body: z.record(z.any()).optional(),

    /**
     * Đường dẫn đến mảng options trong dữ liệu JSON trả về.
     */
    optionsPath: z.string().optional(),
    // --- THÊM CÁC TRƯỜNG MỚI ---
    /**
     * Tên của trường trong object trả về sẽ được dùng làm `value` cho option.
     * Ví dụ: 'id', '_id', 'code'
     */
    valueField: z.string().default('value').optional(),

    /**
     * Tên của trường trong object trả về sẽ được dùng làm `label` cho option.
     * Ví dụ: 'name', 'title', 'description'
     */
    labelField: z.string().default('label').optional(),
});

// =================================================================
// --- INFERRED TYPES FROM ZOD ---
// =================================================================

// Tự động tạo type từ Zod schema, không cần định nghĩa thủ công nữa
export type FetchConfig = z.infer<typeof FetchConfigSchema>;

/**
 * Schema cho một "effect", kế thừa từ FetchConfigSchema.
 */
export const EffectSchema = FetchConfigSchema.extend({
    /**
     * Hành động sẽ được thực thi.
     */
    action: z.literal('fetchOptions'),

    /**
     * Tên của field mà effect này sẽ lắng nghe sự thay đổi.
     */
    listensTo: z.string(),
});

/**
 * Schema cho tất cả metadata của UI, được nhúng trong Zod schema qua `.describe()`.
 */
export const UiMetadataSchema = z.object({
    label: z.string().optional(),
    placeholder: z.string().optional(),

    // --- THAY ĐỔI Ở ĐÂY ---
    // Chuyển từ z.enum sang z.string() để cho phép bất kỳ component key nào.
    // Ví dụ: 'input', 'textarea', 'chip', 'shadcn-select', 'date-picker'
    component: z.union([
        z.enum(['input', 'textarea', 'select']),
        z.string().describe('for custom type from design system. ex: shadcn')
    ]).default('input').optional(),
    type: InputTypeSchema.optional(),

    options: z.array(z.object({
        value: z.any(),
        label: z.string(),
    })).optional(),
    helperText: z.string().optional(),
    seeMoreLink: z.string().url().optional(),
    inputProps: z.record(z.any()).optional(),

    /**
     * Cấu hình để field tự động fetch dữ liệu khi form được tải.
     * Sử dụng FetchConfigSchema.
     */
    fetchOnInit: FetchConfigSchema.optional(),

    /**
     * Mảng các "effects" để phản ứng với sự thay đổi của các field khác.
     * Sử dụng một mảng của EffectSchema.
     */
    effects: z.array(EffectSchema).optional(),

    /**
     * Tự động lưu form khi giá trị của field này thay đổi (với debounce).
     * Hữu ích cho các field như filter text, switch,...
     */
    saveOnChange: z.boolean().optional(),
    __passthrough: z.boolean().default(false).optional(),
});


export type IUiMetadataSchema = z.infer<typeof UiMetadataSchema>; // ... các hàm helper getZodInnerType, getUiMetadata, getHtmlInputType giữ nguyên ...

export const getZodInnerType = (zodType: z.ZodTypeAny): z.ZodTypeAny => {
    if (zodType._def.innerType) {
        return getZodInnerType(zodType._def.innerType);
    }
    return zodType;
};

export const getUiMetadata = (zodType: z.ZodTypeAny): IUiMetadataSchema | undefined => {
    const coreType = getZodInnerType(zodType);
    const description = coreType.description;

    if (!description) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(description);
        const result = UiMetadataSchema.safeParse(parsed.ui);
        return result.success ? result.data : {};
    } catch (error) {
        return undefined;
    }
};

/**
 * Duyệt đệ quy qua một Zod schema và áp dụng `.passthrough()` cho các ZodObject
 * có cờ `__passthrough: true` trong metadata.
 * Điều này đảm bảo Zod không loại bỏ các trường động (`__additionalFields`) trong quá trình validation.
 * @param schema - Zod schema đầu vào.
 * @returns Một Zod schema mới đã được xử lý.
 */
export const makeSchemaPassthroughCompatible = (schema: z.ZodTypeAny): z.ZodTypeAny => {
    // 1. Xử lý các wrapper trước để bảo toàn chúng (optional, nullable, default, array)
    if (schema instanceof z.ZodOptional) {
        return makeSchemaPassthroughCompatible(schema.unwrap()).optional();
    }
    if (schema instanceof z.ZodNullable) {
        return makeSchemaPassthroughCompatible(schema.unwrap()).nullable();
    }
    if (schema instanceof z.ZodDefault) {
        return makeSchemaPassthroughCompatible(schema._def.innerType).default(schema._def.defaultValue);
    }
    if (schema instanceof z.ZodArray) {
        return z.array(makeSchemaPassthroughCompatible(schema.element));
    }

    // 2. Xử lý trường hợp cốt lõi: ZodObject
    if (schema instanceof z.ZodObject) {
        const uiConfig = getUiMetadata(schema);
        const newShape = Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, makeSchemaPassthroughCompatible(value as z.ZodTypeAny)]));
        let newSchema = z.object(newShape);
        if (uiConfig?.__passthrough) {
            // @ts-ignore
            newSchema = newSchema.passthrough();
        }
        return newSchema;
    }

    // 3. Với các kiểu dữ liệu nguyên thủy khác, trả về chính nó
    return schema;
};

export const getHtmlInputType = (zodType: z.ZodTypeAny): IInputTypeSchema => {
    const coreType = getZodInnerType(zodType);
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

// +++ MODIFIED: Hàm resolvePlaceholders được nâng cấp để xử lý đệ quy +++
export const resolvePlaceholders = (template: any, formValues: FieldValues): any => {
    // 1. Nếu template là một chuỗi, thực hiện thay thế
    if (typeof template === 'string') {
        // Cải tiến Regex để hỗ trợ cả path lồng nhau, ví dụ: {{user.id}}
        return template.replace(/{{\s*([\w.-]+)\s*}}/g, (match, fieldName) => {
            // Dùng lodash.get để lấy giá trị an toàn, kể cả path lồng nhau
            return get(formValues, fieldName, '');
        });
    }

    // 2. Nếu template là một mảng, duyệt qua từng phần tử
    if (Array.isArray(template)) {
        return template.map(item => resolvePlaceholders(item, formValues));
    }

    // 3. Nếu template là một object (nhưng không phải null), duyệt qua các giá trị của nó
    if (template && typeof template === 'object') {
        return Object.keys(template).reduce((acc, key) => {
            acc[key] = resolvePlaceholders(template[key], formValues);
            return acc;
        }, {} as Record<string, any>);
    }

    // 4. Trả về nguyên bản nếu không phải các kiểu trên (number, boolean, null, ...)
    return template;
};

/**
 * Lấy ID token của người dùng hiện tại một cách an toàn.
 * @returns {Promise<string | null>} Trả về token nếu thành công, ngược lại trả về null.
 */
export const getAuthToken = async (): Promise<string | null> => {
    try {
        const currentUser = getAuth().currentUser;
        if (!currentUser) {
            // Người dùng chưa đăng nhập, đây là trường hợp hợp lệ, không phải lỗi.
            return null;
        }
        return await currentUser.getIdToken();
    } catch (error) {
        // Có lỗi xảy ra khi lấy token (ví dụ: mạng, session hết hạn).
        // console.error("Error getting Firebase auth token:", error);
        return null;
    }
};
