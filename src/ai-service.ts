import { requestUrl } from 'obsidian';
import MyPlugin from './main';
import { ProxyConfig } from './settings';

export interface RoleplayContext {
    pcName: string;
    npcName: string;
    pcInfo: string;         // Thông tin nhân vật chính (PC)
    npcInfo: string;        // Thông tin NPC đang nói chuyện
    worldInfo: string;      // Thông tin bối cảnh thế giới
    sceneContext: string;   // Ghi chép câu chuyện hiện tại (active note)
    chatHistory: { sender: 'player' | 'npc', text: string, npcName?: string }[];
    pcMood: string;         // Tâm trạng PC
    pcSuggestion: string;   // Gợi ý hành động PC
    isProactiveMode: boolean; // Chế độ chủ động
    isNsfwMode: boolean;    // Chế độ 18+
    generateDialogue: boolean;
    generateAction: boolean;
    generateThought: boolean;
    isRequestCheckEnabled: boolean;
    language: 'vi' | 'en';
}

export async function generateAiRoleplay(
    plugin: MyPlugin,
    context: RoleplayContext,
    proxyConfig?: ProxyConfig | null,
    onUpdate?: (chunk: string) => void
): Promise<string> {
    const isEn = context.language === 'en';

    // Định dạng lịch sử trò chuyện
    const formattedHistory = context.chatHistory.map(msg => {
        const name = msg.sender === 'player' ? context.pcName : (msg.npcName || 'NPC');
        return `${name}: ${msg.text}`;
    }).join('\n');

    let formatRequirements = isEn 
        ? `**FORMATTING REQUIREMENTS (MANDATORY TO FOLLOW):**\n`
        : `**YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC TUÂN THỦ):**\n`;
        
    const formatRules: string[] = [];

    if (isEn) {
        if (context.generateDialogue) {
            formatRules.push(`1. **Speech:** Enclose in double quotes "...".`);
        } else {
            formatRules.push(`1. **FORBIDDEN to speak:** Absolutely DO NOT generate any speech, direct quotes, or dialogue for character ${context.pcName} (Do NOT use double quotes "...").`);
        }

        if (context.generateAction) {
            formatRules.push(`2. **Action:** Describe action in third-person, using the character name ${context.pcName}.`);
        } else {
            formatRules.push(`2. **FORBIDDEN to describe actions:** Absolutely DO NOT describe any actions, gestures, or physical movement for character ${context.pcName}.`);
        }

        if (context.generateThought) {
            formatRules.push(`3. **Thought:** Write thoughts in first-person, in italics *...*.`);
        } else {
            formatRules.push(`3. **FORBIDDEN to describe thoughts:** Absolutely DO NOT describe any secret thoughts or inner musings for character ${context.pcName} (Do NOT use italics *...*).`);
        }
        formatRules.push(`4. **LINE BREAK:** Each generated component must be on its own line.`);
    } else {
        if (context.generateDialogue) {
            formatRules.push(`1. **Lời nói:** Để trong dấu ngoặc kép "...".`);
        } else {
            formatRules.push(`1. **CẤM tạo lời thoại:** Tuyệt đối KHÔNG tạo bất kỳ lời thoại, câu nói trực tiếp, hay đoạn hội thoại nào của nhân vật ${context.pcName} (Không dùng dấu ngoặc kép "...").`);
        }

        if (context.generateAction) {
            formatRules.push(`2. **Hành động:** Tả hành động bằng ngôi thứ ba, dùng tên nhân vật ${context.pcName}.`);
        } else {
            formatRules.push(`2. **CẤM tả hành động:** Tuyệt đối KHÔNG mô tả bất kỳ hành động, cử chỉ, hay di chuyển vật lý nào của nhân vật ${context.pcName}.`);
        }

        if (context.generateThought) {
            formatRules.push(`3. **Suy nghĩ:** Viết suy nghĩ bằng ngôi thứ nhất, in nghiêng *...*.`);
        } else {
            formatRules.push(`3. **CẤM tả suy nghĩ:** Tuyệt đối KHÔNG mô tả suy nghĩ thầm kín hay suy tư nội tâm của nhân vật ${context.pcName} (Không dùng chữ in nghiêng *...*).`);
        }
        formatRules.push(`4. **TÁCH DÒNG:** Mỗi thành phần được tạo ra phải nằm trên một dòng riêng biệt.`);
    }

    formatRequirements += formatRules.join('\n');

    let systemInstruction = `${plugin.settings.customPrompt}

${isEn ? '**WORLD BACKGROUND & REFERENCE INFO:**' : '**BỐI CẢNH THẾ GIỚI & THÔNG TIN THAM KHẢO:**'}
${context.worldInfo}

${isEn ? '**CURRENT SCENE (ADVENTURE JOURNAL):**' : '**KHUNG CẢNH HIỆN TẠI (NHẬT KÝ PHIÊU LƯU):**'}
${context.sceneContext}

${isEn ? '**YOUR CHARACTER INFO:**' : '**THÔNG TIN NHÂN VẬT CỦA BẠN:**'}
- ${isEn ? 'Name' : 'Tên'}: ${context.pcName}
${context.pcInfo}
- ${isEn ? 'CURRENT MOOD' : 'TÂM TRẠNG HIỆN TẠI'}: ${context.pcMood}

${isEn ? '**INTERACTION TARGET (NPC/ENVIRONMENT):**' : '**ĐỐI TƯỢNG TƯƠNG TÁC (NPC/MÔI TRƯỜNG):**'}
- ${isEn ? 'NPC Name' : 'Tên npc'}: ${context.npcName}
${context.npcInfo}

${isEn ? '**DIALOGUE HISTORY:**' : '**LỊCH SỬ ĐỐI THOẠI:**'}
${formattedHistory}

${isEn ? '**ACTION SUGGESTION FROM PLAYER:**' : '**CHỈ THỊ HÀNH ĐỘNG TỪ NGƯỜI CHƠI:**'}
${context.pcSuggestion}

${isEn ? '**YOUR MISSION:**' : '**NHIỆM VỤ CỦA BẠN:**'}
${isEn 
    ? `You are **actively** performing an action or speaking a sentence towards **${context.npcName}**, based on the suggestion above.`
    : `Bạn đang **chủ động** thực hiện một hành động hoặc nói một câu hướng tới **${context.npcName}**, dựa trên chỉ thị ở trên.`}

${isEn ? '**STYLE FILTER (ANTI-CHEESINESS):**' : '**BỘ LỌC VĂN PHONG (ANTI-CHEESINESS):**'}
${isEn 
    ? `1. **REALISTIC:** If the suggestion is a simple action (e.g. "Buy an apple", "Ask for directions", "Attack"), perform it directly and quickly. Do not add complex internal monologue or redundant showy gestures.
${context.generateThought ? `2. **CONDITIONAL THOUGHTS:** Only write the "Thought" line if the action goes against true feelings, or requires careful calculation. Otherwise, omit it.\n` : ''}
**"NON-AI" STYLE RULES:**
- **Show, Don't Tell:** Do not write "He felt sad". Write "He stared blankly at his cold coffee, tapping his fingers aimlessly on the table".
- **Colloquial Language:** Use casual, everyday words, sometimes fragments or abbreviations. Avoid overly polished, formal, or high-flown phrasing.
- **Imperfection:** People do not always respond logically or completely. Allow characters to hesitate (uh, um...), speak evasively, or reply with another question when cornered.
- **Non-verbal Reactions:** Interweave small gestures (frowning, adjusting collar, taking a deep breath) between dialogues to set the pace.
- **Avoid Repetitive Structures:** Absolutely DO NOT start every dialogue with the same style of action description. Vary sentence lengths for a natural feel.
- **Strictly Ban AI-like Phrases:** Do not use words like "As an AI...", "I understand your feelings...", or moral summaries at the end of the response.`
    : `1. **THỰC TẾ:** Nếu chỉ thị là một hành động đơn giản (VD: "Mua táo", "Hỏi đường", "Tấn công"), hãy thực hiện nó một cách trực diện, nhanh gọn. Đừng thêm thắt các mô tả nội tâm phức tạp hay cử chỉ thừa thãi "làm màu".
${context.generateThought ? `2. **SUY NGHĨ CÓ ĐIỀU KIỆN:** Chỉ viết dòng "Suy nghĩ" nếu hành động đó đi ngược lại với cảm xúc thật, hoặc cần tính toán kỹ lưỡng. Nếu không, hãy bỏ qua.\n` : ''}
**QUY TẮC VĂN PHONG "PHI AI":**
- **Show, Don't Tell (Diễn đạt qua hành động):** Đừng viết "Anh ấy cảm thấy buồn". Hãy viết "Anh ấy nhìn chằm chằm vào ly cà phê đã nguội ngắt, ngón tay gõ nhịp vô định lên mặt bàn".
- **Ngôn ngữ đời thường:** Sử dụng các từ ngữ gần gũi, đôi khi là khẩu ngữ hoặc câu tỉnh lược. Tránh các từ ngữ quá trau chuốt, hào nhoáng hoặc các cấu trúc câu phức tạp kiểu lý thuyết.
- **Tính bất toàn:** Con người không luôn trả lời logic hoặc đầy đủ. Hãy cho phép nhân vật có những lúc ngập ngừng (ừm, à...), nói lảng tránh, hoặc trả lời bằng một câu hỏi khác khi bị dồn vào thế bí.
- **Phản ứng phi ngôn ngữ:** Lồng ghép các cử chỉ nhỏ (nhíu mày, chỉnh cổ áo, hít một hơi sâu) xen kẽ vào lời thoại để tạo nhịp điệu.
- **Tránh cấu trúc lặp lại:** Tuyệt đối không bắt đầu mọi câu thoại bằng cùng một kiểu mô tả hành động. Hãy thay đổi độ dài ngắn của câu để tạo cảm giác tự nhiên.
- **Cấm tuyệt đối các cụm từ kiểu AI:** Không sử dụng các từ như "Với tư cách là...", "Tôi hiểu cảm xúc của bạn...", hoặc các câu tổng kết bài học đạo đức cuối đoạn chat.`}

${formatRequirements}

${isEn ? '**CONTEXT CONSTRAINT:**' : '**RÀO CẢN BỐI CẢNH:**'}
- ${isEn ? 'DO NOT IMPROVISE OUTCOMES: Do not invent the results of actions (e.g. do not write "I found the treasure" unless DM announced it). Only describe the attempt.' : 'KHÔNG TỰ Ý TẢ CẢNH: Không được tự bịa ra kết quả của hành động (VD: không viết "Tôi tìm thấy kho báu" khi chưa có thông báo từ DM). Chỉ mô tả nỗ lực hành động.'}
- ${isEn ? 'SPECIFIC ACTIONS: Perform exactly what was suggested.' : 'HÀNH ĐỘNG CỤ THỂ: Thực hiện chính xác chỉ thị.'}`;

    if (plugin.settings.customStyle && plugin.settings.customStyle.trim()) {
        systemInstruction += `\n\n${isEn ? '**PERSONAL STYLE:**' : '**VĂN PHONG CÁ NHÂN (STYLE):**'}\n${plugin.settings.customStyle}`;
    }

    if (plugin.settings.customRules && plugin.settings.customRules.trim()) {
        systemInstruction += `\n\n${isEn ? '**ADDITIONAL RULES:**' : '**QUY TẮC BỔ SUNG (RULES):**'}\n${plugin.settings.customRules}`;
    }

    if (context.isProactiveMode) {
        systemInstruction += isEn 
            ? `\n\n**PROACTIVE MODE**: Actively move around or observe the environment to drive the story forward, do not passively wait for questions. Do not use game terminology (Insight, Roll...) in the main action descriptions, speech, or thoughts.`
            : `\n\n**CHẾ ĐỘ CHỦ ĐỘNG**: Hãy tự tạo chuyển động hoặc quan sát môi trường để dẫn dắt câu chuyện tiến lên, không thụ động đợi câu hỏi. Không dùng thuật ngữ game (Insight, Roll...) trong phần mô tả hành động, lời thoại hoặc suy nghĩ chính.`;
    }

    if (context.isNsfwMode) {
        if (isEn) {
            systemInstruction += `\n\n**NO EUPHEMISMS:** Absolutely forbid any metaphorical language, euphemisms, or any form of toning down the erotic nature of the PC's actions and speech.
            
            **USE NATURAL LANGUAGE:** You are authorized to use the most **graphic, direct, and explicit** language to describe the genitals and sexual behaviors of the PC towards the NPC. This language must be used naturally and fit the context.
      
            **FOCUS ON PHYSICAL SENSATIONS:** Do not just describe actions. Delve deep into the specific details of the **physical sensations** that the PC feels: the slipperiness of fluids, the heat of touching skin, body scents, sounds emitted by the PC or NPC (moaning, slapping sounds, wet kissing noises...), and the darkest lustful thoughts in the character's mind.
      
            **BEHAVIOR DETAILS:** Describe the technical details of the acts. For example, when kissing, clearly describe how the tongue moves, if there is tongue-sucking or exchange of saliva. During intercourse, describe the penetration, depth, and internal sensations.`;
        } else {
            systemInstruction += `\n\n**KHÔNG NÓI GIẢM NÓI TRÁNH:** Tuyệt đối cấm sử dụng từ ngữ ẩn dụ, nói giảm nói tránh hay bất kỳ hình thức nào nhằm làm nhẹ đi tính chất dâm đãng của hành động cùng lời nói của PC.
            
            **SỬ DỤNG NGÔN NGỮ TỰ NHIÊN:** Bạn được toàn quyền sử dụng dùng ngôn ngữ **trần trụi, và trực diện nhất** để mô tả các bộ phận sinh dục và các hành vi tình dục của PC hướng đến NPC. Ngôn ngữ này phải được dùng một cách tự nhiên phù hợp với bối cảnh.
      
            **TẬP TRUNG VÀO CẢM GIÁC THỂ XÁC:** Đừng chỉ mô tả hành động. Hãy đi sâu vào chi tiết cụ thể của **cảm giác thể xác** mà PC lúc đó cảm nhận được: sự trơn trượt của dịch nhờn, độ nóng của da thịt chạm vào nhau, mùi hương của cơ thể, những âm thanh bản thân PC hay NPC phát ra (tiếng rên rỉ, tiếng da thịt va chạm, tiếng mút mát chùn chụt...), và những suy nghĩ nhục dục đen tối nhất trong tâm trí nhân vật.
      
            **CHI TIẾT HÀNH VI:** Mô tả chi tiết kỹ thuật của các hành vi. Ví dụ khi hôn, hãy tả rõ lưỡi di chuyển ra sao, có mút lưỡi hay trao đổi nước bọt không. Khi giao hợp, hãy tả rõ sự ra vào, độ sâu, cảm giác bên trong.`;
        }
    }

    if (context.isRequestCheckEnabled) {
        if (isEn) {
            systemInstruction += `\n\n**REQUEST DM CHECK & STAT OPTIMIZATION**:
- Analyze your character's stats and proficiencies in the "YOUR CHARACTER INFO" section.
- Prioritize using skills or stats that your character is proficient in (e.g. SkillProficiencies, dndSkillProficiencies) or has high attributes in (e.g. DEX, CHA, WIS) to achieve the best possible outcome.
- Describe the character's actions in a way that actively leverages and highlights these strengths (e.g. if proficient in Stealth/Dexterity, describe a silent, graceful approach; if high in Persuasion/Charisma, describe eloquent and reassuring speech).
- At the very end of your response (after all other parts), actively request a D&D 5e Skill Check from the DM in English that best fits the action just performed, matching the utilized strength. This line must stand alone and be formatted as a markdown blockquote.
Mandatory format example:
> Requesting a Perception check to look around.
(Or other attributes/skills like Stealth, Athletics, Insight, Investigation, Arcana, Persuasion... depending on the action).`;
        } else {
            systemInstruction += `\n\n**YÊU CẦU XIN CHECK DM & TỐI ƯU CHỈ SỐ**:
- Hãy phân tích các thuộc tính chỉ số (stats) và kỹ năng thành thạo (proficiencies, dndSkillProficiencies...) trong phần "THÔNG TIN NHÂN VẬT CỦA BẠN".
- Ưu tiên sử dụng các kỹ năng nhân vật thành thạo (proficiencies) hoặc chỉ số cao nhất của nhân vật (ví dụ: dndDex/Dexterity, dndCha/Charisma, dndWis/Wisdom) khi thực hiện hành động.
- Hãy mô tả hành động của nhân vật theo cách làm nổi bật và tận dụng các thế mạnh này để đạt hiệu quả cao nhất (ví dụ: nếu giỏi Stealth, hãy mô tả cách di chuyển rón rén không tiếng động; nếu giỏi Persuasion, hãy mô tả lời lẽ thuyết phục, biểu cảm đáng tin cậy).
- Ở dòng cuối cùng của phản hồi (sau tất cả các phần khác), hãy chủ động xin DM một Skill Check D&D 5e bằng tiếng Anh gốc phù hợp nhất với hành vi vừa thực hiện và thuộc tính đã tối ưu ở trên. Dòng này phải đứng riêng biệt và có định dạng trích dẫn markdown.
Ví dụ định dạng bắt buộc:
> Xin một cái check Perception để quan sát.
(Hoặc các thuộc tính/kỹ năng khác như Stealth, Athletics, Insight, Investigation, Arcana, Persuasion... tùy theo hành động).`;
        }
    }

    systemInstruction += isEn 
        ? `\n\n**MANDATORY:** You MUST write the response entirely in English.`
        : `\n\n**BẮT BUỘC:** Bạn PHẢI viết phản hồi hoàn toàn bằng Tiếng Việt.`;

    systemInstruction += isEn
        ? `\n\nPlease perform the action of ${context.pcName} now.`
        : `\n\nHãy thực hiện hành động của ${context.pcName} ngay bây giờ.`;

    const bodyContents = [
        {
            role: 'user',
            parts: [{ text: systemInstruction }]
        }
    ];

    if (proxyConfig) {
        return fetchWithProxyStreaming(proxyConfig, systemInstruction, onUpdate);
    } else {
        return fetchWithFallback(plugin, bodyContents, onUpdate);
    }
}

