import { requestUrl } from 'obsidian';
import MyPlugin from './main';

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
}

export async function generateAiRoleplay(
    plugin: MyPlugin,
    context: RoleplayContext
): Promise<string> {
    // Định dạng lịch sử trò chuyện
    const formattedHistory = context.chatHistory.map(msg => {
        const name = msg.sender === 'player' ? context.pcName : (msg.npcName || 'NPC');
        return `${name}: ${msg.text}`;
    }).join('\n');

    let systemInstruction = `Bạn đang nhập vai là **Nhân vật chính (PC)** trong thế giới D&D.

**BỐI CẢNH THẾ GIỚI & THÔNG TIN THAM KHẢO:**
${context.worldInfo}

**KHUNG CẢNH HIỆN TẠI (NHẬT KÝ PHIÊU LƯU):**
${context.sceneContext}

**THÔNG TIN NHÂN VẬT CỦA BẠN:**
- **Tên:** ${context.pcName}
${context.pcInfo}
- **TÂM TRẠNG HIỆN TẠI:** ${context.pcMood}

**ĐỐI TƯỢNG TƯƠNG TÁC (NPC/MÔI TRƯỜNG):**
- **Tên npc:** ${context.npcName}
${context.npcInfo}

**LỊCH SỬ ĐỐI THOẠI:**
${formattedHistory}

**CHỈ THỊ HÀNH ĐỘNG TỪ NGƯỜI CHƠI:**
${context.pcSuggestion}

**NHIỆM VỤ CỦA BẠN:**
Bạn đang **chủ động** thực hiện một hành động hoặc nói một câu hướng tới **${context.npcName}**, dựa trên chỉ thị ở trên.

**BỘ LỌC VĂN PHONG (ANTI-CHEESINESS):**
1.  **THỰC TẾ:** Nếu chỉ thị là một hành động đơn giản (VD: "Mua táo", "Hỏi đường", "Tấn công"), hãy thực hiện nó một cách trực diện, nhanh gọn. Đừng thêm thắt các mô tả nội tâm phức tạp hay cử chỉ thừa thãi "làm màu".
2.  **SUY NGHĨ CÓ ĐIỀU KIỆN:** Chỉ viết dòng "Suy nghĩ" nếu hành động đó đi ngược lại với cảm xúc thật, hoặc cần tính toán kỹ lưỡng. Nếu không, hãy bỏ qua.

**QUY TẮC VĂN PHONG "PHI AI":**
- **Show, Don't Tell (Diễn đạt qua hành động):** Đừng viết "Anh ấy cảm thấy buồn". Hãy viết "Anh ấy nhìn chằm chằm vào ly cà phê đã nguội ngắt, ngón tay gõ nhịp vô định lên mặt bàn".
- **Ngôn ngữ đời thường:** Sử dụng các từ ngữ gần gũi, đôi khi là khẩu ngữ hoặc câu tỉnh lược. Tránh các từ ngữ quá trau chuốt, hào nhoáng hoặc các cấu trúc câu phức tạp kiểu lý thuyết.
- **Tính bất toàn:** Con người không luôn trả lời logic hoặc đầy đủ. Hãy cho phép nhân vật có những lúc ngập ngừng (ừm, à...), nói lảng tránh, hoặc trả lời bằng một câu hỏi khác khi bị dồn vào thế bí.
- **Phản ứng phi ngôn ngữ:** Lồng ghép các cử chỉ nhỏ (nhíu mày, chỉnh cổ áo, hít một hơi sâu) xen kẽ vào lời thoại để tạo nhịp điệu.
- **Tránh cấu trúc lặp lại:** Tuyệt đối không bắt đầu mọi câu thoại bằng cùng một kiểu mô tả hành động. Hãy thay đổi độ dài ngắn của câu để tạo cảm giác tự nhiên.
- **Cấm tuyệt đối các cụm từ kiểu AI:** Không sử dụng các từ như "Với tư cách là...", "Tôi hiểu cảm xúc của bạn...", hoặc các câu tổng kết bài học đạo đức cuối đoạn chat.

**YÊU CẦU ĐỊNH DẠNG (BẮT BUỘC TUÂN THỦ):**
1.  **Lời nói (Bắt buộc nếu là hội thoại):** Để trong dấu ngoặc kép "...".
2.  **Hành động (Bắt buộc):** Ngôi thứ ba, dùng tên nhân vật ${context.pcName}.
3.  **Suy nghĩ (Tùy chọn):** Ngôi thứ nhất, in nghiêng *...*. (Chỉ dùng khi cần thiết).
4.  **TÁCH DÒNG:** Mỗi thành phần một dòng.

**RÀO CẢN BỐI CẢNH:**
-   **KHÔNG TỰ Ý TẢ CẢNH:** Không được tự bịa ra kết quả của hành động (VD: không viết "Tôi tìm thấy kho báu" khi chưa có thông báo từ DM). Chỉ mô tả nỗ lực hành động.
-   **HÀNH ĐỘNG CỤ THỂ:** Thực hiện chính xác chỉ thị.`;

    if (context.isProactiveMode) {
        systemInstruction += `\n\n**CHẾ ĐỘ CHỦ ĐỘNG**: Hãy tự tạo chuyển động hoặc quan sát môi trường để dẫn dắt câu chuyện tiến lên, không thụ động đợi câu hỏi. Không dùng thuật ngữ game (Insight, Roll...)`;
    }

    if (context.isNsfwMode) {
        systemInstruction += `\n\n**KHÔNG NÓI GIẢM NÓI TRÁNH:** Tuyệt đối cấm sử dụng từ ngữ ẩn dụ, nói giảm nói tránh hay bất kỳ hình thức nào nhằm làm nhẹ đi tính chất dâm đãng của hành động cùng lời nói của PC.
        
        **SỬ DỤNG NGÔN NGỮ TỰ NHIÊN:** Bạn được toàn quyền sử dụng dùng ngôn ngữ **trần trụi, và trực diện nhất** để mô tả các bộ phận sinh dục và các hành vi tình dục của PC hướng đến NPC. Ngôn ngữ này phải được dùng một cách tự nhiên phù hợp với bối cảnh.

        **TẬP TRUNG VÀO CẢM GIÁC THỂ XÁC:** Đừng chỉ mô tả hành động. Hãy đi sâu vào chi tiết cụ thể của **cảm giác thể xác** mà PC lúc đó cảm nhận được: sự trơn trượt của dịch nhờn, độ nóng của da thịt chạm vào nhau, mùi hương của cơ thể, những âm thanh bản thân PC hay NPC phát ra (tiếng rên rỉ, tiếng da thịt va chạm, tiếng mút mát chùn chụt...), và những suy nghĩ nhục dục đen tối nhất trong tâm trí nhân vật.

        **CHI TIẾT HÀNH VI:** Mô tả chi tiết kỹ thuật của các hành vi. Ví dụ khi hôn, hãy tả rõ lưỡi di chuyển ra sao, có mút lưỡi hay trao đổi nước bọt không. Khi giao hợp, hãy tả rõ sự ra vào, độ sâu, cảm giác bên trong.`;
    }

    systemInstruction += `\n\nHãy thực hiện hành động của ${context.pcName} ngay bây giờ.`;

    const bodyContents = [
        {
            role: 'user',
            parts: [{ text: systemInstruction }]
        }
    ];

    return fetchWithFallback(plugin, bodyContents);
}

export async function generateChatSummary(
    plugin: MyPlugin,
    chatHistory: { sender: 'player' | 'npc', text: string, npcName?: string }[]
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

    return fetchWithFallback(plugin, bodyContents);
}

async function fetchWithFallback(plugin: MyPlugin, bodyContents: any): Promise<string> {
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
                const result = await tryCallApi(key, model, bodyContents);
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
                const result = await tryCallApi(key, model, bodyContents);
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

async function tryCallApi(apiKey: string, modelName: string, bodyContents: any): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await requestUrl({
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contents: bodyContents })
    });

    const data = response.json;
    if (data && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("Không nhận diện được cấu trúc phản hồi từ API Gemini.");
}