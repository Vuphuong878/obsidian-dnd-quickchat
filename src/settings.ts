import { App, PluginSettingTab, Setting, Notice, Menu } from 'obsidian';
import MyPlugin from './main';

export interface ChatMessage {
	sender: 'player' | 'npc';
	text: string;
	npcName?: string;
}

export interface ProxyConfig {
	id: string;
	url: string;
	key: string;
	format: 'auto' | 'openai' | 'gemini';
	selectedModel?: string;
	customModelName?: string;
}

export interface MyPluginSettings {
	geminiApiKeys: string[];
	defaultPcNote: string; // Tên file chứa nhân vật PC mặc định
	chatHistory: ChatMessage[];
	lastSelectedNpcs: string[];
	lastSelectedPcs: string[];
	isProxyEnabled: boolean;
	proxies: ProxyConfig[];
	customPrompt: string;
	customStyle: string;
	customRules: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	geminiApiKeys: ['', '', '', '', ''],
	defaultPcNote: 'Hero_Sylvie',
	chatHistory: [],
	lastSelectedNpcs: [],
	lastSelectedPcs: [],
	isProxyEnabled: false,
	proxies: [],
	customPrompt: 'Bạn đang nhập vai là **Nhân vật chính (PC)** trong thế giới D&D.',
	customStyle: '',
	customRules: ''
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

		containerEl.createEl('h3', { text: 'Cài đặt Proxy Tùy chỉnh (Custom Reverse Proxy)' });

		new Setting(containerEl)
			.setName('Bật Custom Proxy Toàn Cục')
			.setDesc('Khi bật, mọi yêu cầu AI sẽ được chuyển hướng qua các Proxy cấu hình bên dưới thay vì dùng API Key mặc định.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isProxyEnabled)
				.onChange(async (value) => {
					this.plugin.settings.isProxyEnabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.isProxyEnabled) {
			const proxyContainer = containerEl.createDiv({ cls: 'dnd-proxy-container' });
			proxyContainer.style.border = '1px solid var(--background-modifier-border)';
			proxyContainer.style.padding = '10px';
			proxyContainer.style.borderRadius = '5px';
			proxyContainer.style.marginBottom = '20px';

			this.plugin.settings.proxies.forEach((proxy, index) => {
				const pDiv = proxyContainer.createDiv();
				pDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
				pDiv.style.paddingBottom = '10px';
				pDiv.style.marginBottom = '10px';

				new Setting(pDiv)
					.setName(`Proxy #${index + 1}`)
					.addText(text => text
						.setPlaceholder('URL (vd: https://api.openai.com)')
						.setValue(proxy.url)
						.onChange(async (val) => { proxy.url = val; await this.plugin.saveSettings(); }))
					.addText(text => text
						.setPlaceholder('API Key / Pass')
						.setValue(proxy.key)
						.onChange(async (val) => { proxy.key = val; await this.plugin.saveSettings(); }))
					.addButton(btn => btn
						.setButtonText('Xóa')
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.proxies.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						}));

				new Setting(pDiv)
					.setName('Format & Model')
					.addDropdown(drop => drop
						.addOptions({ 'auto': 'Tự động', 'openai': 'OpenAI', 'gemini': 'Gemini' })
						.setValue(proxy.format)
						.onChange(async (val: string) => { proxy.format = val as 'auto'|'openai'|'gemini'; await this.plugin.saveSettings(); }))
					.addText(text => text
						.setPlaceholder('Model tùy chỉnh (vd: deepseek-chat)')
						.setValue(proxy.customModelName || '')
						.onChange(async (val) => { proxy.customModelName = val; await this.plugin.saveSettings(); }))
					.addButton(btn => btn
						.setIcon('refresh-cw')
						.setTooltip('Tải danh sách Model từ Proxy')
						.onClick(async (e) => {
							if (!proxy.url) {
								new Notice('Vui lòng nhập URL của Proxy trước');
								return;
							}
							btn.setIcon('hourglass');
							try {
								const baseUrl = proxy.url.replace(/\/+$/, '');
								const url = `${baseUrl}/v1/models`;
								const res = await fetch(url, {
									headers: proxy.key ? { 'Authorization': `Bearer ${proxy.key}` } : {}
								});
								if (!res.ok) throw new Error(res.statusText);
								const data = await res.json();
								const models = data.data;
								if (!models || !Array.isArray(models)) throw new Error('API không trả về mảng Model chuẩn');
								
								const menu = new Menu();
								models.forEach((m: any) => {
									menu.addItem((item) =>
										item
											.setTitle(m.id)
											.onClick(async () => {
												proxy.customModelName = m.id;
												await this.plugin.saveSettings();
												this.display();
											})
									);
								});
								menu.showAtMouseEvent(e as MouseEvent);
							} catch (err: any) {
								new Notice('Không thể tải danh sách model: ' + err.message);
							} finally {
								btn.setIcon('refresh-cw');
							}
						}));
			});

			new Setting(proxyContainer)
				.addButton(btn => btn
					.setButtonText('+ Thêm Proxy Mới')
					.onClick(async () => {
						this.plugin.settings.proxies.push({
							id: Date.now().toString(),
							url: '',
							key: '',
							format: 'auto',
							customModelName: 'gpt-4o'
						});
						await this.plugin.saveSettings();
						this.display();
					}));
		}

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