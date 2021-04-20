import {
    MarkdownView,
    Notice,
    Plugin,
    TFile
} from 'obsidian';

export default class AddLinkToCurrentNotePlugin extends Plugin {
    onload() {
        console.log('loading plugin');

        const addBacklink = () => {
            const currentView = this.app.workspace.activeLeaf.view

            const fileName = currentView.getDisplayText()

            if (!(currentView instanceof MarkdownView)) {
                return
            }

            const currentFile = currentView.file

            const cm = currentView.editor
            const cursor = cm.getCursor()
            const selectedRange = cm.getSelection()
            const line = selectedRange || cm.getLine(cursor.line)

            const regexpMD = /(\[.+])\([\w\s,.\-%$]+\)/gi
            const regexpWiki = /\[\[.+]]/gi

            const linksWiki = line.match(regexpWiki) || []
            const linksMD = line.match(regexpMD) || []
            const files = this.app.vault.getFiles()

            let succeed = [] as TFile[]

            const currentFileLink = this.app.fileManager.generateMarkdownLink(currentFile, currentFile.path)

            linksWiki.forEach(async (lnk) => {
                const lnkName = lnk
                    .replace(/(\[\[|]])/g, '')
                    .replace(/\|.+/, '')
                    .replace(/#.+/, '')

                const file = files.filter(e => e.name === lnkName
                    || e.path === lnkName
                    || e.basename === lnkName
                )[0]

                if (!file) {
                    return
                }

                if (file) {
                    const {vault} = this.app

                    const data = await vault.read(file)
                    await vault.modify(file, data + `\n` + currentFileLink)
                    succeed.push(file)
                }

                new Notice(`Add link [[${fileName}]] to ${succeed.map(e => e.basename).join(',')}`)
            })

            linksMD.forEach(async (lnk) => {
                const lnkName = lnk.match(/\(.+?\)/)[0]
                    ?.replace('.md', '')
                    ?.replace(/[()]/g, '')

                const file = files.filter(e => e.name === lnkName
                    || e.path === lnkName
                    || e.basename === lnkName
                )[0]

                if (!file) {
                    return
                }


                if (file) {
                    const {vault} = this.app

                    const data = await vault.read(file)
                    await vault.modify(file, data + `\n` + '- ' + currentFileLink)
                    succeed.push(file)
                }

                new Notice(`Add link [[${fileName}]] to ${succeed.map(e => e.basename).join(',')}`)
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
