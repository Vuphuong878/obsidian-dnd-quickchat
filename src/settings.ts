import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import MyPlugin from './main';

export interface ChatMessage {
	sender: 'player' | 'npc';
	text: string;
	npcName?: string;
}

export interface MyPluginSettings {
	geminiApiKeys: string[];
	defaultPcNote: string; // Tên file chứa nhân vật PC mặc định
	chatHistory: ChatMessage[];
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	geminiApiKeys: ['', '', '', '', ''],
	defaultPcNote: 'Hero_Sylvie',
	chatHistory: []
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.plugin.activeSettingTab = this;

		containerEl.createEl('h2', { text: 'Cài đặt Đối thoại Nhập vai D&D AI' });

		containerEl.createEl('p', { 
			text: 'Hệ thống luân phiên (Fallback): Các khóa API sẽ tự động đổi từ model cao (3.5 -> 3 -> 2.5) và nhảy sang khóa tiếp theo nếu hết Quota. Khi tất cả các khóa đều cạn kiệt model cao, hệ thống sẽ sử dụng các model dự phòng Gemma.',
			cls: 'setting-item-description'
		});

		for (let i = 0; i < 5; i++) {
			new Setting(containerEl)
				.setName(`Gemini API Key ${i + 1}`)
				.setDesc(`Khóa API số ${i + 1}.`)
				.addText(text => text
					.setPlaceholder('Nhập API Key ở đây...')
					.setValue(this.plugin.settings.geminiApiKeys[i] || '')
					.onChange(async (value) => {
						this.plugin.settings.geminiApiKeys[i] = value;
						// Reset status cho key này khi cập nhật
						const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
						const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
						for (const m of [...goodModels, ...badModels]) {
							this.plugin.setApiModelStatus(i, m, 'AVAILABLE');
						}
						await this.plugin.saveSettings();
						this.display(); // Cập nhật lại giao diện ngay
					}));
		}

		new Setting(containerEl)
			.setName('Note Nhân Vật PC Mặc định')
			.setDesc('Tên Note chứa mô tả nhân vật của bạn (không ghi phần mở rộng .md).')
			.addText(text => text
				.setPlaceholder('Ví dụ: Hero_Sylvie')
				.setValue(this.plugin.settings.defaultPcNote)
				.onChange(async (value) => {
					this.plugin.settings.defaultPcNote = value;
					await this.plugin.saveSettings();
				}));

		// Bảng hiển thị Live Status Dashboard
		const statusContainer = containerEl.createDiv({ cls: 'dnd-status-container' });
		const statusHeader = statusContainer.createDiv({ cls: 'dnd-status-title' });
		statusHeader.createEl('span', { text: 'Bảng trạng thái Model & Quota API (Live)' });
		
		const resetBtn = statusHeader.createEl('button', { text: 'Đặt lại Trạng thái', cls: 'dnd-status-reset-btn' });
		resetBtn.addEventListener('click', () => {
			this.plugin.resetApiModelStatus();
			this.display();
			new Notice("Đã đặt lại trạng thái các model thành Sẵn sàng.");
		});

		const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
		const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
		const allModels = [...goodModels, ...badModels];

		for (let i = 0; i < 5; i++) {
			const keyRow = statusContainer.createDiv({ cls: 'dnd-status-key-row' });
			const apiKeyVal = this.plugin.settings.geminiApiKeys[i];
			const hasKey = apiKeyVal && apiKeyVal.trim().length > 0;
			
			keyRow.createDiv({ 
				text: `API Key ${i + 1}: ${hasKey ? `(${apiKeyVal.substring(0, 8)}...)` : '(Trống)'}`, 
				cls: `dnd-status-key-name ${hasKey ? '' : 'empty'}` 
			});
			
			const badgeContainer = keyRow.createDiv({ cls: 'dnd-status-badges' });
			
			for (const model of allModels) {
				const status = this.plugin.apiModelStatus[i]?.[model] || 'AVAILABLE';
				const badge = badgeContainer.createSpan({ cls: 'dnd-status-badge' });
				
				if (!hasKey) {
					badge.addClass('inactive');
					badge.setText(model);
				} else {
					if (status === 'AVAILABLE') {
						badge.addClass('available');
						badge.setText(`🟢 ${model}`);
					} else {
						badge.addClass('exhausted');
						badge.setText(`🔴 ${model}`);
					}
				}
			}
		}
	}
}