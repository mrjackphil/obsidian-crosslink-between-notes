import {
    App,
    MarkdownView,
    Notice,
    Plugin, PluginSettingTab, Setting,
    TFile
} from 'obsidian';

interface PluginSettings {
    template: string
}

const DEFAULT_SETTINGS: PluginSettings = {
    template: '- $link'
}

export default class AddLinkToCurrentNotePlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        console.log('loading plugin');

        await this.loadSettings();

        this.addSettingTab(new CrosslinkSettingsTab(this.app, this));

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

            let succeed = [] as TFile[]

            const currentFileLink = this.app.fileManager.generateMarkdownLink(currentFile, currentFile.path)
            const lineToPaste = this.settings.template.replace('$link', currentFileLink)

            const ar = [linksWiki, linksMD]
            ar.flat().forEach(async (lnk) => {
                const wikiName = lnk
                    .replace(/(\[\[|]])/g, '')
                    .replace(/\|.+/, '')
                    .replace(/#.+/, '')

                const mdName = lnk.match(/\(.+?\)/)[0]
                    ?.replace('.md', '')
                    ?.replace('%20', ' ')
                    ?.replace(/[()]/g, '')

                const file = this.getFilesByName(wikiName) || this.getFilesByName(mdName)

                if (!file) {
                    return
                }

                if (file) {
                    const {vault} = this.app

                    const data = await vault.read(file)
                    await vault.modify(file, data + `\n` + lineToPaste)
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

    getFilesByName(name: string) {
        const files = this.app.vault.getFiles()

        return files.filter(e => e.name === name
            || e.path === name
            || e.basename === name
        )[0]
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class CrosslinkSettingsTab extends PluginSettingTab {
    plugin: AddLinkToCurrentNotePlugin;

    constructor(app: App, plugin: AddLinkToCurrentNotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for "Add links to the current note" plugin'});

        new Setting(containerEl)
            .setName('Template')
            .setDesc('How the link will be pasted. `$link` will be replaced with link itself.')
            .addText(text => text
                .setValue(this.plugin.settings.template)
                .onChange(async (value) => {
                    this.plugin.settings.template = value;
                    await this.plugin.saveSettings();
                }));
    }
}
