// --- ĐỊNH NGHĨA TYPE MỚI ---
import {z} from "zod";
import {FieldValues} from "react-hook-form";
import {get} from "lodash";
import {getAuth} from "firebase/auth";

// +++ MODIFIED: Mở rộng EffectSchema
const EffectSchema = z.object({
    // Field cần lắng nghe sự thay đổi
    listensTo: z.string(),
    // Hành động cần thực hiện
    action: z.enum(['fetchOptions']),
    // Endpoint API
    endpoint: z.string().url(),
    // +++ NEW: Phương thức HTTP, mặc định là POST
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('POST'),
    // +++ NEW: Headers cho request, hỗ trợ placeholder
    headers: z.record(z.string()).optional(),
    // +++ NEW: Body của request, hỗ trợ placeholder
    // Ví dụ: { "countryCode": "{{country}}", "searchTerm": "{{search_term}}" }
    body: z.record(z.any()).optional(),
    // Tên của field trong object trả về chứa mảng options (hữu ích khi API trả về dạng { data: [...] })
    optionsPath: z.string().optional(),
});

/*
@note: Đồng bộ Schema này với server để có gợi ý tốt hơn
* */
export const InputFormHelpers = z.object({
    type: z.enum(['text', 'number', 'datetime-local', 'hidden', 'select']).optional(),
    placeholder: z.string().optional(),
    label: z.string().optional(),
    seeMoreLink: z.string().optional(),
    helperText: z.string().optional(),
    component: z.enum(['input', 'textarea', 'switch', 'radio', 'checkbox', 'select']).optional(),
    inputProps: z.record(z.union([z.string(), z.number()])).optional(),
    options: z.array(z.object({
        value: z.any(),
        label: z.string(),
    })).optional(),
    // Mảng các "side effects" giờ đây mạnh mẽ hơn
    effects: z.array(EffectSchema).optional(),
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
}; // +++ NEW: Hàm helper để lấy Firebase Auth Token một cách an toàn +++
// --- Helper function để thay thế placeholders ---
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