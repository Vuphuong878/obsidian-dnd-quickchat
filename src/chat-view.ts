// src/chat-view.ts
import { ItemView, WorkspaceLeaf, TFile, Notice, Modal, Setting, App, getAllTags } from 'obsidian';
import { generateAiRoleplay, RoleplayContext, generateChatSummary } from './ai-service';
import MyPlugin from './main';

export const VIEW_TYPE_QUICK_CHAT = 'dnd-quick-chat-view';

const PC_MOODS = [
    "Bình thường", "Vui vẻ", "Hào hứng",
    "Nghiêm túc", "Tự tin", "Tò mò",
    "Lo âu", "Cảnh giác", "Buồn bã",
    "Tức giận", "Hoài nghi", "Sợ hãi"
];

export class QuickChatView extends ItemView {
    plugin: MyPlugin;
    chatHistory: { sender: 'player' | 'npc', text: string, npcName?: string }[] = [];
    activeNpc: string = '';
    selectedMood: string = 'Bình thường';
    pcSelectEl!: HTMLSelectElement;
    npcSelectEl!: HTMLSelectElement;
    apiStatusDetailsEl!: HTMLDetailsElement;
    apiStatusContentEl!: HTMLDivElement;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_QUICK_CHAT;
    }

    getDisplayText() {
        return "Đối thoại nhanh D&D";
    }

    getIcon() {
        return "message-square-plus"; // Icon đẹp từ Obsidian Lucide library
    }

    async onOpen() {
        // Nạp lịch sử chat từ plugin settings
        this.chatHistory = this.plugin.settings.chatHistory || [];

        const container = this.contentEl;
        container.empty();
        container.addClass('dnd-chat-sidebar');

        // Khung trạng thái API & Models thu gọn
        this.renderApiStatusPanel(container);

        // Khung danh sách PC & NPC trên cùng 1 hàng
        const selectorsRow = container.createDiv({ cls: 'dnd-selectors-row' });
        
        const pcCol = selectorsRow.createDiv({ cls: 'dnd-selector-col' });
        pcCol.createEl('span', { text: 'PC:', cls: 'dnd-label' });
        this.pcSelectEl = pcCol.createEl('select', { cls: 'dnd-select' });
        this.populateDropdown(this.pcSelectEl, 'character');

        const npcCol = selectorsRow.createDiv({ cls: 'dnd-selector-col' });
        npcCol.createEl('span', { text: 'NPC:', cls: 'dnd-label' });
        this.npcSelectEl = npcCol.createEl('select', { cls: 'dnd-select' });
        this.populateDropdown(this.npcSelectEl, 'npc');

        // Khung tâm trạng (Mood buttons)
        const moodSection = container.createDiv({ cls: 'dnd-mood-sec' });
        moodSection.createEl('div', { text: 'TÂM TRẠNG PC:', cls: 'dnd-section-header' });
        const moodGrid = moodSection.createDiv({ cls: 'dnd-mood-grid' });

        PC_MOODS.forEach(mood => {
            const btn = moodGrid.createEl('button', { text: mood, cls: 'dnd-mood-btn' });
            if (mood === this.selectedMood) btn.addClass('active');
            btn.addEventListener('click', () => {
                moodGrid.querySelectorAll('.dnd-mood-btn').forEach(b => b.removeClass('active'));
                btn.addClass('active');
                this.selectedMood = mood;
            });
        });

        // Khung tin nhắn đã trò chuyện (Scrollable Chat Box)
        const chatBox = container.createDiv({ cls: 'dnd-chat-box' });
        this.renderChatMessages(chatBox);

        // Ô Nhập liệu gợi ý & Lời thoại NPC
        const inputSection = container.createDiv({ cls: 'dnd-input-section' });

        inputSection.createEl('div', { text: 'HÀNH ĐỘNG / GỢI Ý CHO PC (TÙY CHỌN):', cls: 'dnd-input-label' });
        const suggestionInput = inputSection.createEl('textarea', {
            placeholder: 'Gợi ý cho PC (VD: Đồng ý nhưng miễn cưỡng...)',
            cls: 'dnd-textarea-pc'
        });

        // Hàng điều khiển nút bấm của PC (Dưới HÀNH ĐỘNG / GỢI Ý CHO PC và trên LỜI THOẠI / HÀNH ĐỘNG CỦA NPC)
        const pcActionRow = inputSection.createDiv({ cls: 'dnd-action-row' });

        // Container cho các checkbox bên trái
        const checkboxContainer = pcActionRow.createDiv();
        checkboxContainer.style.display = 'flex';
        checkboxContainer.style.gap = '12px';
        checkboxContainer.style.alignItems = 'center';

        // Checkbox Chủ động
        const proactiveCheckbox = checkboxContainer.createEl('label', { cls: 'dnd-checkbox-label' });
        const pCheck = proactiveCheckbox.createEl('input', { type: 'checkbox' });
        proactiveCheckbox.createEl('span', { text: ' Chủ động' });

        // Checkbox 18+
        const nsfwCheckbox = checkboxContainer.createEl('label', { cls: 'dnd-checkbox-label' });
        const nCheck = nsfwCheckbox.createEl('input', { type: 'checkbox' });
        nsfwCheckbox.createEl('span', { text: ' 18+' });

        // Nhóm các nút PC ở bên phải
        const pcButtonsContainer = pcActionRow.createDiv();
        pcButtonsContainer.style.display = 'flex';
        pcButtonsContainer.style.gap = '8px';

        // Nút Thêm tin nhắn PC
        const addPcBtn = pcButtonsContainer.createEl('button', { text: 'Thêm tin nhắn PC', cls: 'dnd-manual-btn' });
        addPcBtn.addEventListener('click', async () => {
            const pcText = suggestionInput.value.trim();
            if (!pcText) {
                new Notice("Vui lòng nhập nội dung cho PC ở ô HÀNH ĐỘNG / GỢI Ý CHO PC!");
                return;
            }
            // Thêm vào history dưới danh nghĩa PC
            await this.pushToChatHistory({ sender: 'player', text: pcText });
            this.renderChatMessages(chatBox);
            
            await this.savePcChatToDailyFile(pcText, false);

            suggestionInput.value = '';
        });

        // Nút Gợi ý hành động
        const suggestActionBtn = pcButtonsContainer.createEl('button', { text: 'Gợi ý hành động', cls: 'dnd-send-btn' });
        suggestActionBtn.addEventListener('click', async () => {
            const npcText = npcSpeakInput.value.trim();
            const pcSuggest = suggestionInput.value.trim();
            const chosenPc = this.pcSelectEl.value;
            const chosenNpc = this.npcSelectEl.value;

            const npcDisplayName = this.npcSelectEl.options[this.npcSelectEl.selectedIndex]?.text || chosenNpc || 'NPC';

            // Nếu có lời thoại NPC, thêm vào lịch sử
            if (npcText) {
                await this.pushToChatHistory({ sender: 'npc', text: npcText, npcName: npcDisplayName });
                this.renderChatMessages(chatBox);
                await this.saveNpcChatToDailyFile(npcDisplayName, npcText);
                npcSpeakInput.value = '';
            }

            suggestActionBtn.disabled = true;
            suggestActionBtn.textContent = 'AI ĐANG SUY NGHĨ...';

            try {
                const vaultContext = await this.gatherVaultContext(chosenPc, chosenNpc, pcSuggest);

                const pcDisplayName = this.pcSelectEl.options[this.pcSelectEl.selectedIndex]?.text || chosenPc;
                const npcDisplayName = this.npcSelectEl.options[this.npcSelectEl.selectedIndex]?.text || chosenNpc;

                const response = await generateAiRoleplay(
                    this.plugin,
                    {
                        pcName: pcDisplayName,
                        npcName: npcDisplayName,
                        pcInfo: vaultContext.pcInfo,
                        npcInfo: vaultContext.npcInfo,
                        worldInfo: vaultContext.worldInfo,
                        sceneContext: vaultContext.activeNoteContent,
                        chatHistory: this.chatHistory,
                        pcMood: this.selectedMood,
                        pcSuggestion: pcSuggest,
                        isProactiveMode: pCheck.checked,
                        isNsfwMode: nCheck.checked
                    }
                );

                await this.pushToChatHistory({ sender: 'player', text: response });
                this.renderChatMessages(chatBox);

                // Tự động chèn đoạn hội thoại này vào file nhật ký ngày hôm nay
                await this.savePcChatToDailyFile(response, true);
                
                // Xóa gợi ý sau khi xử lý xong
                suggestionInput.value = '';

            } catch (err) {
                new Notice("Gặp lỗi khi tạo lời thoại từ Gemini. Vui lòng kiểm tra lại cấu hình API key trong phần Settings.");
            } finally {
                suggestActionBtn.disabled = false;
                suggestActionBtn.textContent = 'Gợi ý hành động';
            }
        });

        // Label LỜI THOẠI / HÀNH ĐỘNG CỦA NPC
        inputSection.createEl('div', { text: 'LỜI THOẠI / HÀNH ĐỘNG CỦA NPC:', cls: 'dnd-input-label' });
        const npcSpeakInput = inputSection.createEl('textarea', {
            placeholder: 'Nhập lời thoại/hành động của NPC tại đây...',
            cls: 'dnd-textarea-npc'
        });

        // Hàng điều khiển nút bấm của NPC (Dưới LỜI THOẠI / HÀNH ĐỘNG CỦA NPC)
        const npcActionRow = inputSection.createDiv({ cls: 'dnd-action-row' });
        npcActionRow.createDiv(); // Dummy spacer to push the button to the right

        // Nút Gửi hành động NPCs
        const sendNpcBtn = npcActionRow.createEl('button', { text: 'Gửi hành động NPCs', cls: 'dnd-send-btn' });
        sendNpcBtn.addEventListener('click', async () => {
            const npcText = npcSpeakInput.value.trim();
            if (!npcText) {
                new Notice("Vui lòng nhập nội dung cho NPC ở ô LỜI THOẠI / HÀNH ĐỘNG CỦA NPC!");
                return;
            }
            const chosenNpc = this.npcSelectEl.value;
            const npcDisplayName = this.npcSelectEl.options[this.npcSelectEl.selectedIndex]?.text || chosenNpc || 'NPC';

            await this.pushToChatHistory({ sender: 'npc', text: npcText, npcName: npcDisplayName });
            this.renderChatMessages(chatBox);
            await this.saveNpcChatToDailyFile(npcDisplayName, npcText);
            npcSpeakInput.value = '';
        });
    }

    async pushToChatHistory(msg: { sender: 'player' | 'npc', text: string, npcName?: string }) {
        this.chatHistory.push(msg);
        if (this.chatHistory.length > 30) {
            this.chatHistory = this.chatHistory.slice(this.chatHistory.length - 30);
        }
        this.plugin.settings.chatHistory = this.chatHistory;
        await this.plugin.saveSettings();
    }

    // Tự động quét các note có thuộc tính rpg_type hoặc tags tương ứng
    async populateDropdown(selectEl: HTMLSelectElement, type: 'character' | 'npc') {
        selectEl.empty();
        const files = this.app.vault.getMarkdownFiles();
        let found = false;

        const targetTag = type === 'character' ? 'dnd-character' : 'dnd-npc';

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            const rpgType = frontmatter?.rpg_type;
            const fileTags = (cache ? getAllTags(cache) : []) ?? [];

            let isMatched = rpgType === type;
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
                selectEl.createEl('option', { value: file.basename, text: displayName });
                found = true;
            }
        }

        if (!found) {
            const displayName = type === 'character' ? 'PC' : 'NPC';
            selectEl.createEl('option', { value: '', text: `Chưa quét được ${displayName}` });
        }
    }

    // Logic chắt lọc thông tin tệp cực kỳ thông minh: Kết hợp Tĩnh (quickchat: true) và Động (Quét liên kết)
    async gatherVaultContext(pcFileBasename: string, npcFileBasename: string, suggestionText: string = "") {
        let pcInfo = "Nhân vật thông thái, dũng cảm.";
        let npcInfo = "Người bí ẩn trong cuộc hành trình.";
        let worldInfo = "Vũ trụ Fantasy huyền diệu ẩn chứa nhiều cổ vật chưa lời giải.";
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

        // 2. Tìm note PC
        if (pcFileBasename) {
            const pcFile = files.find(f => f.basename === pcFileBasename);
            if (pcFile) {
                pcInfo = this.formatCharacterInfo(pcFile, await this.app.vault.read(pcFile));
            }
        }

        // 3. Tìm note NPC
        if (npcFileBasename) {
            const npcFile = files.find(f => f.basename === npcFileBasename);
            if (npcFile) {
                npcInfo = this.formatCharacterInfo(npcFile, await this.app.vault.read(npcFile));
            }
        }

        // 4. Lọc Bối cảnh phụ trợ (Tài liệu, Lore, NPC phụ...) bằng quickchat: true HOẶC liên kết động
        const additionalContexts: string[] = [];
        for (const file of files) {
            // Bỏ qua PC, NPC chính và Note đang mở vì đã xử lý riêng
            if (file.basename === pcFileBasename || file.basename === npcFileBasename) continue;
            if (activeFile && file.path === activeFile.path) continue;

            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            
            const isQuickchatTrue = frontmatter?.quickchat === true;
            const isLinked = linkedNotes.has(file.basename.toLowerCase());

            if (isQuickchatTrue || isLinked) {
                const content = await this.app.vault.read(file);
                additionalContexts.push(`=== TÀI LIỆU BỔ SUNG: ${file.basename} ===\n${content}`);
            }
        }
        
        if (additionalContexts.length > 0) {
            worldInfo = additionalContexts.join('\n\n');
        } else {
            worldInfo = "Chưa có thêm thông tin bối cảnh tĩnh nào.";
        }

        return { pcInfo, npcInfo, worldInfo, activeNoteContent };
    }

    refreshDropdowns() {
        if (this.pcSelectEl) this.populateDropdown(this.pcSelectEl, 'character');
        if (this.npcSelectEl) this.populateDropdown(this.npcSelectEl, 'npc');
    }

    formatCharacterInfo(file: TFile, rawContent: string): string {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        if (!frontmatter) {
            return rawContent;
        }

        let info = `[NHÂN VẬT: ${frontmatter.name || file.basename}]\n`;
        if (frontmatter.race) info += `- Chủng tộc: ${frontmatter.race}\n`;
        
        if (frontmatter.class) {
            info += `- Lớp nhân vật: ${Array.isArray(frontmatter.class) ? frontmatter.class.join(', ') : frontmatter.class}\n`;
        }
        if (frontmatter.level) info += `- Cấp độ: ${frontmatter.level}\n`;
        if (frontmatter.alignment) info += `- Thiên hướng: ${frontmatter.alignment}\n`;
        if (frontmatter.background) info += `- Nguồn gốc: ${frontmatter.background}\n`;

        if (frontmatter.status) {
            info += `- Trạng thái:\n`;
            if (frontmatter.status.hp) {
                info += `  * HP: ${frontmatter.status.hp.current}/${frontmatter.status.hp.max}\n`;
            }
            if (frontmatter.status.ac) info += `  * Giáp (AC): ${frontmatter.status.ac}\n`;
            if (frontmatter.status.initiative) info += `  * Sáng kiến (Initiative): +${frontmatter.status.initiative}\n`;
            if (frontmatter.status.passive_perception) info += `  * Nhận thức thụ động: ${frontmatter.status.passive_perception}\n`;
        }

        if (frontmatter.stats) {
            info += `- Chỉ số thuộc tính:\n`;
            for (const [stat, val] of Object.entries(frontmatter.stats)) {
                info += `  * ${stat.toUpperCase()}: ${val}\n`;
            }
        }

        if (frontmatter.proficiencies) {
            info += `- Độ thành thạo:\n`;
            if (frontmatter.proficiencies.saving_throws) {
                info += `  * Cứu nguy (Saving Throws): ${Array.isArray(frontmatter.proficiencies.saving_throws) ? frontmatter.proficiencies.saving_throws.join(', ') : frontmatter.proficiencies.saving_throws}\n`;
            }
            if (frontmatter.proficiencies.skills) {
                info += `  * Kỹ năng: ${Array.isArray(frontmatter.proficiencies.skills) ? frontmatter.proficiencies.skills.join(', ') : frontmatter.proficiencies.skills}\n`;
            }
            if (frontmatter.proficiencies.languages) {
                info += `  * Ngôn ngữ: ${Array.isArray(frontmatter.proficiencies.languages) ? frontmatter.proficiencies.languages.join(', ') : frontmatter.proficiencies.languages}\n`;
            }
        }

        if (frontmatter.spells_prepared) {
            info += `- Phép thuật đã chuẩn bị: ${Array.isArray(frontmatter.spells_prepared) ? frontmatter.spells_prepared.join(', ') : frontmatter.spells_prepared}\n`;
        }

        let body = rawContent;
        const matches = rawContent.match(/^---[\s\S]+?---/);
        if (matches) {
            body = rawContent.slice(matches[0].length).trim();
        }

        info += `\n=== TIỂU SỬ & MÔ TẢ CHI TIẾT ===\n${body}`;
        return info;
    }

    // Vẽ box trò chuyện đẹp đẽ như game nhập vai
    renderChatMessages(chatContainer: HTMLDivElement) {
        chatContainer.empty();

        if (this.chatHistory.length === 0) {
            chatContainer.createEl('div', {
                text: 'Hội thoại trống. Hãy bắt đầu nhập lời nói của NPC phía dưới để kích hoạt AI nhập vai nhân vật của bạn.',
                cls: 'dnd-empty-state'
            });
            return;
        }

        this.chatHistory.forEach(msg => {
            const bubbleWrapper = chatContainer.createDiv({
                cls: `dnd-msg-wrapper ${msg.sender === 'player' ? 'pc-side' : 'npc-side'}`
            });

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

    renderApiStatusPanel(container: HTMLElement) {
        this.apiStatusDetailsEl = container.createEl('details', { cls: 'dnd-api-status-details' });
        this.apiStatusDetailsEl.createEl('summary', { cls: 'dnd-api-status-summary', text: '⚡ Trạng thái API & Models' });
        this.apiStatusContentEl = this.apiStatusDetailsEl.createDiv({ cls: 'dnd-api-status-content' });
        this.updateApiStatusDisplay();
    }

    updateApiStatusDisplay() {
        if (!this.apiStatusContentEl) return;
        this.apiStatusContentEl.empty();

        const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
        const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
        const allModels = [...goodModels, ...badModels];

        const shortNames: { [model: string]: string } = {
            'gemini-3.5-flash': '3.5',
            'gemini-3-flash': '3',
            'gemini-2.5-flash': '2.5',
            'gemma-4-31b-it': '31b',
            'gemma-4-26b-a4b-it': '26b'
        };

        for (let i = 0; i < 5; i++) {
            const row = this.apiStatusContentEl.createDiv({ cls: 'dnd-sidebar-key-row' });
            const apiKey = this.plugin.settings.geminiApiKeys[i];
            const hasKey = apiKey && apiKey.trim().length > 0;

            row.createDiv({
                text: `Key ${i + 1}: ${hasKey ? `(${apiKey.substring(0, 4)}...)` : '(Trống)'}`,
                cls: `dnd-sidebar-key-label ${hasKey ? '' : 'empty'}`
            });

            const badgeContainer = row.createDiv({ cls: 'dnd-sidebar-badges' });

            for (const model of allModels) {
                const status = this.plugin.apiModelStatus[i]?.[model] || 'AVAILABLE';
                const badge = badgeContainer.createSpan({ 
                    cls: 'dnd-sidebar-badge',
                    text: shortNames[model] || model
                });

                if (!hasKey) {
                    badge.addClass('inactive');
                } else {
                    if (status === 'AVAILABLE') {
                        badge.addClass('available');
                    } else {
                        badge.addClass('exhausted');
                    }
                }
            }
        }
    }

    async summarizeConversation() {
        if (this.chatHistory.length === 0) {
            new Notice("Lịch sử đối thoại đang trống, không thể tóm tắt!");
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("Không có file nhật ký nào đang mở để lưu tóm tắt!");
            return;
        }

        new Notice("Đang tóm tắt phiên đối thoại...");

        try {
            const summary = await generateChatSummary(
                this.plugin,
                this.chatHistory
            );

            const formatSummary = `\n\n**[Tóm tắt đối thoại - Distilled Memory]**\n> ${summary}\n`;
            await this.app.vault.append(activeFile, formatSummary);
            new Notice("Đã lưu tóm tắt cuộc đối thoại vào nhật ký!");
        } catch (err) {
            console.error(err);
            new Notice("Gặp lỗi khi tóm tắt cuộc đối thoại qua Gemini.");
        }
    }
}

export class CreateCharacterModal extends Modal {
    plugin: MyPlugin;
    name: string = '';
    type: 'character' | 'npc' = 'npc';
    onCreated: () => void;

    constructor(app: App, plugin: MyPlugin, onCreated: () => void) {
        super(app);
        this.plugin = plugin;
        this.onCreated = onCreated;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Tạo Nhân Vật Mới (PC/NPC)', cls: 'dnd-modal-title' });

        new Setting(contentEl)
            .setName('Tên nhân vật')
            .setDesc('Nhập tên hiển thị của nhân vật.')
            .addText(text => text
                .setPlaceholder('Ví dụ: Saula, Sylvie...')
                .onChange(value => this.name = value.trim()));

        new Setting(contentEl)
            .setName('Loại nhân vật')
            .setDesc('Chọn loại nhân vật chính (PC) hoặc nhân vật phụ (NPC).')
            .addDropdown(dropdown => dropdown
                .addOption('npc', 'Nhân vật phụ (NPC)')
                .addOption('character', 'Nhân vật chính (PC)')
                .setValue(this.type)
                .onChange(value => this.type = value as 'character' | 'npc'));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Tạo Tệp Tin')
                .setCta()
                .onClick(async () => {
                    if (!this.name) {
                        new Notice("Vui lòng nhập tên nhân vật!");
                        return;
                    }

                    const sanitizedName = this.name.replace(/[\\\/:\*\?"<>\|]/g, ''); // Loại bỏ ký tự đặc biệt trong tên file
                    let folderPath = '';
                    
                    // Kiểm tra và chọn thư mục lưu trữ thích hợp
                    const folders = this.app.vault.getAllLoadedFiles().filter(f => (f as any).children !== undefined);
                    const hasNpcFolder = folders.some(f => f.path === 'Characters/NPCs');
                    const hasPcFolder = folders.some(f => f.path === 'Characters/PC');
                    const hasCharactersFolder = folders.some(f => f.path === 'Characters');

                    if (this.type === 'npc') {
                        if (hasNpcFolder) folderPath = 'Characters/NPCs/';
                        else if (hasCharactersFolder) folderPath = 'Characters/';
                    } else {
                        if (hasPcFolder) folderPath = 'Characters/PC/';
                        else if (hasCharactersFolder) folderPath = 'Characters/';
                    }

                    const filePath = `${folderPath}${sanitizedName}.md`;

                    // Kiểm tra xem file đã tồn tại chưa
                    if (this.app.vault.getAbstractFileByPath(filePath)) {
                        new Notice("Nhân vật này đã tồn tại!");
                        return;
                    }

                    const tag = this.type === 'character' ? 'dnd-character' : 'dnd-npc';
                    const defaultYaml = `---
name: "${this.name}"
race: "Unknown"
class: "Unknown"
level: 1
background: "Unknown Background"
alignment: "True Neutral"
xp: 0
hp_max: 10
hp_current: 10
hp_temp: 0
ac: 10
speed: 30
proficiency_bonus: 2
str: 10
dex: 10
con: 10
int: 10
wis: 10
cha: 10
tags: ["${tag}"]
quickchat: false
---

# ${this.name}

> **Unknown** • Unknown • Level 1
> *Unknown Background — True Neutral*

## Core Stats

| HP | AC | Speed | Initiative | Proficiency Bonus |
|:---:|:---:|:---:|:---:|:---:|
| 10 / 10 | 10 | 30 ft | +0 | +2 |

## Ability Scores

|   STR   |   DEX   |   CON   |   INT   |   WIS   |   CHA   |
| :-----: | :-----: | :-----: | :-----: | :-----: | :-----: |
| 10 (+0) | 10 (+0) | 10 (+0) | 10 (+0) | 10 (+0) | 10 (+0) |

## Actions & Attacks

| Name | ATK Bonus | Damage | Range | Notes |
|:---|:---:|:---|:---:|:---|
| ⚔️ Unarmed Strike | +2 | 1 | 5 ft | Bludgeoning |

## Backstory & Notes

*Add your notes here.*
`;

                    try {
                        const newFile = await this.app.vault.create(filePath, defaultYaml);
                        new Notice(`Đã tạo nhân vật ${this.name} thành công!`);
                        
                        // Mở file mới tạo trong Obsidian để người dùng chỉnh sửa
                        const leaf = this.app.workspace.getLeaf(false);
                        await leaf.openFile(newFile);
                        
                        this.onCreated();
                        this.close();
                    } catch (err) {
                        console.error(err);
                        new Notice("Gặp lỗi trong quá trình tạo tệp tin nhân vật.");
                    }
                }));
    }

    onOpenStyle() {
        // No-op
    }

    onClose() {
        this.contentEl.empty();
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