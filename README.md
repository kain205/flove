# 💕 F-Connect

> Ứng dụng hẹn hò dành riêng cho sinh viên FPT

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)
![Capacitor](https://img.shields.io/badge/Capacitor-8.0-119EFF?logo=capacitor)

## 📖 Giới thiệu

**F-Connect** là ứng dụng hẹn hò được thiết kế đặc biệt cho cộng đồng sinh viên FPT. Ứng dụng cung cấp 2 tính năng chính:

- 🧭 **Discovery Mode**: Swipe profiles sinh viên FPT, like hoặc pass, match khi cả hai cùng thích
- 🎭 **Blind Date**: Chat ẩn danh với sinh viên ngẫu nhiên, reveal khi cả hai sẵn sàng

## ✨ Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 💘 Discovery | Swipe left/right để tìm kiếm người phù hợp |
| 🎲 Blind Date | Chat ẩn danh, tạo kết nối chân thực |
| 💬 Messages | Nhắn tin với người đã match |
| 👤 Profile | Quản lý thông tin cá nhân |
| 🌐 Đa ngôn ngữ | Hỗ trợ Tiếng Việt và English |
| 📱 Cross-platform | Web + Android (Capacitor) |

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Animation**: Framer Motion
- **State Management**: TanStack Query
- **Routing**: React Router v6
- **i18n**: i18next (Tiếng Việt, English)
- **Mobile**: Capacitor (Android)
- **Build Tool**: Vite

## 📁 Cấu trúc thư mục

```
F-connect/
├── src/
│   ├── components/      # Components dùng chung (UI, Navbar, etc.)
│   ├── features/        # Các tính năng chính
│   │   ├── auth/        # Đăng nhập, đăng ký
│   │   ├── dating/      # Discovery mode (swipe cards)
│   │   ├── blind-date/  # Blind date (chat ẩn danh)
│   │   └── messages/    # Tin nhắn
│   ├── hooks/           # Custom React hooks
│   ├── i18n/            # Đa ngôn ngữ (vi, en)
│   ├── lib/             # Utilities
│   ├── pages/           # Các trang chính
│   ├── services/        # API services
│   ├── shared/          # Layouts dùng chung
│   └── types/           # TypeScript types
├── android/             # Android project (Capacitor)
├── public/              # Static assets
└── ...config files
```

---

## 🚀 Hướng dẫn chạy Demo

### Yêu cầu hệ thống

- **Node.js** >= 18.x ([Tải tại đây](https://nodejs.org/))
- **npm** >= 9.x (đi kèm Node.js)
- **Git** ([Tải tại đây](https://git-scm.com/))

### Bước 1: Clone repository

```bash
git clone https://github.com/your-username/F-connect.git
cd F-connect
```

### Bước 2: Cài đặt dependencies

```bash
npm install
```

> ⏱️ Quá trình này có thể mất 1-2 phút tùy tốc độ mạng

### Bước 3: Chạy development server

```bash
npm run dev
```

### Bước 4: Mở trình duyệt

Truy cập địa chỉ hiển thị trong terminal (thường là):

```
http://localhost:8080
```

🎉 **Xong!** Bạn đã có thể trải nghiệm F-Connect trên web.

---

## 📱 Chạy trên Android (Tuỳ chọn)

### Yêu cầu thêm

- **Android Studio** ([Tải tại đây](https://developer.android.com/studio))
- **JDK** >= 17

### Các bước thực hiện

```bash
# 1. Build web app
npm run build

# 2. Sync với Capacitor
npx cap sync android

# 3. Mở Android Studio
npx cap open android
```

Trong Android Studio:
1. Chờ Gradle sync hoàn tất
2. Kết nối điện thoại Android hoặc tạo Emulator
3. Nhấn **Run** (▶️) để cài đặt và chạy app

---

## 📜 Scripts có sẵn

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy development server |
| `npm run build` | Build production |
| `npm run build:dev` | Build development mode |
| `npm run preview` | Preview bản build |
| `npm run lint` | Kiểm tra lỗi ESLint |

---

## 🤝 Hướng dẫn đóng góp

Chúng tôi rất hoan nghênh mọi đóng góp từ cộng đồng! 

### Quy trình đóng góp

#### 1. Fork repository

Nhấn nút **Fork** ở góc trên bên phải của trang GitHub.

#### 2. Clone fork về máy

```bash
git clone https://github.com/YOUR_USERNAME/F-connect.git
cd F-connect
```

#### 3. Tạo branch mới

```bash
git checkout -b feature/ten-tinh-nang
```

**Quy tắc đặt tên branch:**
- `feature/...` - Thêm tính năng mới
- `fix/...` - Sửa lỗi
- `docs/...` - Cập nhật tài liệu
- `refactor/...` - Refactor code

#### 4. Thực hiện thay đổi

- Đảm bảo không có lỗi ESLint: `npm run lint`
- Test kỹ trước khi commit

#### 5. Commit changes

```bash
git add .
git commit -m "feat: mô tả ngắn gọn thay đổi"
```

**Quy tắc commit message:**
- `feat:` - Thêm tính năng mới
- `fix:` - Sửa lỗi
- `docs:` - Thay đổi tài liệu
- `style:` - Thay đổi format, không ảnh hưởng code
- `refactor:` - Refactor code
- `test:` - Thêm test
- `chore:` - Thay đổi build, config

#### 6. Push lên GitHub

```bash
git push origin feature/ten-tinh-nang
```

#### 7. Tạo Pull Request

1. Vào repository gốc trên GitHub
2. Nhấn **"Compare & pull request"**
3. Điền mô tả chi tiết về thay đổi
4. Nhấn **"Create pull request"**

---

### Coding Conventions

#### TypeScript/React

```typescript
// ✅ Đúng: Sử dụng functional components với TypeScript
const MyComponent = ({ title }: { title: string }) => {
  return <h1>{title}</h1>;
};

// ✅ Đúng: Sử dụng interface cho props phức tạp
interface UserCardProps {
  name: string;
  age: number;
  avatar?: string;
}

const UserCard = ({ name, age, avatar }: UserCardProps) => {
  // ...
};
```

#### Tailwind CSS

```tsx
// ✅ Đúng: Sử dụng các class đã định nghĩa trong project
<div className="glass-card shadow-card card-hover">
  <button className="gradient-primary btn-shine cursor-pointer">
    Click me
  </button>
</div>

// ❌ Sai: Không dùng emoji làm icon
<span>🎭</span>

// ✅ Đúng: Sử dụng Lucide icons
import { Eye } from 'lucide-react';
<Eye className="w-5 h-5" />
```

#### File naming

- Components: `PascalCase.tsx` (ví dụ: `UserCard.tsx`)
- Hooks: `use-kebab-case.ts` (ví dụ: `use-mobile.tsx`)
- Utilities: `camelCase.ts` (ví dụ: `utils.ts`)

---

### Báo cáo lỗi (Bug Report)

Nếu phát hiện lỗi, vui lòng tạo Issue với thông tin sau:

1. **Mô tả lỗi**: Lỗi gì xảy ra?
2. **Các bước tái tạo**: Làm sao để gặp lỗi?
3. **Kết quả mong đợi**: Bạn mong đợi điều gì?
4. **Screenshots**: Ảnh chụp màn hình (nếu có)
5. **Môi trường**: Browser, OS, Node version

---

### Đề xuất tính năng (Feature Request)

Có ý tưởng hay? Tạo Issue với label `enhancement` và mô tả:

1. Tính năng bạn muốn thêm là gì?
2. Tại sao tính năng này hữu ích?
3. Bạn có sẵn sàng implement không?

---

## 👥 Đội ngũ phát triển

| Tên | Role | GitHub |
|-----|------|--------|
| Team EXE101 | Developer | [@team](https://github.com/team) |

---

## 📄 License

Dự án này được phát hành dưới giấy phép [MIT License](LICENSE).

---

## 💬 Liên hệ

- 📧 Email: support@f-connect.vn
- 🌐 Website: [f-connect.vn](https://f-connect.vn)
- 📱 Facebook: [F-Connect](https://facebook.com/fconnect)

---

<p align="center">
  Made with ❤️ for FPT Students
</p>
