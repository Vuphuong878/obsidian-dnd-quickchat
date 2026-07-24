import { App, PluginSettingTab, Setting, Notice, Menu } from 'obsidian';
import MyPlugin from './main';
import { t, LanguageType, DEFAULT_PROMPT_MAP } from './utils/locale';

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
	generateDialogue: boolean;
	generateAction: boolean;
	generateThought: boolean;
	isRequestCheckEnabled: boolean;
	maxHistoryLength: number;
	maxHistorySent: number;
	language: LanguageType;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	geminiApiKeys: [''],
	defaultPcNote: 'Hero_Sylvie',
	chatHistory: [],
	lastSelectedNpcs: [],
	lastSelectedPcs: [],
	isProxyEnabled: false,
	proxies: [],
	customPrompt: 'Bạn đang nhập vai là **Nhân vật chính (PC)** trong thế giới D&D.',
	customStyle: '',
	customRules: '',
	generateDialogue: true,
	generateAction: true,
	generateThought: true,
	isRequestCheckEnabled: false,
	maxHistoryLength: 30,
	maxHistorySent: 30,
	language: 'vi'
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
		const lang = this.plugin.settings.language || 'vi';

		containerEl.createEl('h2', { text: t('settings_title', lang) });

		// Phân khu 0: General Settings (Cấu hình ngôn ngữ)
		const generalSection = containerEl.createDiv({ cls: 'dnd-settings-card' });
		generalSection.createEl('h3', { text: t('language_label', lang) });
		
		new Setting(generalSection)
			.setName(t('language_label', lang))
			.setDesc(t('language_desc', lang))
			.addDropdown(dropdown => dropdown
				.addOptions({
					vi: 'Tiếng Việt',
					en: 'English'
				})
				.setValue(lang)
				.onChange(async (val) => {
					const oldLang = this.plugin.settings.language || 'vi';
					const newLang = val as LanguageType;
					this.plugin.settings.language = newLang;

					// Auto-translate Custom Prompt if unmodified
					const oldDefaultPrompt = DEFAULT_PROMPT_MAP[oldLang];
					if (this.plugin.settings.customPrompt === oldDefaultPrompt) {
						this.plugin.settings.customPrompt = DEFAULT_PROMPT_MAP[newLang];
					}

					await this.plugin.saveSettings();
					this.display();

					// Refresh active view
					const sidebarView = this.app.workspace.getLeavesOfType('dnd-quickchat-view')[0]?.view;
					if (sidebarView && 'onOpen' in sidebarView) {
						(sidebarView as any).onOpen();
					}
				})
			);

		// Phân khu 1: API Keys (Danh sách động)
		const apiSection = containerEl.createDiv({ cls: 'dnd-settings-card' });
		apiSection.createEl('h3', { text: t('settings_api_title', lang) });
		apiSection.createEl('p', { 
			text: t('settings_api_desc', lang),
			cls: 'setting-item-description'
		});

		const keysContainer = apiSection.createDiv({ cls: 'dnd-settings-keys-list' });
		
		this.plugin.settings.geminiApiKeys.forEach((key, index) => {
			const keyRow = keysContainer.createDiv({ cls: 'dnd-settings-dynamic-row' });
			
			const inputEl = keyRow.createEl('input', {
				type: 'text',
				placeholder: `API Key ${index + 1}...`,
				value: key,
				cls: 'dnd-settings-key-input'
			});
			
			inputEl.addEventListener('change', async () => {
				this.plugin.settings.geminiApiKeys[index] = inputEl.value;
				
				// Reset status
				const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
				const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
				for (const m of [...goodModels, ...badModels]) {
					this.plugin.setApiModelStatus(index, m, 'AVAILABLE');
				}
				await this.plugin.saveSettings();
			});

			const delBtn = keyRow.createEl('button', { text: t('settings_delete', lang), cls: 'dnd-btn-danger' });
			delBtn.addEventListener('click', async () => {
				this.plugin.settings.geminiApiKeys.splice(index, 1);
				if (this.plugin.settings.geminiApiKeys.length === 0) {
					this.plugin.settings.geminiApiKeys.push('');
				}
				await this.plugin.saveSettings();
				this.display();
			});
		});

		const addKeyBtn = apiSection.createEl('button', { text: t('settings_add_key', lang), cls: 'dnd-btn-primary' });
		addKeyBtn.addEventListener('click', async () => {
			this.plugin.settings.geminiApiKeys.push('');
			await this.plugin.saveSettings();
			this.display();
		});

		// Phân khu 2: Chat & History Limits
		const limitsSection = containerEl.createDiv({ cls: 'dnd-settings-card' });
		limitsSection.createEl('h3', { text: t('settings_limits_title', lang) });
		limitsSection.createEl('p', {
			text: t('settings_limits_desc', lang),
			cls: 'setting-item-description'
		});

		new Setting(limitsSection)
			.setName(t('settings_limit_display', lang))
			.setDesc(t('settings_limit_display_desc', lang))
			.addSlider(slider => slider
				.setLimits(10, 100, 5)
				.setValue(this.plugin.settings.maxHistoryLength)
				.setDynamicTooltip()
				.onChange(async (val) => {
					this.plugin.settings.maxHistoryLength = val;
					await this.plugin.saveSettings();
				}));

		new Setting(limitsSection)
			.setName(t('settings_limit_sent', lang))
			.setDesc(t('settings_limit_sent_desc', lang))
			.addSlider(slider => slider
				.setLimits(5, 100, 5)
				.setValue(this.plugin.settings.maxHistorySent)
				.setDynamicTooltip()
				.onChange(async (val) => {
					this.plugin.settings.maxHistorySent = val;
					await this.plugin.saveSettings();
				}));

		new Setting(limitsSection)
			.setName(t('settings_default_pc', lang))
			.setDesc(t('settings_default_pc_desc', lang))
			.addText(text => text
				.setPlaceholder('Ví dụ: Hero_Sylvie')
				.setValue(this.plugin.settings.defaultPcNote)
				.onChange(async (value) => {
					this.plugin.settings.defaultPcNote = value;
					await this.plugin.saveSettings();
				}));

		// Phân khu 3: Custom Proxy
		const proxyCard = containerEl.createDiv({ cls: 'dnd-settings-card' });
		proxyCard.createEl('h3', { text: t('settings_proxy_title', lang) });
		
		new Setting(proxyCard)
			.setName(t('settings_proxy_enable', lang))
			.setDesc(t('settings_proxy_enable_desc', lang))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isProxyEnabled)
				.onChange(async (value) => {
					this.plugin.settings.isProxyEnabled = value;
					await this.plugin.saveSettings();
					this.display();
				}));

		if (this.plugin.settings.isProxyEnabled) {
			const proxyContainer = proxyCard.createDiv({ cls: 'dnd-proxy-container' });
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
						.setButtonText(t('settings_delete', lang))
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

		// Phân khu 4: Live Status Quota Dashboard (Grid Cards)
		const statusContainer = containerEl.createDiv({ cls: 'dnd-settings-card dnd-status-card' });
		const statusHeader = statusContainer.createDiv({ cls: 'dnd-status-title' });
		statusHeader.createEl('span', { text: t('settings_status_title', lang) });
		
		const resetBtn = statusHeader.createEl('button', { text: t('settings_status_reset', lang), cls: 'dnd-status-reset-btn' });
		resetBtn.addEventListener('click', () => {
			this.plugin.resetApiModelStatus();
			this.display();
			new Notice(t('settings_status_reset_notice', lang));
		});

		const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
		const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
		const allModels = [...goodModels, ...badModels];

		for (let i = 0; i < this.plugin.settings.geminiApiKeys.length; i++) {
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