import which from 'which'
import path from 'path'

export function executable(cmd: string): boolean {
    try {
        which.sync(cmd)
    } catch (e) {
        return false
    }
    return true
}

export function wait(ms: number): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(undefined)
        }, ms)
    })
}

export function isParentFolder(folder: string, filepath: string): boolean {
    const rel = path.relative(folder, filepath)
    return !rel.startsWith('..')
}
