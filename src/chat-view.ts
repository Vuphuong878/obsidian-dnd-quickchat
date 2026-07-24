// src/chat-view.ts
import { ItemView, WorkspaceLeaf, TFile, Notice, Modal, Setting, App, getAllTags } from 'obsidian';
import { generateAiRoleplay, RoleplayContext, generateChatSummary } from './ai-service';
import MyPlugin from './main';
import { t, PC_MOODS_MAP } from './utils/locale';

export const VIEW_TYPE_QUICK_CHAT = 'dnd-quick-chat-view';

export class QuickChatView extends ItemView {
    plugin: MyPlugin;
    chatHistory: { sender: 'player' | 'npc', text: string, npcName?: string }[] = [];
    activeNpc: string = '';
    selectedMood: string = '';
    pcSelectEl!: HTMLSelectElement;
    npcSelectEl!: HTMLSelectElement;
    refreshTimer: any = null;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_QUICK_CHAT;
    }

    getDisplayText() {
        const lang = this.plugin?.settings?.language || 'vi';
        return t('sidebar_title', lang);
    }

    getIcon() {
        return "message-square-plus"; // Icon đẹp từ Obsidian Lucide library
    }

    async onOpen() {
        // Nạp lịch sử chat từ plugin settings
        this.chatHistory = this.plugin.settings.chatHistory || [];

        // Đăng ký sự kiện tự động đồng bộ hóa danh sách khi có thay đổi trong Vault / MetadataCache
        this.registerEvent(
            this.app.metadataCache.on('changed', () => this.refreshDropdownsDebounced())
        );
        this.registerEvent(
            this.app.vault.on('create', () => this.refreshDropdownsDebounced())
        );
        this.registerEvent(
            this.app.vault.on('delete', () => this.refreshDropdownsDebounced())
        );
        this.registerEvent(
            this.app.vault.on('rename', () => this.refreshDropdownsDebounced())
        );

        const container = this.contentEl;
        container.empty();
        container.addClass('dnd-chat-sidebar');

        const lang = this.plugin.settings.language || 'vi';

        // Thanh tiêu đề Header với nút Settings bánh răng
        const headerEl = container.createDiv({ cls: 'dnd-chat-header' });
        headerEl.createEl('span', { text: t('sidebar_title', lang), cls: 'dnd-chat-header-title' });
        const settingsBtn = headerEl.createEl('button', { text: '⚙️', cls: 'dnd-settings-btn' });
        settingsBtn.title = t('settings_modal_title', lang);
        settingsBtn.addEventListener('click', () => {
            new PromptConfigModal(this.app, this.plugin).open();
        });

        // Khung danh sách PC & NPC trên cùng 1 hàng
        const selectorsRow = container.createDiv({ cls: 'dnd-selectors-row' });
        
        const pcCol = selectorsRow.createDiv({ cls: 'dnd-selector-col' });
        pcCol.createEl('span', { text: t('pc_label', lang), cls: 'dnd-label' });
        this.pcSelectEl = pcCol.createEl('select', { cls: 'dnd-select' });
        this.populateDropdown(this.pcSelectEl, 'character');
        this.pcSelectEl.addEventListener('change', () => {
            const val = this.pcSelectEl.value;
            if (val) {
                this.updateSelectionOrder('character', val);
                this.populateDropdown(this.pcSelectEl, 'character');
            }
        });

        const npcCol = selectorsRow.createDiv({ cls: 'dnd-selector-col' });
        npcCol.createEl('span', { text: t('npc_label', lang), cls: 'dnd-label' });
        this.npcSelectEl = npcCol.createEl('select', { cls: 'dnd-select' });
        this.populateDropdown(this.npcSelectEl, 'npc');
        this.npcSelectEl.addEventListener('change', () => {
            const val = this.npcSelectEl.value;
            if (val) {
                this.updateSelectionOrder('npc', val);
                this.populateDropdown(this.npcSelectEl, 'npc');
            }
        });

        // Khung tâm trạng (Mood buttons - Chips pill style)
        const moodSection = container.createDiv({ cls: 'dnd-mood-sec' });
        moodSection.createEl('div', { text: t('mood_title', lang), cls: 'dnd-section-header' });
        const moodChips = moodSection.createDiv({ cls: 'dnd-mood-chips' });

        const moods = PC_MOODS_MAP[lang];
        if (!this.selectedMood || !moods.includes(this.selectedMood)) {
            const viMoods = PC_MOODS_MAP['vi'];
            const enMoods = PC_MOODS_MAP['en'];
            let oldIdx = viMoods.indexOf(this.selectedMood);
            if (oldIdx === -1) oldIdx = enMoods.indexOf(this.selectedMood);
            if (oldIdx !== -1) {
                this.selectedMood = moods[oldIdx] ?? '';
            } else {
                this.selectedMood = moods[0] ?? '';
            }
        }

        moods.forEach(mood => {
            const btn = moodChips.createEl('button', { text: mood, cls: 'dnd-mood-chip' });
            if (mood === this.selectedMood) btn.addClass('active');
            btn.addEventListener('click', () => {
                moodChips.querySelectorAll('.dnd-mood-chip').forEach(b => b.removeClass('active'));
                btn.addClass('active');
                this.selectedMood = mood;
            });
        });

        // Khung tin nhắn đã trò chuyện (Scrollable Chat Box)
        const chatBox = container.createDiv({ cls: 'dnd-chat-box' });
        this.renderChatMessages(chatBox);

        // Ô Nhập liệu gợi ý & Lời thoại NPC
        const inputSection = container.createDiv({ cls: 'dnd-input-section' });

        inputSection.createEl('div', { text: t('pc_suggest_label', lang), cls: 'dnd-input-label' });
        const suggestionInput = inputSection.createEl('textarea', {
            placeholder: t('pc_suggest_placeholder', lang),
            cls: 'dnd-textarea-pc'
        });

        // Hàng điều khiển nút bấm của PC (Dưới HÀNH ĐỘNG / GỢI Ý CHO PC và trên LỜI THOẠI / HÀNH ĐỘNG CỦA NPC)
        const pcActionRow = inputSection.createDiv({ cls: 'dnd-action-row' });

        // Container cho các checkbox bên trái - Nhóm làm 2 hàng gọn gàng
        const checkboxContainer = pcActionRow.createDiv({ cls: 'dnd-checkbox-groups' });

        // Hàng 1: Chế độ AI
        const groupRow1 = checkboxContainer.createDiv({ cls: 'dnd-checkbox-group-row' });

        // Checkbox Chủ động
        const proactiveCheckbox = groupRow1.createEl('label', { cls: 'dnd-checkbox-label' });
        const pCheck = proactiveCheckbox.createEl('input', { type: 'checkbox' });
        proactiveCheckbox.createEl('span', { text: t('checkbox_proactive', lang) });

        // Checkbox 18+
        const nsfwCheckbox = groupRow1.createEl('label', { cls: 'dnd-checkbox-label' });
        const nCheck = nsfwCheckbox.createEl('input', { type: 'checkbox' });
        nsfwCheckbox.createEl('span', { text: t('checkbox_nsfw', lang) });

        // Checkbox Xin check DM
        const checkDmCheckbox = groupRow1.createEl('label', { cls: 'dnd-checkbox-label' });
        const cCheck = checkDmCheckbox.createEl('input', { type: 'checkbox' });
        cCheck.checked = this.plugin.settings.isRequestCheckEnabled;
        checkDmCheckbox.createEl('span', { text: t('checkbox_check_dm', lang) });

        // Hàng 2: Thành phần sinh
        const groupRow2 = checkboxContainer.createDiv({ cls: 'dnd-checkbox-group-row' });

        // Checkbox Lời thoại
        const dialogueCheckbox = groupRow2.createEl('label', { cls: 'dnd-checkbox-label' });
        const dCheck = dialogueCheckbox.createEl('input', { type: 'checkbox' });
        dCheck.checked = this.plugin.settings.generateDialogue;
        dialogueCheckbox.createEl('span', { text: t('checkbox_dialogue', lang) });

        // Checkbox Hành động
        const actionCheckbox = groupRow2.createEl('label', { cls: 'dnd-checkbox-label' });
        const aCheck = actionCheckbox.createEl('input', { type: 'checkbox' });
        aCheck.checked = this.plugin.settings.generateAction;
        actionCheckbox.createEl('span', { text: t('checkbox_action', lang) });

        // Checkbox Suy nghĩ
        const thoughtCheckbox = groupRow2.createEl('label', { cls: 'dnd-checkbox-label' });
        const tCheck = thoughtCheckbox.createEl('input', { type: 'checkbox' });
        tCheck.checked = this.plugin.settings.generateThought;
        thoughtCheckbox.createEl('span', { text: t('checkbox_thought', lang) });

        // Nhóm các nút PC ở bên phải
        const pcButtonsContainer = pcActionRow.createDiv();
        pcButtonsContainer.style.display = 'flex';
        pcButtonsContainer.style.gap = '8px';

        // Nút Thêm tin nhắn PC
        const addPcBtn = pcButtonsContainer.createEl('button', { text: t('btn_add_pc', lang), cls: 'dnd-manual-btn' });
        addPcBtn.addEventListener('click', async () => {
            const pcText = suggestionInput.value.trim();
            if (!pcText) {
                new Notice(t('notice_input_pc', lang));
                return;
            }
            const chosenPc = this.pcSelectEl.value;
            if (chosenPc) {
                this.updateSelectionOrder('character', chosenPc);
            }
            // Thêm vào history dưới danh nghĩa PC
            await this.pushToChatHistory({ sender: 'player', text: pcText });
            this.renderChatMessages(chatBox);
            
            await this.savePcChatToDailyFile(pcText, false);

            suggestionInput.value = '';
        });

        // Nút Gợi ý hành động
        const suggestActionBtn = pcButtonsContainer.createEl('button', { text: t('btn_suggest', lang), cls: 'dnd-send-btn' });

        // Hàm kiểm tra/khóa nút dựa trên tích chọn
        const validateCheckboxes = () => {
            const anyChecked = dCheck.checked || aCheck.checked || tCheck.checked;
            if (!anyChecked) {
                suggestActionBtn.disabled = true;
                suggestActionBtn.addClass('disabled');
                suggestActionBtn.textContent = t('btn_choose_one', lang);
            } else {
                suggestActionBtn.disabled = false;
                suggestActionBtn.removeClass('disabled');
                suggestActionBtn.textContent = t('btn_suggest', lang);
            }
        };

        // Đăng ký sự kiện thay đổi cho các checkbox để lưu vào Settings
        dCheck.addEventListener('change', async () => {
            this.plugin.settings.generateDialogue = dCheck.checked;
            await this.plugin.saveSettings();
            validateCheckboxes();
        });
        aCheck.addEventListener('change', async () => {
            this.plugin.settings.generateAction = aCheck.checked;
            await this.plugin.saveSettings();
            validateCheckboxes();
        });
        tCheck.addEventListener('change', async () => {
            this.plugin.settings.generateThought = tCheck.checked;
            await this.plugin.saveSettings();
            validateCheckboxes();
        });
        cCheck.addEventListener('change', async () => {
            this.plugin.settings.isRequestCheckEnabled = cCheck.checked;
            await this.plugin.saveSettings();
        });

        // Validate trạng thái nút ngay khi mở giao diện
        validateCheckboxes();

        suggestActionBtn.addEventListener('click', async () => {
            const npcText = npcSpeakInput.value.trim();
            const pcSuggest = suggestionInput.value.trim();
            const chosenPc = this.pcSelectEl.value;
            const chosenNpc = this.npcSelectEl.value;

            if (chosenPc) this.updateSelectionOrder('character', chosenPc);
            if (chosenNpc) this.updateSelectionOrder('npc', chosenNpc);

            const npcDisplayName = this.npcSelectEl.options[this.npcSelectEl.selectedIndex]?.text || chosenNpc || 'NPC';

            // Nếu có lời thoại NPC, thêm vào lịch sử
            if (npcText) {
                await this.pushToChatHistory({ sender: 'npc', text: npcText, npcName: npcDisplayName });
                this.renderChatMessages(chatBox);
                await this.saveNpcChatToDailyFile(npcDisplayName, npcText);
                npcSpeakInput.value = '';
            }

            suggestActionBtn.disabled = true;
            suggestActionBtn.textContent = t('ai_thinking', lang);

            try {
                const vaultContext = await this.gatherVaultContext(chosenPc, chosenNpc, pcSuggest);

                const pcDisplayName = this.pcSelectEl.options[this.pcSelectEl.selectedIndex]?.text || chosenPc;
                const npcDisplayName = this.npcSelectEl.options[this.npcSelectEl.selectedIndex]?.text || chosenNpc;

                let proxyConfig = null;
                if (this.plugin.settings.isProxyEnabled && this.plugin.settings.proxies && this.plugin.settings.proxies.length > 0) {
                    proxyConfig = this.plugin.settings.proxies[0];
                }

                // Chèn tin nhắn rỗng để bắt đầu stream
                const pendingMsg = { sender: 'player' as const, text: '' };
                this.chatHistory.push(pendingMsg);
                this.renderChatMessages(chatBox);
                
                const msgElements = chatBox.querySelectorAll('.dnd-msg-body');
                const lastMsgBody = msgElements[msgElements.length - 1] as HTMLElement;

                const maxSent = this.plugin.settings.maxHistorySent || 30;
                const historyToSend = this.chatHistory.slice(0, -1).slice(-maxSent);

                const response = await generateAiRoleplay(
                    this.plugin,
                    {
                        pcName: pcDisplayName,
                        npcName: npcDisplayName,
                        pcInfo: vaultContext.pcInfo,
                        npcInfo: vaultContext.npcInfo,
                        worldInfo: vaultContext.worldInfo,
                        sceneContext: vaultContext.activeNoteContent,
                        chatHistory: historyToSend,
                        pcMood: this.selectedMood,
                        pcSuggestion: pcSuggest,
                        isProactiveMode: pCheck.checked,
                        isNsfwMode: nCheck.checked,
                        generateDialogue: dCheck.checked,
                        generateAction: aCheck.checked,
                        generateThought: tCheck.checked,
                        isRequestCheckEnabled: cCheck.checked,
                        language: lang
                    },
                    proxyConfig,
                    (chunk: string) => {
                        pendingMsg.text += chunk;
                        const pElements = lastMsgBody.querySelectorAll('p.dnd-text');
                        pElements.forEach(p => p.remove());
                        this.renderMessageText(pendingMsg.text, lastMsgBody);
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                );

                const limit = this.plugin.settings.maxHistoryLength || 30;
                if (this.chatHistory.length > limit) {
                    this.chatHistory = this.chatHistory.slice(this.chatHistory.length - limit);
                }
                this.plugin.settings.chatHistory = this.chatHistory;
                await this.plugin.saveSettings();

                // Tự động chèn đoạn hội thoại này vào file nhật ký ngày hôm nay
                await this.savePcChatToDailyFile(response, true);
                
                // Xóa gợi ý sau khi xử lý xong
                suggestionInput.value = '';

            } catch (err) {
                new Notice(t('notice_ai_error', lang));
            } finally {
                // Khôi phục trạng thái nút (kiểm tra lại các ô tích)
                validateCheckboxes();
            }
        });

        // Label LỜI THOẠI / HÀNH ĐỘNG CỦA NPC
        inputSection.createEl('div', { text: t('npc_speak_label', lang), cls: 'dnd-input-label' });
        const npcSpeakInput = inputSection.createEl('textarea', {
            placeholder: t('npc_speak_placeholder', lang),
            cls: 'dnd-textarea-npc'
        });

        // Hàng điều khiển nút bấm của NPC (Dưới LỜI THOẠI / HÀNH ĐỘNG CỦA NPC)
        const npcActionRow = inputSection.createDiv({ cls: 'dnd-action-row' });
        npcActionRow.createDiv(); // Dummy spacer to push the button to the right

        // Nút Gửi hành động NPCs
        const sendNpcBtn = npcActionRow.createEl('button', { text: t('btn_send_npc', lang), cls: 'dnd-send-btn' });
        sendNpcBtn.addEventListener('click', async () => {
            const npcText = npcSpeakInput.value.trim();
            if (!npcText) {
                new Notice(t('notice_input_npc', lang));
                return;
            }
            const chosenNpc = this.npcSelectEl.value;
            if (chosenNpc) this.updateSelectionOrder('npc', chosenNpc);
            const npcDisplayName = this.npcSelectEl.options[this.npcSelectEl.selectedIndex]?.text || chosenNpc || 'NPC';

            await this.pushToChatHistory({ sender: 'npc', text: npcText, npcName: npcDisplayName });
            this.renderChatMessages(chatBox);
            await this.saveNpcChatToDailyFile(npcDisplayName, npcText);
            npcSpeakInput.value = '';
        });
    }

    async pushToChatHistory(msg: { sender: 'player' | 'npc', text: string, npcName?: string }) {
        this.chatHistory.push(msg);
        const limit = this.plugin.settings.maxHistoryLength || 30;
        if (this.chatHistory.length > limit) {
            this.chatHistory = this.chatHistory.slice(this.chatHistory.length - limit);
        }
        this.plugin.settings.chatHistory = this.chatHistory;
        await this.plugin.saveSettings();
    }

    updateSelectionOrder(type: 'character' | 'npc', value: string) {
        if (!value) return;
        if (!this.plugin.settings.lastSelectedNpcs) {
            this.plugin.settings.lastSelectedNpcs = [];
        }
        if (!this.plugin.settings.lastSelectedPcs) {
            this.plugin.settings.lastSelectedPcs = [];
        }
        const list = type === 'character' ? this.plugin.settings.lastSelectedPcs : this.plugin.settings.lastSelectedNpcs;
        const index = list.indexOf(value);
        if (index > -1) {
            list.splice(index, 1);
        }
        list.unshift(value);
        if (list.length > 50) {
            list.splice(50);
        }
        this.plugin.saveSettings();
    }

    // Tự động quét các note có thuộc tính rpg_type hoặc tags tương ứng
    async populateDropdown(selectEl: HTMLSelectElement, type: 'character' | 'npc') {
        const currentValue = selectEl.value;
        selectEl.empty();
        const files = this.app.vault.getMarkdownFiles();
        let found = false;

        const targetTag = type === 'character' ? 'dnd-character' : 'dnd-npc';
        const matchedItems: { value: string; text: string }[] = [];

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            const rpgType = frontmatter?.rpg_type;
            const storytellerType = frontmatter?.type;
            const fileTags = (cache ? getAllTags(cache) : []) ?? [];

            const isStorytellerChar = storytellerType === 'character' || file.path.includes('/Characters/') || file.path.includes('\\Characters\\');
            let isMatched = rpgType === type;
            if (isStorytellerChar) {
                isMatched = true;
            }

            let extractedName = '';

            for (let tag of fileTags) {
                // Loại bỏ ký tự # ở đầu nếu có
                if (tag.startsWith('#')) {
                    tag = tag.slice(1);
                }

                // Khớp chính xác tag (ví dụ: dnd-character)
                if (tag.toLowerCase() === targetTag) {
                    isMatched = true;
                }
                // Khớp tag phân cấp (ví dụ: dnd-character/Themba-Fodi)
                else if (tag.toLowerCase().startsWith(targetTag + '/')) {
                    isMatched = true;
                    const suffix = tag.slice(targetTag.length + 1).trim();
                    if (suffix) {
                        // Thay thế gạch ngang/gạch dưới bằng khoảng trắng để hiển thị tên đẹp hơn
                        extractedName = suffix.replace(/[-_]/g, ' ');
                    }
                }
            }

            if (isMatched) {
                const displayName = extractedName || frontmatter?.name || file.basename;
                matchedItems.push({ value: file.basename, text: displayName });
                found = true;
            }
        }

        if (found) {
            const recencyList = type === 'character' 
                ? (this.plugin.settings.lastSelectedPcs || []) 
                : (this.plugin.settings.lastSelectedNpcs || []);

            matchedItems.sort((a, b) => {
                const indexA = recencyList.indexOf(a.value);
                const indexB = recencyList.indexOf(b.value);

                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }
                if (indexA !== -1) {
                    return -1;
                }
                if (indexB !== -1) {
                    return 1;
                }
                return a.text.localeCompare(b.text);
            });

            for (const item of matchedItems) {
                selectEl.createEl('option', { value: item.value, text: item.text });
            }

            if (currentValue && matchedItems.some(item => item.value === currentValue)) {
                selectEl.value = currentValue;
            }
        } else {
            const displayName = type === 'character' ? 'PC' : 'NPC';
            selectEl.createEl('option', { value: '', text: `Chưa quét được ${displayName}` });
        }
    }

    // Logic chắt lọc thông tin tệp cực kỳ thông minh: Kết hợp Tĩnh (quickchat: true) và Động (Quét liên kết)
    async gatherVaultContext(pcFileBasename: string, npcFileBasename: string, suggestionText: string = "") {
        let pcInfo = "";
        let npcInfo = "";
        let worldInfo = "";
        let activeNoteContent = "";

        const files = this.app.vault.getMarkdownFiles();

        // 1. Lấy nội dung note đang mở (Đóng vai trò là Nhật ký phiêu lưu / Scene Context hiện tại)
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            activeNoteContent = await this.app.vault.read(activeFile);
        }

        // Chuẩn bị danh sách các Note được liên kết [[...]]
        const linkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
        const linkedNotes = new Set<string>();
        
        let match;
        // Quét trong activeNoteContent
        while ((match = linkRegex.exec(activeNoteContent)) !== null) {
            if (match[1]) linkedNotes.add(match[1].trim().toLowerCase());
        }
        // Quét trong suggestionText
        while ((match = linkRegex.exec(suggestionText)) !== null) {
            if (match[1]) linkedNotes.add(match[1].trim().toLowerCase());
        }

        // 2. Tìm note PC (Gửi vô điều kiện vì được chọn làm PC chính)
        if (pcFileBasename) {
            const pcFile = files.find(f => f.basename === pcFileBasename);
            if (pcFile) {
                pcInfo = this.formatCharacterInfo(pcFile, await this.app.vault.read(pcFile), true);
            }
        }

        // 3. Tìm note NPC (Gửi vô điều kiện vì được chọn làm NPC chính)
        if (npcFileBasename) {
            const npcFile = files.find(f => f.basename === npcFileBasename);
            if (npcFile) {
                npcInfo = this.formatCharacterInfo(npcFile, await this.app.vault.read(npcFile), true);
            }
        }

        // 4. Lọc Bối cảnh phụ trợ (Tài liệu, Lore, NPC phụ...) bằng quickchat: true HOẶC liên kết động
        const additionalContexts: string[] = [];
        const extraNpcInfos: string[] = [];

        for (const file of files) {
            // Bỏ qua PC, NPC chính và Note đang mở vì đã xử lý riêng
            if (file.basename === pcFileBasename || file.basename === npcFileBasename) continue;
            if (activeFile && file.path === activeFile.path) continue;

            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            
            const isCharacter = frontmatter?.entityType === 'character' || 
                                frontmatter?.type === 'character' || 
                                file.path.includes('/Characters/') || 
                                file.path.includes('\\Characters\\');

            const isQuickchatTrue = frontmatter?.quickchat === true;
            const isLinked = linkedNotes.has(file.basename.toLowerCase());

            if (isCharacter) {
                // Các nhân vật khác không chọn làm PC chính nhưng có quickchat: true được gửi làm NPC phụ
                if (isQuickchatTrue) {
                    const content = await this.app.vault.read(file);
                    const formattedChar = this.formatCharacterInfo(file, content, true);
                    if (formattedChar) {
                        extraNpcInfos.push(formattedChar);
                    }
                }
            } else {
                // Các file không thuộc nhóm Characters (bối cảnh) cần có quickchat: true hoặc được liên kết [[...]]
                if (isQuickchatTrue || isLinked) {
                    const content = await this.app.vault.read(file);
                    additionalContexts.push(`=== TÀI LIỆU BỔ SUNG: ${file.basename} ===\n${content}`);
                }
            }
        }
        
        if (extraNpcInfos.length > 0) {
            if (npcInfo) npcInfo += "\n\n";
            npcInfo += `=== CÁC NPC KHÁC TRONG CÂU CHUYỆN ===\n` + extraNpcInfos.join('\n\n');
        }

        if (additionalContexts.length > 0) {
            worldInfo = additionalContexts.join('\n\n');
        } else {
            worldInfo = "";
        }

        return { pcInfo, npcInfo, worldInfo, activeNoteContent };
    }

    refreshDropdowns() {
        if (this.pcSelectEl) this.populateDropdown(this.pcSelectEl, 'character');
        if (this.npcSelectEl) this.populateDropdown(this.npcSelectEl, 'npc');
    }

    refreshDropdownsDebounced() {
        if (this.refreshTimer) {
            window.clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = window.setTimeout(() => {
            this.refreshDropdowns();
            this.refreshTimer = null;
        }, 500);
    }

    async onClose() {
        if (this.refreshTimer) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    formatCharacterInfo(file: TFile, rawContent: string, forceSend = false): string {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        if (!forceSend && (!frontmatter || frontmatter.quickchat !== true)) {
            return ""; // Chỉ gửi các file có quickchat: true chính xác
        }

        let info = `[THÔNG TIN FILE: ${file.basename}]\n`;
        if (frontmatter) {
            for (const [key, value] of Object.entries(frontmatter)) {
                if (typeof value === 'object' && value !== null) {
                    info += `- ${key}: ${JSON.stringify(value)}\n`;
                } else {
                    info += `- ${key}: ${value}\n`;
                }
            }
        }

        let body = rawContent;
        const matches = rawContent.match(/^---[\s\S]+?---/);
        if (matches) {
            body = rawContent.slice(matches[0].length).trim();
        }

        info += `\n=== NỘI DUNG CHI TIẾT ===\n${body}`;
        return info;
    }    // Vẽ box trò chuyện đẹp đẽ như game nhập vai
    renderChatMessages(chatContainer: HTMLDivElement) {
        chatContainer.empty();

        if (this.chatHistory.length === 0) {
            chatContainer.createEl('div', {
                text: 'Hội thoại trống. Hãy bắt đầu nhập lời nói của NPC phía dưới để kích hoạt AI nhập vai nhân vật của bạn.',
                cls: 'dnd-empty-state'
            });
            return;
        }

        this.chatHistory.forEach((msg, index) => {
            const isLast = index === this.chatHistory.length - 1;
            const bubbleWrapper = chatContainer.createDiv({
                cls: `dnd-msg-wrapper ${msg.sender === 'player' ? 'pc-side' : 'npc-side'} ${isLast ? 'dnd-msg-animate' : ''}`
            });
            if (!isLast) {
                bubbleWrapper.style.opacity = '1';
            }

            const avatar = bubbleWrapper.createDiv({ cls: 'dnd-avatar' });
            
            // Tìm ảnh đại diện thực tế
            let avatarUrl: string | null = null;
            if (msg.sender === 'player') {
                const chosenPc = this.pcSelectEl ? this.pcSelectEl.value : '';
                avatarUrl = this.getAvatarUrl(chosenPc, 'character');
            } else {
                const npcName = msg.npcName || (this.npcSelectEl ? this.npcSelectEl.value : '');
                avatarUrl = this.getAvatarUrl(npcName, 'npc');
            }

            if (avatarUrl) {
                const img = avatar.createEl('img', { cls: 'dnd-avatar-img' });
                img.src = avatarUrl;
            } else {
                avatar.setText(msg.sender === 'player' ? 'P' : (msg.npcName ? msg.npcName.charAt(0).toUpperCase() : 'N'));
            }

            const content = bubbleWrapper.createDiv({ cls: 'dnd-msg-body' });
            content.createEl('strong', { text: msg.sender === 'player' ? 'Bạn (AI)' : (msg.npcName || 'NPC'), cls: 'dnd-sender-name' });
            this.renderMessageText(msg.text, content);

            // Nút xóa nhanh tin nhắn
            const deleteBtn = bubbleWrapper.createEl('button', { cls: 'dnd-msg-delete-btn', text: '✕' });
            deleteBtn.title = 'Xóa tin nhắn này';
            deleteBtn.addEventListener('click', async () => {
                const index = this.chatHistory.indexOf(msg);
                if (index > -1) {
                    this.chatHistory.splice(index, 1);
                    this.plugin.settings.chatHistory = this.chatHistory;
                    await this.plugin.saveSettings();
                    this.renderChatMessages(chatContainer);
                }
            });
        });

        // Tự động kéo cuộn xuống dưới cùng của Box Chat
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
    }

    renderMessageText(text: string, container: HTMLElement) {
        const p = container.createEl('p', { cls: 'dnd-text' });
        
        // Escape HTML to prevent XSS
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // Parse Markdown:
        // ***bold italic***
        html = html.replace(/\*\*\*([^\*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        // **bold**
        html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
        // *italic*
        html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
        // `inline code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // New lines
        html = html.replace(/\n/g, '<br>');

        p.innerHTML = html;
    }

    // Tự động viết nối hội thoại PC vào file nhật ký ngày hôm nay
    async savePcChatToDailyFile(pcText: string, isAi: boolean) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const folderPath = 'History Chat';
        const filePath = `${folderPath}/${dateStr}.md`;

        // Kiểm tra/tạo thư mục nếu chưa tồn tại
        const folderExists = await this.app.vault.adapter.exists(folderPath);
        if (!folderExists) {
            await this.app.vault.createFolder(folderPath);
        }

        // Kiểm tra/tạo file nếu chưa tồn tại
        const fileExists = await this.app.vault.adapter.exists(filePath);
        if (!fileExists) {
            await this.app.vault.create(filePath, `# Nhật ký đối thoại ngày ${dateStr}\n\n`);
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            const senderLabel = isAi ? "PC (AI)" : "PC";
            const formatForNote = `**[Đối Thoại]**\n- **${senderLabel}**: ${pcText}\n\n`;
            await this.app.vault.append(file, formatForNote);
        }
    }

    // Tự động viết nối lời thoại NPC vào file nhật ký ngày hôm nay
    async saveNpcChatToDailyFile(npcName: string, npcText: string) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const folderPath = 'History Chat';
        const filePath = `${folderPath}/${dateStr}.md`;

        // Kiểm tra/tạo thư mục nếu chưa tồn tại
        const folderExists = await this.app.vault.adapter.exists(folderPath);
        if (!folderExists) {
            await this.app.vault.createFolder(folderPath);
        }

        // Kiểm tra/tạo file nếu chưa tồn tại
        const fileExists = await this.app.vault.adapter.exists(filePath);
        if (!fileExists) {
            await this.app.vault.create(filePath, `# Nhật ký đối thoại ngày ${dateStr}\n\n`);
        }

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            const formatForNote = `**[Đối Thoại]**\n- **${npcName}**: ${npcText}\n\n`;
            await this.app.vault.append(file, formatForNote);
        }
    }

    getAvatarUrl(characterName: string, type: 'character' | 'npc'): string | null {
        if (!characterName) return null;
        const files = this.app.vault.getMarkdownFiles();
        const targetTag = type === 'character' ? 'dnd-character' : 'dnd-npc';
        
        const file = files.find(f => {
            const cache = this.app.metadataCache.getFileCache(f);
            const frontmatter = cache?.frontmatter;
            const rpgType = frontmatter?.rpg_type;
            const fileTags = (cache ? getAllTags(cache) : []) ?? [];
            
            let isMatch = f.basename === characterName || frontmatter?.name === characterName;
            if (!isMatch) {
                for (let tag of fileTags) {
                    if (tag.startsWith('#')) tag = tag.slice(1);
                    if (tag.toLowerCase().startsWith(targetTag + '/')) {
                        const suffix = tag.slice(targetTag.length + 1).trim().replace(/[-_]/g, ' ');
                        if (suffix.toLowerCase() === characterName.toLowerCase()) {
                            isMatch = true;
                            break;
                        }
                    }
                }
            }
            return isMatch;
        });

        if (file) {
            const cache = this.app.metadataCache.getFileCache(file);
            let avatarPath = cache?.frontmatter?.avatar;
            if (avatarPath) {
                // Loại bỏ ngoặc vuông WikiLink nếu có: [[Avatar.png]] -> Avatar.png
                avatarPath = avatarPath.replace(/^\[\[(.*?)\]\]$/, '$1');
                
                // Giải quyết tệp tin hình ảnh trong vault
                const imgFile = this.app.metadataCache.getFirstLinkpathDest(avatarPath, file.path);
                if (imgFile) {
                    return this.app.vault.getResourcePath(imgFile);
                }
                // Nếu đường dẫn là URL
                if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
                    return avatarPath;
                }
            }
        }
        return null;
    }

    renderPromptConfigPanel(container: HTMLElement) {
        const detailsEl = container.createEl('details', { cls: 'dnd-api-status-details' });
        detailsEl.createEl('summary', { cls: 'dnd-api-status-summary', text: '⚙️ Cấu hình Prompt & Văn phong' });
        
        const contentEl = detailsEl.createDiv({ cls: 'dnd-api-status-content' });
        contentEl.style.display = 'flex';
        contentEl.style.flexDirection = 'column';
        contentEl.style.gap = '10px';
        contentEl.style.padding = '10px 0';

        // Prompt
        contentEl.createEl('div', { text: 'Chỉ thị vai trò (Prompt):', cls: 'dnd-input-label' });
        const promptInput = contentEl.createEl('textarea', { cls: 'dnd-textarea-npc' });
        promptInput.style.minHeight = '60px';
        promptInput.value = this.plugin.settings.customPrompt;
        promptInput.addEventListener('change', async () => {
            this.plugin.settings.customPrompt = promptInput.value;
            await this.plugin.saveSettings();
        });

        // Style
        contentEl.createEl('div', { text: 'Văn phong cá nhân (Style):', cls: 'dnd-input-label' });
        const styleInput = contentEl.createEl('textarea', { cls: 'dnd-textarea-npc' });
        styleInput.style.minHeight = '60px';
        styleInput.placeholder = 'Ví dụ: Hài hước, cợt nhả, thích châm biếm...';
        styleInput.value = this.plugin.settings.customStyle;
        styleInput.addEventListener('change', async () => {
            this.plugin.settings.customStyle = styleInput.value;
            await this.plugin.saveSettings();
        });

        // Rules
        contentEl.createEl('div', { text: 'Quy tắc bổ sung (Rules):', cls: 'dnd-input-label' });
        const rulesInput = contentEl.createEl('textarea', { cls: 'dnd-textarea-npc' });
        rulesInput.style.minHeight = '60px';
        rulesInput.placeholder = 'Ví dụ: 1. Luôn chèn emoji. 2. Không xưng tôi...';
        rulesInput.value = this.plugin.settings.customRules;
        rulesInput.addEventListener('change', async () => {
            this.plugin.settings.customRules = rulesInput.value;
            await this.plugin.saveSettings();
        });
    }

    async summarizeConversation() {
        const lang = this.plugin.settings.language || 'vi';
        if (this.chatHistory.length === 0) {
            new Notice(t('notice_summary_empty', lang));
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice(t('notice_summary_no_file', lang));
            return;
        }

        new Notice(t('notice_summary_doing', lang));

        try {
            const summary = await generateChatSummary(
                this.plugin,
                this.chatHistory
            );

            const formatSummary = `\n\n**[Tóm tắt đối thoại - Distilled Memory]**\n> ${summary}\n`;
            await this.app.vault.append(activeFile, formatSummary);
            new Notice(t('notice_summary_success', lang));
        } catch (err) {
            console.error(err);
            new Notice(t('notice_summary_error', lang) + String(err));
        }
    }
}