export async function generateChatSummary(
    plugin: MyPlugin,
    chatHistory: { sender: 'player' | 'npc', text: string, npcName?: string }[],
    proxyConfig?: ProxyConfig | null,
    onUpdate?: (chunk: string) => void
): Promise<string> {
    const formattedHistory = chatHistory.map(msg => {
        const name = msg.sender === 'player' ? 'PC' : (msg.npcName || 'NPC');
        return `${name}: ${msg.text}`;
    }).join('\n');

    const promptUser = `Bạn là một Co-DM hỗ trợ ghi nhật ký chiến dịch D&D. Dưới đây là cuộc hội thoại gần đây giữa nhân vật chính (PC) và NPC:

=== LỊCH SỬ ĐỐI THOẠI ===
${formattedHistory}

Hãy viết một đoạn tóm tắt ngắn (Distilled Memory, khoảng 2-4 câu) tóm gọn nội dung cuộc hội thoại, các thông tin quan trọng được tiết lộ, hoặc thỏa thuận đạt được. Hãy trả về kết quả thuần văn bản tóm tắt, không thêm bất kỳ tiêu đề hay lời dẫn nào khác.`;

    const bodyContents = [
        {
            role: 'user',
            parts: [{ text: promptUser }]
        }
    ];

    if (proxyConfig) {
        return fetchWithProxyStreaming(proxyConfig, promptUser, onUpdate);
    } else {
        return fetchWithFallback(plugin, bodyContents, onUpdate);
    }
}

