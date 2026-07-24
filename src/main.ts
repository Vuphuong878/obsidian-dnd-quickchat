import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { QuickChatView, VIEW_TYPE_QUICK_CHAT } from './chat-view';
import { MyPluginSettings, DEFAULT_SETTINGS, SampleSettingTab } from './settings';

export default class MyPlugin extends Plugin {
	settings!: MyPluginSettings;
	apiModelStatus: { [keyIndex: number]: { [modelName: string]: 'AVAILABLE' | 'EXHAUSTED' } } = {};
	activeSettingTab: any = null;

	resetApiModelStatus() {
		const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
		const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
		const allModels = [...goodModels, ...badModels];
		this.apiModelStatus = {};
		const keyCount = this.settings?.geminiApiKeys?.length || 5;
		for (let i = 0; i < keyCount; i++) {
			const statusMap: { [modelName: string]: 'AVAILABLE' | 'EXHAUSTED' } = {};
			for (const model of allModels) {
				statusMap[model] = 'AVAILABLE';
			}
			this.apiModelStatus[i] = statusMap;
		}
	}

	setApiModelStatus(keyIndex: number, model: string, status: 'AVAILABLE' | 'EXHAUSTED') {
		if (!this.apiModelStatus[keyIndex]) {
			this.apiModelStatus[keyIndex] = {};
		}
		const oldStatus = this.apiModelStatus[keyIndex][model];
		this.apiModelStatus[keyIndex][model] = status;
		if (oldStatus !== status) {
			this.triggerStatusUpdate();
		}
	}

	triggerStatusUpdate() {
		if (this.activeSettingTab && this.activeSettingTab.containerEl && document.body.contains(this.activeSettingTab.containerEl)) {
			this.activeSettingTab.display();
		}
	}

	async onload() {
		this.resetApiModelStatus();
		await this.loadSettings();

		// Đăng ký View Sidebar Chat độc lập
		this.registerView(
			VIEW_TYPE_QUICK_CHAT,
			(leaf) => new QuickChatView(leaf, this)
		);

		// Đăng ký Icon Ribbon bên góc trái Obsidian để mở panel
		this.addRibbonIcon('message-square-plus', 'Kích hoạt Đối thoại nhanh AI', () => {
			this.activateChatView();
		});

		// Tạo Command để mở tính năng qua Command Palette (Ctrl/Cmd + P)
		this.addCommand({
			id: 'open-dnd-quick-chat',
			name: 'Mở cửa sổ Đối thoại nhanh AI',
			callback: () => {
				this.activateChatView();
			}
		});

		// Tạo Command bật/tắt thuộc tính quickchat trong frontmatter cho tệp đang mở
		this.addCommand({
			id: 'toggle-quickchat-context',
			name: 'Bật/Tắt ngữ cảnh QuickChat (quickchat: true/false) cho tệp hiện tại',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('Không có tệp nào đang mở!');
					return;
				}

				let newState = true;
				await this.app.fileManager.processFrontMatter(activeFile, (fm) => {
					newState = fm.quickchat !== true;
					fm.quickchat = newState;
				});

				new Notice(`Đã ${newState ? 'BẬT' : 'TẮT'} thuộc tính quickchat cho "${activeFile.basename}".`);
			}
		});

		// Nạp bảng Cài đặt
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
		// Hủy View khi tắt Plugin tránh rò rỉ bộ nhớ
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_QUICK_CHAT);
	}

	async activateChatView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_QUICK_CHAT)[0] || null;

		if (!leaf) {
			// Mở panel ở Sidebar bên phải
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({
					type: VIEW_TYPE_QUICK_CHAT,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		const data = await this.loadData() || {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.resetApiModelStatus();

		// Migration: Move old geminiApiKey to geminiApiKeys[0] if exists
		if (data.geminiApiKey && typeof data.geminiApiKey === 'string') {
			if (!this.settings.geminiApiKeys) {
				this.settings.geminiApiKeys = [''];
			}
			if (this.settings.geminiApiKeys[0] === '') {
				this.settings.geminiApiKeys[0] = data.geminiApiKey;
			}
			delete data.geminiApiKey;
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