export class ManualMessageModal extends Modal {
    plugin: MyPlugin;
    view: QuickChatView;
    msgType: 'npc' | 'player' = 'npc';
    speakerName: string = '';
    content: string = '';

    constructor(app: App, plugin: MyPlugin, view: QuickChatView) {
        super(app);
        this.plugin = plugin;
        this.view = view;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('dnd-manual-modal');

        // Tiêu đề
        contentEl.createEl('h2', { text: 'Thêm Tin Nhắn Thủ Công', cls: 'dnd-modal-title' });

        // Mô tả
        contentEl.createEl('p', {
            text: 'Chèn nội dung vào lịch sử chat để cung cấp ngữ cảnh cho AI mà không kích hoạt phản hồi.',
            cls: 'dnd-modal-desc'
        });

        // Hàng chọn loại tin nhắn
        contentEl.createEl('div', { text: 'Loại Tin Nhắn', cls: 'dnd-modal-label' });
        const typeToggleRow = contentEl.createDiv({ cls: 'dnd-toggle-row' });
        
        const npcBtn = typeToggleRow.createEl('button', { text: 'NPC / HỆ THỐNG / USER', cls: 'dnd-toggle-btn active' });
        const pcBtn = typeToggleRow.createEl('button', { text: 'PC (NHÂN VẬT CHÍNH)', cls: 'dnd-toggle-btn' });

        // Form container để động hiển thị/ẩn trường
        const dynamicForm = contentEl.createDiv();

        const renderFormFields = () => {
            dynamicForm.empty();
            if (this.msgType === 'npc') {
                // Tên người nói
                dynamicForm.createEl('div', { text: 'Tên Người Nói (hoặc \'Hệ thống\')', cls: 'dnd-modal-label' });
                const nameInput = dynamicForm.createEl('input', {
                    type: 'text',
                    placeholder: 'VD: Lính gác, Dẫn chuyện, Hệ thống...',
                    cls: 'dnd-modal-input-name'
                });
                nameInput.value = this.speakerName;
                nameInput.addEventListener('input', () => {
                    this.speakerName = nameInput.value;
                });

                // Chọn nhanh NPC đã gặp
                dynamicForm.createEl('div', { text: 'CHỌN NHANH NPC ĐÃ GẶP:', cls: 'dnd-modal-label-sub' });
                const quickSelectGrid = dynamicForm.createDiv({ cls: 'dnd-quick-npc-grid' });
                
                const npcNames: string[] = [];
                
                // Quét danh sách NPC từ vault
                const files = this.app.vault.getMarkdownFiles();
                for (const file of files) {
                    const cache = this.app.metadataCache.getFileCache(file);
                    const frontmatter = cache?.frontmatter;
                    const rpgType = frontmatter?.rpg_type;
                    const fileTags = (cache ? getAllTags(cache) : []) ?? [];
                    let isNpc = rpgType === 'npc';
                    if (!isNpc) {
                        for (let tag of fileTags) {
                            if (tag.startsWith('#')) tag = tag.slice(1);
                            if (tag.toLowerCase() === 'dnd-npc' || tag.toLowerCase().startsWith('dnd-npc/')) {
                                isNpc = true;
                                break;
                            }
                        }
                    }
                    if (isNpc) {
                        const name = frontmatter?.name || file.basename;
                        if (!npcNames.includes(name)) {
                            npcNames.push(name);
                        }
                    }
                }

                npcNames.forEach(name => {
                    const tagBtn = quickSelectGrid.createEl('button', { text: name, cls: 'dnd-quick-npc-btn' });
                    tagBtn.addEventListener('click', () => {
                        this.speakerName = name;
                        nameInput.value = name;
                    });
                });
            }
        };

        npcBtn.addEventListener('click', () => {
            npcBtn.addClass('active');
            pcBtn.removeClass('active');
            this.msgType = 'npc';
            renderFormFields();
        });

        pcBtn.addEventListener('click', () => {
            pcBtn.addClass('active');
            npcBtn.removeClass('active');
            this.msgType = 'player';
            renderFormFields();
        });

        renderFormFields();

        // Nội dung tin nhắn
        contentEl.createEl('div', { text: 'NỘI DUNG', cls: 'dnd-modal-label' });
        const contentTextarea = contentEl.createEl('textarea', {
            placeholder: 'Nội dung lời thoại hoặc thông báo...',
            cls: 'dnd-modal-textarea'
        });
        contentTextarea.addEventListener('input', () => {
            this.content = contentTextarea.value;
        });

        // Hàng nút dưới cùng
        const buttonRow = contentEl.createDiv({ cls: 'dnd-modal-button-row' });
        
        const cancelBtn = buttonRow.createEl('button', { text: 'Hủy', cls: 'dnd-modal-btn-cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const addBtn = buttonRow.createEl('button', { text: 'Thêm Vào Lịch Sử', cls: 'dnd-modal-btn-add' });
        addBtn.addEventListener('click', async () => {
            if (!this.content.trim()) {
                new Notice("Vui lòng nhập nội dung tin nhắn!");
                return;
            }

            const chatBox = this.view.contentEl.querySelector('.dnd-chat-box') as HTMLDivElement;

            if (this.msgType === 'npc') {
                const finalSpeaker = this.speakerName.trim() || 'NPC';
                await this.view.pushToChatHistory({
                    sender: 'npc',
                    text: this.content.trim(),
                    npcName: finalSpeaker
                });
            } else {
                await this.view.pushToChatHistory({
                    sender: 'player',
                    text: this.content.trim()
                });
            }

            this.view.renderChatMessages(chatBox);
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class PromptConfigModal extends Modal {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('dnd-settings-modal');

        const lang = this.plugin.settings.language || 'vi';

        contentEl.createEl('h2', { text: t('settings_modal_title', lang), cls: 'dnd-modal-title' });

        // Prompt
        contentEl.createEl('div', { text: t('settings_modal_prompt', lang), cls: 'dnd-modal-label' });
        const promptInput = contentEl.createEl('textarea', { cls: 'dnd-modal-textarea' });
        promptInput.style.minHeight = '100px';
        promptInput.value = this.plugin.settings.customPrompt;
        promptInput.addEventListener('change', async () => {
            this.plugin.settings.customPrompt = promptInput.value;
            await this.plugin.saveSettings();
        });

        // Style
        contentEl.createEl('div', { text: t('settings_modal_style', lang), cls: 'dnd-modal-label' });
        const styleInput = contentEl.createEl('textarea', { cls: 'dnd-modal-textarea' });
        styleInput.style.minHeight = '60px';
        styleInput.placeholder = lang === 'vi' ? 'Ví dụ: Hài hước, cợt nhả, thích châm biếm...' : 'e.g. Humorous, sarcastic, witty...';
        styleInput.value = this.plugin.settings.customStyle;
        styleInput.addEventListener('change', async () => {
            this.plugin.settings.customStyle = styleInput.value;
            await this.plugin.saveSettings();
        });

        // Rules
        contentEl.createEl('div', { text: t('settings_modal_rules', lang), cls: 'dnd-modal-label' });
        const rulesInput = contentEl.createEl('textarea', { cls: 'dnd-modal-textarea' });
        rulesInput.style.minHeight = '80px';
        rulesInput.placeholder = lang === 'vi' ? 'Ví dụ: 1. Luôn chèn emoji. 2. Không xưng tôi...' : 'e.g. 1. Always use emojis. 2. Never say I...';
        rulesInput.value = this.plugin.settings.customRules;
        rulesInput.addEventListener('change', async () => {
            this.plugin.settings.customRules = rulesInput.value;
            await this.plugin.saveSettings();
        });

        // Hàng nút dưới cùng
        const buttonRow = contentEl.createDiv({ cls: 'dnd-modal-button-row' });
        const closeBtn = buttonRow.createEl('button', { text: t('settings_modal_close', lang), cls: 'dnd-modal-btn-add' });
        closeBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }
}