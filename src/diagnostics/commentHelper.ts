export function buildCommentMap(lines: string[]): boolean[] {
    const commented: boolean[] = new Array(lines.length).fill(false);
    let inBlock = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        if (inBlock) {
            commented[i] = true;
            if (line.includes('*/')) { inBlock = false; }
        } else if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
            commented[i] = true;
        } else {
            const blockStart = line.indexOf('/*');
            if (blockStart >= 0 && !line.includes('*/', blockStart + 2)) {
                inBlock = true;
                if (trimmed.startsWith('/*')) { commented[i] = true; }
            }
        }
    }
    return commented;
}

export function stripInlineComment(line: string): string {
    const match = line.match(/^(.*?)(?<![:/])\/\/.*$/);
    return match ? match[1] : line;
}
