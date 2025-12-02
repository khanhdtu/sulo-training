# Conversation System - Hệ Thống Chat với OpenAI

## Tổng Quan

Hệ thống conversation cho phép:
1. **Essay Review**: Tự động tạo conversation khi user submit bài tự luận để review và giải thích
2. **Free Chat**: User có thể chat bất cứ lúc nào về bất cứ chủ đề
3. **Configurable**: Có thể config response format và system prompt cho từng loại conversation

## Database Schema

### ConversationConfig
- Lưu các config cho conversation (system prompt, response format)
- Có thể set default config
- Metadata để lưu thêm thông tin (model, temperature, etc.)

### Conversation
- Mỗi conversation có thể link với submission (essay_review) hoặc standalone (free_chat)
- Có status: active/completed/archived
- Link với config để dùng system prompt và response format

### Message
- Lưu tất cả messages trong conversation
- Có role: user/assistant/system
- Có metadata để lưu thông tin từ OpenAI (tokens, model, etc.)

## API Endpoints

### Conversations

#### `POST /api/conversations`
Tạo conversation mới

**Body:**
```json
{
  "type": "essay_review" | "free_chat",
  "submissionId": number (optional, for essay_review),
  "configId": number (optional, uses default if not provided)
}
```

#### `GET /api/conversations`
Lấy danh sách conversations của user

**Query params:**
- `type`: "essay_review" | "free_chat" (optional)
- `status`: "active" | "completed" | "archived" (optional)
- `id`: conversation ID (optional, để lấy chi tiết 1 conversation)

#### `POST /api/conversations/[id]/messages`
Gửi message trong conversation

**Body:**
```json
{
  "message": "string",
  "imageUrls": ["url1", "url2"] (optional, for image input)
}
```

#### `GET /api/conversations/[id]/messages`
Lấy tất cả messages trong conversation

### Conversation Configs

#### `POST /api/conversation-configs`
Tạo config mới (admin/teacher only)

**Body:**
```json
{
  "name": "string",
  "systemPrompt": "string",
  "responseFormat": {} (optional),
  "metadata": {} (optional),
  "isDefault": boolean (optional)
}
```

#### `GET /api/conversation-configs`
Lấy tất cả configs

## Workflow

### Essay Review Workflow

1. User submit bài tự luận (upload images)
2. System tự động tạo conversation với type "essay_review"
3. Conversation được link với submission
4. User có thể chat với AI để:
   - Xem feedback về bài làm
   - Hỏi về các lỗi sai
   - Yêu cầu giải thích chi tiết
   - Hỏi đến khi hiểu rõ

### Free Chat Workflow

1. User click "New Chat" trong chat widget
2. System tạo conversation với type "free_chat"
3. User có thể chat về bất cứ chủ đề
4. Conversation được lưu lại để xem lại sau

## UI Component

### ChatWidget
- Component cố định ở góc dưới bên phải
- Có button để mở/đóng chat
- Hiển thị danh sách conversations
- Cho phép tạo conversation mới
- Hiển thị messages và input để gửi message

**Features:**
- Real-time message display
- Loading state khi đang gửi
- Auto-scroll to latest message
- Keyboard shortcut (Enter to send)

## Setup

1. Run seed để tạo default configs:
```bash
npm run db:seed
```

2. Default configs sẽ được tạo:
   - Essay Review Config (default)
   - Free Chat Config

3. Khi submit essay, conversation sẽ tự động được tạo

## Customization

### Tạo Custom Config

```typescript
POST /api/conversation-configs
{
  "name": "Strict Grading",
  "systemPrompt": "You are a strict teacher. Be very critical...",
  "responseFormat": {
    "type": "json_object"
  },
  "isDefault": false
}
```

### Response Format Options

- `{ type: "text" }`: Plain text response (default)
- `{ type: "json_object" }`: JSON response (requires model support)

## Notes

- Tất cả conversations được lưu lại để user có thể xem lại
- System messages không hiển thị trong UI (chỉ dùng cho OpenAI)
- Conversations có thể được archive hoặc completed
- Metadata trong messages lưu thông tin từ OpenAI (tokens, model, etc.)

