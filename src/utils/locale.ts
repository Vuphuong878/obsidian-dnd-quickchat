export type LanguageType = 'vi' | 'en';

export const PC_MOODS_MAP: Record<LanguageType, string[]> = {
	vi: ['Bình thường', 'Vui vẻ', 'Hào hứng', 'Nghiêm túc', 'Tự tin', 'Tò mò', 'Lo âu', 'Cảnh giác', 'Buồn bã', 'Tức giận', 'Hoài nghi', 'Sợ hãi'],
	en: ['Neutral', 'Happy', 'Excited', 'Serious', 'Confident', 'Curious', 'Anxious', 'Alert', 'Sad', 'Angry', 'Skeptical', 'Scared']
};

export const DEFAULT_PROMPT_MAP: Record<LanguageType, string> = {
	vi: 'Bạn đang nhập vai là **Nhân vật chính (PC)** trong thế giới D&D.',
	en: 'You are roleplaying as the **Main Character (PC)** in a D&D campaign.'
};

const TRANSLATIONS = {
	sidebar_title: {
		vi: 'Đối thoại nhanh D&D',
		en: 'D&D Quick Chat'
	},
	pc_label: {
		vi: 'PC:',
		en: 'PC:'
	},
	npc_label: {
		vi: 'NPC:',
		en: 'NPC:'
	},
	mood_title: {
		vi: 'TÂM TRẠNG PC:',
		en: 'PC MOOD:'
	},
	empty_chat: {
		vi: 'Hội thoại trống. Hãy bắt đầu nhập lời nói của NPC phía dưới để kích hoạt AI nhập vai nhân vật của bạn.',
		en: 'Chat history is empty. Start by typing an NPC line below to trigger the AI to roleplay your PC.'
	},
	pc_suggest_label: {
		vi: 'HÀNH ĐỘNG / GỢI Ý CHO PC (TÙY CHỌN):',
		en: 'ACTION / SUGGESTION FOR PC (OPTIONAL):'
	},
	pc_suggest_placeholder: {
		vi: 'Gợi ý cho PC (VD: Đồng ý nhưng miễn cưỡng...)',
		en: 'Suggestion for PC (e.g. Agree but reluctantly...)'
	},
	checkbox_proactive: {
		vi: ' Chủ động',
		en: ' Proactive'
	},
	checkbox_nsfw: {
		vi: ' No censor',
		en: ' No censor'
	},
	checkbox_check_dm: {
		vi: ' Xin check DM',
		en: ' Request DM check'
	},
	checkbox_dialogue: {
		vi: ' Lời thoại',
		en: ' Dialogue'
	},
	checkbox_action: {
		vi: ' Hành động',
		en: ' Actions'
	},
	checkbox_thought: {
		vi: ' Suy nghĩ',
		en: ' Thoughts'
	},
	btn_add_pc: {
		vi: 'Thêm tin nhắn PC',
		en: 'Add PC message'
	},
	btn_suggest: {
		vi: 'Gợi ý hành động',
		en: 'Suggest action'
	},
	btn_choose_one: {
		vi: 'CHỌN ÍT NHẤT 1 PHẦN CẦN TẠO',
		en: 'CHOOSE AT LEAST 1 PART TO GENERATE'
	},
	npc_speak_label: {
		vi: 'LỜI THOẠI / HÀNH ĐỘNG CỦA NPC:',
		en: 'NPC DIALOGUE / ACTIONS:'
	},
	npc_speak_placeholder: {
		vi: 'Nhập lời thoại/hành động của NPC tại đây...',
		en: 'Type NPC dialogue/action here...'
	},
	btn_send_npc: {
		vi: 'Gửi hành động NPCs',
		en: 'Send NPC actions'
	},
	ai_thinking: {
		vi: 'AI ĐANG SUY NGHĨ...',
		en: 'AI IS THINKING...'
	},
	notice_input_pc: {
		vi: 'Vui lòng nhập nội dung cho PC ở ô HÀNH ĐỘNG / GỢI Ý CHO PC!',
		en: 'Please enter content for PC in the suggestion box!'
	},
	notice_input_npc: {
		vi: 'Vui lòng nhập nội dung cho NPC ở ô LỜI THOẠI / HÀNH ĐỘNG CỦA NPC!',
		en: 'Please enter NPC dialogue/actions first!'
	},
	notice_ai_error: {
		vi: 'Gặp lỗi khi tạo lời thoại từ Gemini. Vui lòng kiểm tra lại cấu hình API key trong phần Settings.',
		en: 'Error generating response from Gemini. Please check API key in Settings.'
	},
	notice_summary_empty: {
		vi: 'Lịch sử đối thoại đang trống, không thể tóm tắt!',
		en: 'Conversation history is empty, cannot summarize!'
	},
	notice_summary_no_file: {
		vi: 'Không có file nhật ký nào đang mở để lưu tóm tắt!',
		en: 'No active diary note open to save summary!'
	},
	notice_summary_doing: {
		vi: 'Đang tóm tắt phiên đối thoại...',
		en: 'Summarizing conversation...'
	},
	notice_summary_success: {
		vi: 'Đã chèn tóm tắt đối thoại vào cuối note hiện tại.',
		en: 'Inserted conversation summary at the end of the current note.'
	},
	notice_summary_error: {
		vi: 'Lỗi tóm tắt đối thoại: ',
		en: 'Error summarizing conversation: '
	},
	settings_title: {
		vi: 'Cài đặt Đối thoại Nhập vai D&D AI',
		en: 'D&D AI Roleplay Chat Settings'
	},
	settings_api_title: {
		vi: 'Cấu hình Gemini API Keys',
		en: 'Gemini API Keys Configuration'
	},
	settings_api_desc: {
		vi: 'Hệ thống luân phiên (Fallback): Tự động luân chuyển model và các khóa API khi hết Quota.',
		en: 'Fallback System: Automatically switch models and API keys when quota is exhausted.'
	},
	settings_add_key: {
		vi: '+ Thêm API Key',
		en: '+ Add API Key'
	},
	settings_delete: {
		vi: 'Xóa',
		en: 'Delete'
	},
	settings_limits_title: {
		vi: 'Giới hạn Lịch sử & Hội thoại',
		en: 'History & Chat Limits'
	},
	settings_limits_desc: {
		vi: 'Cấu hình giới hạn lưu trữ và khả năng đọc hiểu ngữ cảnh của AI.',
		en: 'Configure storage limits and context window for AI reading.'
	},
	settings_limit_display: {
		vi: 'Số lượng tin hiển thị',
		en: 'Max Display Messages'
	},
	settings_limit_display_desc: {
		vi: 'Số lượng tin tối đa lưu giữ và hiển thị trong khung chat sidebar (Giới hạn: 10 - 100).',
		en: 'Max messages stored and displayed in sidebar chat (Range: 10 - 100).'
	},
	settings_limit_sent: {
		vi: 'Số lượng tin gửi đi cho AI',
		en: 'Max Context Messages Sent'
	},
	settings_limit_sent_desc: {
		vi: 'Số lượng tin nhắn gần nhất gửi cho AI làm ngữ cảnh (Giới hạn: 5 - 100).',
		en: 'Number of recent messages sent to AI as context (Range: 5 - 100).'
	},
	settings_default_pc: {
		vi: 'Note Nhân Vật PC Mặc định',
		en: 'Default PC Character Note'
	},
	settings_default_pc_desc: {
		vi: 'Tên Note chứa mô tả nhân vật của bạn (không ghi phần mở rộng .md).',
		en: 'Note name containing character details (exclude .md extension).'
	},
	settings_proxy_title: {
		vi: 'Cài đặt Proxy Tùy chỉnh (Custom Reverse Proxy)',
		en: 'Custom Reverse Proxy Settings'
	},
	settings_proxy_enable: {
		vi: 'Bật Custom Proxy Toàn Cục',
		en: 'Enable Global Custom Proxy'
	},
	settings_proxy_enable_desc: {
		vi: 'Khi bật, mọi yêu cầu AI sẽ được chuyển hướng qua các Proxy cấu hình bên dưới thay vì dùng API Key mặc định.',
		en: 'When enabled, all AI requests are routed through custom proxies instead of default API keys.'
	},
	settings_status_title: {
		vi: 'Bảng trạng thái Model & Quota API (Live)',
		en: 'Live Model Status & Quota Dashboard'
	},
	settings_status_reset: {
		vi: 'Đặt lại Trạng thái',
		en: 'Reset Status'
	},
	settings_status_reset_notice: {
		vi: 'Đã đặt lại trạng thái các model thành Sẵn sàng.',
		en: 'Successfully reset all model statuses to Available.'
	},
	settings_modal_prompt: {
		vi: 'Chỉ thị vai trò (Prompt):',
		en: 'System Persona (Prompt):'
	},
	settings_modal_style: {
		vi: 'Văn phong cá nhân (Style):',
		en: 'Personal Style:'
	},
	settings_modal_rules: {
		vi: 'Quy tắc bổ sung (Rules):',
		en: 'Additional Rules:'
	},
	settings_modal_close: {
		vi: 'Đóng',
		en: 'Close'
	},
	settings_modal_title: {
		vi: 'Cấu hình Prompt & Văn phong',
		en: 'Prompt & Style Config'
	},
	language_label: {
		vi: 'Ngôn ngữ hệ thống',
		en: 'System Language'
	},
	language_desc: {
		vi: 'Lựa chọn ngôn ngữ hiển thị giao diện và định dạng ngôn ngữ phản hồi cho AI.',
		en: 'Select display language and AI output generation language.'
	}
};

export function t(key: keyof typeof TRANSLATIONS, lang: LanguageType = 'vi'): string {
	const entry = TRANSLATIONS[key];
	if (!entry) return String(key);
	return entry[lang] || entry['vi'];
}