async function fetchWithFallback(plugin: MyPlugin, bodyContents: any, onUpdate?: (chunk: string) => void): Promise<string> {
    const apiKeys = plugin.settings.geminiApiKeys;
    const validKeyIndices = apiKeys
        .map((key, index) => ({ key, index }))
        .filter(item => item.key && item.key.trim().length > 0);

    if (validKeyIndices.length === 0) {
        throw new Error("Không có API Key nào được cấu hình. Vui lòng thêm ít nhất 1 khóa API trong Settings.");
    }

    const goodModels = ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
    const badModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];

    // Vòng lặp 1: Dùng các model xịn cho toàn bộ các key
    for (const { key, index } of validKeyIndices) {
        for (const model of goodModels) {
            if (plugin.apiModelStatus[index]?.[model] === 'EXHAUSTED') {
                console.log(`[Fallback] Bỏ qua Key ${index + 1} - ${model} vì đã hết Quota.`);
                continue;
            }
            try {
                const result = await tryCallApiStream(key, model, bodyContents, onUpdate);
                plugin.setApiModelStatus(index, model, 'AVAILABLE');
                return result;
            } catch (err) {
                console.warn(`[Fallback] Lỗi API với Key ${index + 1} (${key.substring(0, 5)}...) và Model ${model}. Đang đánh dấu EXHAUSTED.`);
                plugin.setApiModelStatus(index, model, 'EXHAUSTED');
            }
        }
    }

    // Vòng lặp 2: Dùng các model dự phòng (kém hơn) cho toàn bộ các key
    for (const { key, index } of validKeyIndices) {
        for (const model of badModels) {
            if (plugin.apiModelStatus[index]?.[model] === 'EXHAUSTED') {
                console.log(`[Fallback] Bỏ qua Key ${index + 1} - ${model} (Dự phòng) vì đã hết Quota.`);
                continue;
            }
            try {
                const result = await tryCallApiStream(key, model, bodyContents, onUpdate);
                plugin.setApiModelStatus(index, model, 'AVAILABLE');
                return result;
            } catch (err) {
                console.warn(`[Fallback] Lỗi API với Key ${index + 1} (${key.substring(0, 5)}...) và Model ${model} (Dự phòng). Đang đánh dấu EXHAUSTED.`);
                plugin.setApiModelStatus(index, model, 'EXHAUSTED');
            }
        }
    }

    throw new Error("Toàn bộ API Keys và Models đều đã cạn kiệt hoặc gặp lỗi. Vui lòng kiểm tra lại Quota API trên Google AI Studio.");
}

