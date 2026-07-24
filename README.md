# D&D AI Quick Chat Roleplay (Obsidian Community Plugin)

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

## English

A smart Obsidian plugin designed for D&D/TTRPG players and DMs to quickly generate character dialogue, actions, and inner thoughts using Gemini AI models. By tapping into your local vault's character sheets, NPC notes, and world lore, this plugin acts as a co-DM to draft immersive, contextual, and realistic roleplay responses.

### Key Features
- **Dynamic Context Extraction**: Automatically formats selected PC/NPC sheets and pulls related lore notes (using `quickchat: true` or Obsidian `[[WikiLinks]]`) as AI context.
- **Storyteller Suite Integration**: Detects character files using `entityType: character`, `type: character`, or notes inside the `/Characters/` folder. Non-selected characters marked with `quickchat: true` are sent to the AI as supplementary NPCs.
- **Granular Controls**: Select mood chips (Neutral, Happy, Alert, etc.), enable **Proactive Mode** (letting the character take actions), or toggle **No Censor** (mature content).
- **Format Filtering**: Choose to output only Speech, Actions, or Thoughts. The AI dynamically structures responses accordingly.
- **Bilingual Interface**: Seamlessly switch between Vietnamese and English for both the plugin UI and the generated AI responses.
- **DM Check Requests**: Automatically requests appropriate D&D 5e skill checks (e.g. `> Requesting a Perception check to examine the room.`).
- **Bento Grid Settings Tab**: Sleek, modern configuration cards featuring a dynamic multi-key manager, active model quota verification, and history size limits.
- **Mobile Responsive Design**: Clean full-width layouts and stacked controls optimized for smartphone touchpoints and narrow sidebar panes.

### Installation
1. Search for **D&D AI Quick Chat Roleplay** in Obsidian's Community Plugins directory.
2. Install and enable the plugin.
3. Open the plugin settings and add at least one Gemini API Key.

### Usage
- Open the Quick Chat sidebar.
- Select your active **PC** and target **NPC** from the dropdown selectors.
- Set the current **Mood** and optionally type a brief suggestion or action hook.
- Tick your desired settings (e.g. Proactive, No Censor, Request DM Check) and format filters (Dialogue, Actions, Thoughts).
- Press **Suggest action** to stream roleplay prompts from Gemini, or type an NPC line and press **Send NPC action** to continue the conversation.

---

## Tiếng Việt

Một plugin Obsidian thông minh được thiết kế cho người chơi và DM D&D/TTRPG để nhanh chóng tạo lời thoại, hành động và suy nghĩ nội tâm của nhân vật bằng mô hình AI Gemini. Bằng cách khai thác thông tin từ hồ sơ nhân vật, ghi chú NPC và bối cảnh thế giới trong Vault của bạn, plugin hoạt động như một Co-DM hỗ trợ bạn nhập vai tự nhiên nhất.

### Tính năng chính
- **Chắt lọc Ngữ cảnh Thông minh**: Tự động định dạng hồ sơ PC/NPC được chọn và quét các ghi chú bối cảnh liên quan (thông qua nhãn `quickchat: true` hoặc liên kết `[[WikiLinks]]`).
- **Tích hợp Storyteller Suite**: Tự động nhận diện nhân vật qua `entityType: character`, `type: character` hoặc thư mục `/Characters/`. Các nhân vật phụ được gắn `quickchat: true` sẽ gửi sang AI dưới dạng NPC phụ trợ.
- **Điều khiển Chi tiết**: Chọn nhanh tâm trạng (Bình thường, Vui vẻ, Cảnh giác...), bật chế độ **Chủ động** (tự tạo hành động dẫn dắt), hoặc bật chế độ **No Censor** (không kiểm duyệt nội dung 18+).
- **Bộ lọc Định dạng**: Tùy chọn chỉ tạo Lời thoại, Hành động hoặc Suy nghĩ. AI sẽ tự động phân dòng định dạng chính xác.
- **Hỗ trợ Song ngữ**: Chuyển đổi ngôn ngữ Tiếng Việt và Tiếng Anh linh hoạt cho cả giao diện plugin lẫn ngôn ngữ phản hồi của AI.
- **Xin check DM**: Chủ động đề xuất xúc sắc kiểm tra kỹ năng D&D 5e tương ứng với hành động (ví dụ: `> Xin một cái check Perception để quan sát.`).
- **Cài đặt dạng Bento Grid**: Giao diện cài đặt dạng thẻ bento hiện đại, hỗ trợ quản lý danh sách nhiều API Key, theo dõi trạng thái hạn mức model khả dụng, và cài đặt giới hạn lịch sử hội thoại.
- **Tối ưu hóa Giao diện Di động**: Thiết kế tự động căn lề và xếp chồng dọc, tối ưu hóa kích thước nút bấm trên màn hình điện thoại di động và thanh bên sidebar hẹp.

### Cài đặt
1. Tìm kiếm **D&D AI Quick Chat Roleplay** trong mục Community Plugins của Obsidian.
2. Cài đặt và bật plugin.
3. Vào phần cài đặt plugin và thêm ít nhất một khóa API Gemini.

### Cách sử dụng
- Mở sidebar **Đối thoại nhanh D&D**.
- Lựa chọn **PC** và **NPC** tương tác từ các dropdown.
- Chọn **Tâm trạng** của nhân vật và nhập gợi ý hành động mong muốn (tùy chọn).
- Tích chọn các chế độ (Chủ động, No Censor, Xin check DM) và thành phần muốn tạo (Lời thoại, Hành động, Suy nghĩ).
- Nhấp **Gợi ý hành động** để nhận văn bản nhập vai được stream trực tiếp từ Gemini, hoặc nhập lời nói của NPC và nhấp **Gửi hành động NPCs** để tiếp tục trò chuyện.

---

## License

This project is licensed under the [MIT License](LICENSE).
