import { ExtensionContext, workspace, listManager } from 'coc.nvim'
import FilesMru from './list'

export async function activate(context: ExtensionContext): Promise<void> {
    const { subscriptions } = context
    subscriptions.push(listManager.registerList(new FilesMru(workspace.nvim)))
}
