export const isIncludes = (src: string, text: string): boolean => {
    return src.replace(/\s/g, '').includes(text.replace(/\s/g, ''))
}
