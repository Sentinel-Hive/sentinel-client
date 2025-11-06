import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function parseFlexibleJson(text: string): { objects: unknown[] } {
    const trimmed = text.trim();
    const out: unknown[] = [];

    // 1) Try plain JSON (object/array/primitive)
    try {
        const v = JSON.parse(trimmed);
        out.push(v);
        return { objects: out };
    } catch {
        // continue
    }

    // 2) Try NDJSON (JSON Lines) — one JSON object per non-empty line
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length > 1) {
        try {
            const objs = lines.map((l) => JSON.parse(l));
            return { objects: objs };
        } catch {
            // fall through to concatenated parser
        }
    }

    // 3) Try concatenated objects: {}{} or {} \n {} \n {}
    //    Streaming parse by brace/bracket depth and string handling
    const objs: unknown[] = [];
    let i = 0;
    const n = trimmed.length;
    const isWs = (c: string) => /\s/.test(c);

    while (i < n) {
        // skip whitespace
        while (i < n && isWs(trimmed[i])) i++;

        if (i >= n) break;
        const start = i;

        // Determine first non-ws char must begin a JSON value
        const first = trimmed[i];
        if (!'{["tfn-0123456789'.includes(first)) {
            // not a valid start => fail this strategy
            break;
        }

        // If it’s a primitive (true/false/null/number/string), let JSON.parse
        // find its boundary by scanning forward until it parses
        if (first !== "{" && first !== "[") {
            let j = i + 1;
            let parsed = false;
            while (j <= n) {
                try {
                    const chunk = trimmed.slice(i, j);
                    const v = JSON.parse(chunk);
                    objs.push(v);
                    i = j;
                    parsed = true;
                    break;
                } catch {
                    j++;
                }
            }
            if (!parsed) break;
            continue;
        }

        // If it’s an object/array, track bracket depth safely
        let depth = 0;
        let inStr = false;
        let esc = false;

        while (i < n) {
            const c = trimmed[i];
            if (inStr) {
                if (esc) {
                    esc = false;
                } else if (c === "\\") {
                    esc = true;
                } else if (c === '"') {
                    inStr = false;
                }
            } else {
                if (c === '"') inStr = true;
                else if (c === "{" || c === "[") depth++;
                else if (c === "}" || c === "]") {
                    depth--;
                    if (depth === 0) {
                        // end of a complete JSON value
                        const chunk = trimmed.slice(start, i + 1);
                        try {
                            const v = JSON.parse(chunk);
                            objs.push(v);
                            i = i + 1;
                            break;
                        } catch {
                            // can't parse this chunk => abort
                            i = n + 1; // force failure
                            break;
                        }
                    }
                }
            }
            i++;
        }

        if (depth !== 0) {
            // unbalanced
            break;
        }
    }

    if (objs.length > 0) {
        return { objects: objs };
    }

    throw new Error("Invalid JSON: not a single JSON value, NDJSON, or concatenated JSON objects.");
}

export const formatSize = (sizeInBytes: number) => {
    if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
};
