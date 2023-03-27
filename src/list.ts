import { ChildProcess, spawn } from 'child_process'
import {
    BasicList,
    ListContext,
    ListItem,
    ListTask,
    Location,
    Mru,
    Neovim,
    Range,
    Uri,
    workspace,
} from 'coc.nvim'
import { EventEmitter } from 'events'
import fs from 'fs'
import minimatch from 'minimatch'
import path from 'path'
import readline from 'readline'
import { executable, isParentFolder } from './util'
import { URI } from 'vscode-uri'

class Task extends EventEmitter implements ListTask {
    private processes: ChildProcess[] = []

    public start(
        cmd: string,
        args: string[],
        cwds: string[],
        patterns: string[]
    ): void {
        let remain = cwds.length
        const config = workspace.getConfiguration('list.source.files')
        const filterByName = config.get<boolean>('filterByName', false)
        for (const cwd of cwds) {
            const process = spawn(cmd, args, { cwd })
            this.processes.push(process)
            process.on('error', (e) => {
                this.emit('error', e.message)
            })
            const rl = readline.createInterface(process.stdout)
            const range = Range.create(0, 0, 0, 0)
            const hasPattern = patterns.length > 0
            process.stderr.on('data', (chunk) => {
                console.error(chunk.toString('utf8')) // tslint:disable-line
            })

            rl.on('line', (line) => {
                let file = line
                if (file.indexOf(cwd) < 0) {
                    file = path.join(cwd, line)
                }
                if (hasPattern && patterns.some((p) => minimatch(file, p)))
                    return
                const location = Location.create(
                    Uri.file(file).toString(),
                    range
                )
                if (!filterByName) {
                    this.emit('data', {
                        label: line,
                        sortText: file,
                        location,
                    })
                } else {
                    const name = path.basename(file)
                    this.emit('data', {
                        label: `${name}\t${line}`,
                        sortText: file,
                        filterText: name,
                        location,
                    })
                }
            })
            rl.on('close', () => {
                remain = remain - 1
                if (remain == 0) {
                    this.emit('end')
                }
            })
        }
    }

    public dispose(): void {
        for (const process of this.processes) {
            if (!process.killed) {
                process.kill()
            }
        }
    }
}

export default class FilesList extends BasicList {
    private mru: Mru
    public readonly name = 'filesMru'
    public readonly defaultAction = 'open'
    public description = 'Search files with a mru list'
    public readonly detail = `A files finder plugin running at hacked coc.nvim. See: https://github.com/hexh250786313/coc-list-files-mru`
    public options = [
        {
            name: '-F, -folder',
            description:
                'Search files from current workspace folder instead of cwd.',
        },
        {
            name: '-W, -workspace',
            description:
                'Search files from all workspace folders instead of cwd.',
        },
    ]
    constructor(nvim: Neovim) {
        super(nvim)
        this.mru = workspace.createMru('mru')
        this.addLocationActions()
    }

    private getArgs(args: string[], defaultArgs: string[]): string[] {
        return args.length ? args : defaultArgs
    }

    public getCommand(): { cmd: string; args: string[] } {
        const config = workspace.getConfiguration('list.source.files')
        const cmd = config.get<string>('command', '')
        const args = config.get<string[]>('args', [])
        if (!cmd) {
            if (executable('rg')) {
                return {
                    cmd: 'rg',
                    args: this.getArgs(args, ['--color', 'never', '--files']),
                }
            } else if (executable('ag')) {
                return {
                    cmd: 'ag',
                    args: this.getArgs(args, ['-f', '-g', '.', '--nocolor']),
                }
            } else if (process.platform == 'win32') {
                return {
                    cmd: 'dir',
                    args: this.getArgs(args, ['/a-D', '/S', '/B']),
                }
            } else if (executable('find')) {
                return {
                    cmd: 'find',
                    args: this.getArgs(args, ['.', '-type', 'f']),
                }
            } else {
                throw new Error('Unable to find command for files list.')
            }
        } else {
            return { cmd, args }
        }
    }

    public async loadItems(
        context: ListContext
    ): Promise<ListTask | ListItem[] | null | undefined> {
        if (context.input.length > 0) {
            return this.loadFiles(context)
        }
        if (context.input.length === 0) {
            return this.loadMru(context)
        }
    }

    public doHighlight(): void {
        const config = workspace.getConfiguration('list.source.files')
        const filterByName = config.get<boolean>('filterByName', false)
        if (filterByName) {
            const { nvim } = this
            nvim.pauseNotification()
            nvim.command(
                'syntax match CocFilesFile /\\t.*$/ contained containedin=CocFilesLine',
                true
            )
            nvim.command('highlight default link CocFilesFile Comment', true)
            nvim.resumeNotification(false, true)
        }
    }

    private async loadMru(context: ListContext) {
        const cwd = context.cwd
        const findAll = context.args.indexOf('-A') !== -1
        let files = await this.mru.load()
        const config = workspace.getConfiguration('list.source.mru')
        const filterByName = config.get<boolean>('filterByName', false)
        const range = Range.create(0, 0, 0, 0)
        if (!findAll) files = files.filter((file) => isParentFolder(cwd, file))
        return files.map((file, i) => {
            const uri = URI.file(file).toString()
            const location = Location.create(uri.toString(), range)
            if (!filterByName) {
                return {
                    label: findAll ? file : path.relative(cwd, file),
                    data: { uri },
                    sortText: String.fromCharCode(i),
                    location,
                }
            } else {
                const name = path.basename(file)
                file = findAll ? file : path.relative(cwd, file)
                return {
                    label: `${name}\t${file}`,
                    data: { uri },
                    sortText: String.fromCharCode(i),
                    filterText: name,
                    location,
                }
            }
        })
    }

    private async loadFiles(context: ListContext) {
        const { nvim } = this
        const { window, args } = context
        const options = this.parseArguments(args)
        const res = this.getCommand()
        if (!res) return null
        const used = res.args.concat(['-F', '-folder', '-W', '-workspace'])
        const extraArgs = args.filter((s) => used.indexOf(s) == -1)
        let cwds: string[] = []
        const dirArgs = []
        const searchArgs = []
        if (options.folder) {
            cwds = [workspace.rootPath]
        } else if (options.workspace) {
            cwds = workspace.workspaceFolders.map(
                (f) => Uri.parse(f.uri).fsPath
            )
        } else {
            if (extraArgs.length > 0) {
                // tslint:disable-next-line: prefer-for-of
                for (let i = 0; i < extraArgs.length; i++) {
                    const d = await nvim.call('expand', extraArgs[i])
                    try {
                        if (fs.lstatSync(d).isDirectory()) {
                            dirArgs.push(d)
                        } else {
                            searchArgs.push(d)
                        }
                    } catch (e) {
                        searchArgs.push(d)
                    }
                }
            }
            if (dirArgs.length > 0) {
                cwds = dirArgs
            } else {
                const valid = await window.valid
                if (valid) {
                    cwds = [await nvim.call('getcwd', window.id)]
                } else {
                    cwds = [await nvim.call('getcwd')]
                }
            }
        }
        const task = new Task()
        const excludePatterns = this.getConfig().get<string[]>(
            'excludePatterns',
            []
        )
        task.start(res.cmd, res.args.concat(searchArgs), cwds, excludePatterns)
        return task
    }
}
