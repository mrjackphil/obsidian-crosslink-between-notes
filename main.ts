import {
    MarkdownView,
    Notice,
    Plugin,
    TFile
} from 'obsidian';

export default class MyPlugin extends Plugin {
    onload() {
        console.log('loading plugin');

        const addBacklink = () => {
            const currentView = this.app.workspace.activeLeaf.view

            const fileName = currentView.getDisplayText()

            if (!(currentView instanceof MarkdownView)) {
                return
            }

            const cm = currentView.sourceMode.cmEditor
            const cursor = cm.getCursor()
            const selectedRange = cm.getSelections().join('\n')
            const line = selectedRange || cm.getLine(cursor.line)

            const links = line.match(/\[\[.+?]]/gi)
            const files = this.app.vault.getFiles()

            let successed = [] as TFile[]

            links.forEach(async (lnk) => {
                const lnkName = lnk
                    .replace(/(\[\[|]])/g, '')
                    .replace(/\|.+/, '')
                    .replace(/#.+/, '')

                const file = files.filter(e => e.name === lnkName
                    || e.path === lnkName
                    || e.basename === lnkName
                )[0]

                if (file) {
                    const {vault} = this.app

                    const data = await vault.read(file)
                    await vault.modify(file, data + `\n[[${fileName}]]`)
                    successed.push(file)
                }

                new Notice(`Add link [[${fileName}]] to ${successed.map(e => e.basename).join(',')}`)
            })
        }

        this.addCommand({
            id: 'add-link-to-current',
            name: 'add links',
            callback: addBacklink,
            hotkeys: []
        })
    }

    onunload() {
        console.log('unloading plugin');
    }
}
