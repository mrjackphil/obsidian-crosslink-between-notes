import {
    App, fuzzySearch, FuzzySuggestModal, MarkdownPreviewView,
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

        this.addCommand({
            id: 'add-link-to-current',
            name: 'add links to the notes from the line or selection',
            callback: this.addBacklink.bind(this),
            hotkeys: []
        })

        this.addCommand({
            id: 'add-link-from-quick-switcher',
            name: 'add links to the note from the quick switcher',
            callback: () => {
                const modal = new FilesModal(this.app, this)
                modal.open()
            },
            hotkeys: []
        })

        // this.addCommand(
        //     {
        //         id: 'add-link-to-backlinks',
        //         name: 'add links to the backlinks',
        //         callback: this.addLinkToBacklinks.bind(this),
        //         hotkeys: []
        //     }
        // )
    }

    onunload() {
        console.log('unloading plugin');
    }

    // addLinkToBacklinks() {
    //     const currentView = this.app.workspace.activeLeaf.view
    //     if (!(currentView instanceof MarkdownView)) {
    //         return
    //     }
    //
    //     const currentFile = currentView.file
    //
    //     // @ts-ignore
    //     const backlinks = this.app.metadataCache.getBacklinksForFile(currentFile)?.data
    //     const backlinkPaths = Object.keys(backlinks)
    // }

    addBacklink = async (files?: TFile[]) => {
        const currentView = this.app.workspace.activeLeaf.view

        const fileName = currentView.getDisplayText()

        let filesToProduce = files
            ? files
            : currentView instanceof MarkdownView
                ? this.getFilesFromLineOrSelection(currentView)
                : []

        if (!(currentView instanceof MarkdownView)) {
            return
        }

        const currentFile = currentView.file

        const currentFileLink = this.app.fileManager.generateMarkdownLink(currentFile, currentFile.path)
        const lineToPaste = this.settings.template.replace('$link', currentFileLink)

        let succeed = [] as TFile[]

        await Promise.all(filesToProduce.map(async (file) => {
            if (file) {
                const {vault} = this.app

                const data = await vault.read(file)
                await vault.modify(file, data + `\n` + lineToPaste)
                succeed.push(file)
            }
            return Promise.resolve()
        }))
        new Notice(`Add link [[${fileName}]] to ${succeed.map(e => e.basename).join(',')}`)
    }

    getFilesFromLineOrSelection(view: MarkdownView): TFile[] {
        const cm = view.editor
        const cursor = cm.getCursor()
        const selectedRange = cm.getSelection()
        const line = selectedRange || cm.getLine(cursor.line)

        const regexpMD = /(\[.+?])\(.+?\)/gi
        const regexpWiki = /\[\[.+?]]/gi

        const linksWiki = line.match(regexpWiki) || []
        const linksMD = line.match(regexpMD) || []

        const ar = [linksWiki, linksMD].filter(e => e.length)

        return ar.flat().map((lnk) => {
            const wikiName = lnk
                .replace(/(\[\[|]])/g, '')
                .replace(/\|.+/, '')
                .replace(/#.+/, '')

            const mdName = decodeURI(lnk.match(/\(.+?\)/)?.[0]
                ?.replace('.md', '')
                ?.replace(/[()]/g, ''))

            return this.getFilesByName(wikiName) || this.getFilesByName(mdName)

        })
    }

    getFilesByName(name: string | string[]) {
        const files = this.app.vault.getFiles()

        if (Array.isArray(name)) {
            return files.filter(e => name.includes(e.name)
                || name.includes((e.path))
                || name.includes(e.basename)
            )[0]
        }

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

class FilesModal extends FuzzySuggestModal<TFile> {
    files: TFile[];
    newNoteResult: HTMLDivElement;
    suggestionEmpty: HTMLDivElement;
    obsFile: any;
    noSuggestion: boolean;
    plugin: AddLinkToCurrentNotePlugin;

    EMPTY_TEXT = 'Files not found';

    constructor(app: App, plugin: AddLinkToCurrentNotePlugin) {
        super(app);
        this.plugin = plugin;
        this.init();
    }

    init() {
        this.files = this.app.vault.getMarkdownFiles();
        this.emptyStateText = this.EMPTY_TEXT;
        // this.setPlaceholder(PLACEHOLDER_TEXT);
        this.setInstructions(
            [
                {command: '↑↓', purpose: 'to navigate'},
                {command: '↵', purpose: 'to append link to the file'},
                {command: 'esc', purpose: 'to dismiss'}
            ]
        );
        this.initNewNoteItem();
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(item: TFile): string {
        this.noSuggestion = false;
        return item.basename;
    }

    onNoSuggestion() {
        this.noSuggestion = true;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        if (this.noSuggestion) {
            // this.modalNoteCreation.create(this.inputEl.value);
        } else {
            this.plugin.addBacklink([item])
        }
    }

    initNewNoteItem() {
        this.newNoteResult = document.createElement('div');
        this.newNoteResult.addClasses(['suggestion-item', 'is-selected']);
        this.suggestionEmpty = document.createElement('div');
        this.suggestionEmpty.addClass('suggestion-empty');
        this.suggestionEmpty.innerText = this.EMPTY_TEXT;
    }

    itemInstructionMessage(resultEl: HTMLElement, message: string) {
        const el = document.createElement('kbd');
        el.addClass('suggestion-hotkey');
        el.innerText = message;
        resultEl.appendChild(el);
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