async function tryCallApiStream(apiKey: string, modelName: string, bodyContents: any, onUpdate?: (chunk: string) => void): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contents: bodyContents })
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    return await readSSEStream(response, 'gemini', onUpdate);
}

async function fetchWithProxyStreaming(proxy: ProxyConfig, promptText: string, onUpdate?: (chunk: string) => void): Promise<string> {
    let baseUrl = proxy.url.replace(/\/+$/, '');

    // Auto-detect format
    let format = proxy.format;
    if (format === 'auto') {
        if (!proxy.key.startsWith('AIza') || baseUrl.includes('chat/completions')) {
            format = 'openai';
        } else {
            format = 'gemini';
        }
    }

    let url = '';
    let headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    let body: any = {};

    if (format === 'openai') {
        if (!baseUrl.endsWith('/v1/chat/completions') && !baseUrl.endsWith('/chat/completions')) {
            url = `${baseUrl}/v1/chat/completions`;
        } else {
            url = baseUrl;
        }
        headers['Authorization'] = `Bearer ${proxy.key}`;
        body = {
            model: proxy.customModelName || 'gpt-4o',
            messages: [{ role: 'user', content: promptText }],
            stream: true
        };
    } else {
        const modelName = proxy.customModelName || 'gemini-2.5-pro';
        if (!baseUrl.includes(':streamGenerateContent')) {
            url = `${baseUrl}/v1beta/models/${modelName}:streamGenerateContent?alt=sse`;
        } else {
            url = baseUrl;
        }
        headers['x-goog-api-key'] = proxy.key;
        body = {
            contents: [{ role: 'user', parts: [{ text: promptText }] }]
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`Proxy API Error: ${response.status} ${response.statusText}`);
    }

    return await readSSEStream(response, format, onUpdate);
}

async function readSSEStream(response: Response, format: 'openai' | 'gemini', onUpdate?: (chunk: string) => void): Promise<string> {
    if (!response.body) throw new Error("No response body from stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(dataStr);
                    let chunk = "";
                    if (format === 'openai') {
                        chunk = data.choices?.[0]?.delta?.content || "";
                    } else {
                        chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    }
                    if (chunk) {
                        fullText += chunk;
                        if (onUpdate) onUpdate(chunk);
                    }
                } catch (e) {
                    // Ignore parsing errors for incomplete chunks or keepalives
                }
            }
        }
    }
    return fullText.trim();
}