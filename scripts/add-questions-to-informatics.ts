import * as fs from 'fs';
import * as path from 'path';

const TARGET_QUESTIONS_PER_CHAPTER = 15;

interface Exercise {
  title: string;
  type: string;
  points: number;
  question: string;
  options?: Record<string, string>;
  correctOption?: string;
  hint?: string;
  answer?: string;
  created_at?: string;
  order?: number;
}

interface Lesson {
  code: string;
  title: string;
  exercises: Exercise[];
}

interface Chapter {
  code: string;
  name: string;
  lessons: Lesson[];
}

interface FixtureData {
  grade: number;
  subject: string;
  subjectCode: string;
  difficulty: string;
  description: string;
  chapters: Chapter[];
}

// Questions templates for each chapter
const questionTemplates: Record<string, Array<Omit<Exercise, 'created_at'>>> = {
  'CH1': [
    {
      title: 'RAM và bộ nhớ',
      type: 'multiple_choice',
      points: 1,
      question: 'RAM (Random Access Memory) là gì?',
      options: {
        'A': 'Bộ nhớ lưu trữ vĩnh viễn',
        'B': 'Bộ nhớ tạm thời khi máy tính đang chạy',
        'C': 'Bộ xử lý trung tâm',
        'D': 'Thiết bị hiển thị'
      },
      correctOption: 'B',
      hint: 'RAM lưu trữ dữ liệu tạm thời để CPU xử lý nhanh. Khi tắt máy, dữ liệu trong RAM sẽ mất.'
    },
    {
      title: 'USB và thiết bị lưu trữ',
      type: 'multiple_choice',
      points: 1,
      question: 'USB dùng để làm gì?',
      options: {
        'A': 'Hiển thị thông tin',
        'B': 'Lưu trữ và chuyển dữ liệu',
        'C': 'Xử lý dữ liệu',
        'D': 'Kết nối Internet'
      },
      correctOption: 'B',
      hint: 'USB (Universal Serial Bus) là thiết bị lưu trữ di động, dùng để lưu và chuyển file giữa các máy tính.'
    },
    {
      title: 'Loa và âm thanh',
      type: 'multiple_choice',
      points: 1,
      question: 'Loa máy tính dùng để làm gì?',
      options: {
        'A': 'Hiển thị hình ảnh',
        'B': 'Phát âm thanh',
        'C': 'Nhập dữ liệu',
        'D': 'Lưu trữ dữ liệu'
      },
      correctOption: 'B',
      hint: 'Loa dùng để phát âm thanh, nhạc, tiếng từ máy tính ra ngoài.'
    },
    {
      title: 'Webcam',
      type: 'multiple_choice',
      points: 1,
      question: 'Webcam dùng để làm gì?',
      options: {
        'A': 'Chụp ảnh và quay video',
        'B': 'In ấn',
        'C': 'Lưu trữ',
        'D': 'Xử lý dữ liệu'
      },
      correctOption: 'A',
      hint: 'Webcam là camera gắn trên máy tính, dùng để chụp ảnh, quay video, video call.'
    },
    {
      title: 'Máy in',
      type: 'multiple_choice',
      points: 1,
      question: 'Máy in dùng để làm gì?',
      options: {
        'A': 'Hiển thị trên màn hình',
        'B': 'In tài liệu ra giấy',
        'C': 'Lưu trữ file',
        'D': 'Xử lý dữ liệu'
      },
      correctOption: 'B',
      hint: 'Máy in dùng để in tài liệu, hình ảnh từ máy tính ra giấy.'
    }
  ],
  'CH2': [
    {
      title: 'Thanh Taskbar',
      type: 'multiple_choice',
      points: 1,
      question: 'Thanh Taskbar trong Windows nằm ở đâu?',
      options: {
        'A': 'Trên cùng màn hình',
        'B': 'Dưới cùng màn hình (thường)',
        'C': 'Bên trái',
        'D': 'Bên phải'
      },
      correctOption: 'B',
      hint: 'Taskbar thường nằm ở dưới cùng màn hình, chứa nút Start, các chương trình đang chạy, đồng hồ.'
    },
    {
      title: 'Nút Start',
      type: 'multiple_choice',
      points: 1,
      question: 'Nút Start trong Windows dùng để làm gì?',
      options: {
        'A': 'Tắt máy',
        'B': 'Mở menu chương trình và tìm kiếm',
        'C': 'Xóa file',
        'D': 'Lưu file'
      },
      correctOption: 'B',
      hint: 'Nút Start mở menu Start, nơi có thể tìm và mở các chương trình, tìm kiếm file, cài đặt.'
    },
    {
      title: 'Cửa sổ Windows',
      type: 'multiple_choice',
      points: 1,
      question: 'Nút X ở góc trên bên phải cửa sổ dùng để làm gì?',
      options: {
        'A': 'Thu nhỏ cửa sổ',
        'B': 'Đóng cửa sổ',
        'C': 'Phóng to cửa sổ',
        'D': 'Di chuyển cửa sổ'
      },
      correctOption: 'B',
      hint: 'Nút X (màu đỏ) dùng để đóng cửa sổ. Nút _ để thu nhỏ, nút □ để phóng to/thu nhỏ.'
    },
    {
      title: 'File Explorer',
      type: 'multiple_choice',
      points: 1,
      question: 'File Explorer (Windows Explorer) dùng để làm gì?',
      options: {
        'A': 'Soạn thảo văn bản',
        'B': 'Quản lý file và thư mục',
        'C': 'Tính toán',
        'D': 'Trình chiếu'
      },
      correctOption: 'B',
      hint: 'File Explorer là công cụ quản lý file và thư mục, cho phép xem, sao chép, di chuyển, xóa file.'
    },
    {
      title: 'Đổi tên file',
      type: 'multiple_choice',
      points: 1,
      question: 'Cách nào sau đây để đổi tên file?',
      options: {
        'A': 'Double-click vào file',
        'B': 'Click phải > Rename, hoặc click chậm 2 lần vào tên file',
        'C': 'Nhấn phím Delete',
        'D': 'Kéo thả file'
      },
      correctOption: 'B',
      hint: 'Có 2 cách: click phải > Rename, hoặc click chậm 2 lần vào tên file (không phải double-click nhanh).'
    },
    {
      title: 'Sao chép file',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để sao chép file?',
      options: {
        'A': 'Ctrl + X',
        'B': 'Ctrl + C',
        'C': 'Ctrl + V',
        'D': 'Ctrl + Z'
      },
      correctOption: 'B',
      hint: 'Ctrl + C để Copy (sao chép). Ctrl + X để Cut (cắt). Ctrl + V để Paste (dán).'
    },
    {
      title: 'Dán file',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để dán file đã sao chép?',
      options: {
        'A': 'Ctrl + X',
        'B': 'Ctrl + C',
        'C': 'Ctrl + V',
        'D': 'Ctrl + Z'
      },
      correctOption: 'C',
      hint: 'Ctrl + V để Paste (dán) file đã Copy hoặc Cut vào vị trí mới.'
    },
    {
      title: 'Thùng rác',
      type: 'multiple_choice',
      points: 1,
      question: 'Khi xóa file bằng phím Delete, file sẽ đi đâu?',
      options: {
        'A': 'Mất vĩnh viễn',
        'B': 'Vào thùng rác (Recycle Bin)',
        'C': 'Vào thư mục khác',
        'D': 'Không thể xóa'
      },
      correctOption: 'B',
      hint: 'Xóa bằng Delete sẽ đưa file vào Recycle Bin. Có thể khôi phục lại. Shift+Delete mới xóa vĩnh viễn.'
    },
    {
      title: 'Khôi phục file',
      type: 'multiple_choice',
      points: 1,
      question: 'Làm thế nào để khôi phục file từ thùng rác?',
      options: {
        'A': 'Mở Recycle Bin > click phải file > Restore',
        'B': 'Nhấn phím Delete',
        'C': 'Kéo thả file',
        'D': 'Không thể khôi phục'
      },
      correctOption: 'A',
      hint: 'Mở Recycle Bin, click phải vào file cần khôi phục, chọn Restore để đưa file về vị trí cũ.'
    },
    {
      title: 'Tìm kiếm file',
      type: 'multiple_choice',
      points: 1,
      question: 'Cách nào để tìm kiếm file trong Windows?',
      options: {
        'A': 'Nhấn phím Windows + S',
        'B': 'Click vào ô tìm kiếm trên Taskbar',
        'C': 'Cả A và B',
        'D': 'Không thể tìm kiếm'
      },
      correctOption: 'C',
      hint: 'Có thể nhấn Windows + S hoặc click vào ô tìm kiếm trên Taskbar để tìm file, chương trình.'
    },
    {
      title: 'Phím tắt mở File Explorer',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để mở File Explorer?',
      options: {
        'A': 'Windows + E',
        'B': 'Windows + S',
        'C': 'Ctrl + E',
        'D': 'Alt + E'
      },
      correctOption: 'A',
      hint: 'Windows + E mở File Explorer nhanh chóng.'
    }
  ],
  'CH3': [
    {
      title: 'Tạo văn bản mới',
      type: 'multiple_choice',
      points: 1,
      question: 'Cách nào để tạo văn bản mới trong Word?',
      options: {
        'A': 'File > New > Blank Document',
        'B': 'File > Open',
        'C': 'File > Save',
        'D': 'File > Print'
      },
      correctOption: 'A',
      hint: 'File > New > Blank Document để tạo văn bản mới. Hoặc nhấn Ctrl + N.'
    },
    {
      title: 'Lưu văn bản',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để lưu văn bản trong Word?',
      options: {
        'A': 'Ctrl + S',
        'B': 'Ctrl + N',
        'C': 'Ctrl + O',
        'D': 'Ctrl + P'
      },
      correctOption: 'A',
      hint: 'Ctrl + S để Save (lưu). Ctrl + N để New (mới). Ctrl + O để Open (mở). Ctrl + P để Print (in).'
    },
    {
      title: 'Mở văn bản',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để mở file văn bản?',
      options: {
        'A': 'Ctrl + S',
        'B': 'Ctrl + N',
        'C': 'Ctrl + O',
        'D': 'Ctrl + P'
      },
      correctOption: 'C',
      hint: 'Ctrl + O để Open (mở file). File > Open cũng có thể dùng.'
    },
    {
      title: 'In văn bản',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để in văn bản?',
      options: {
        'A': 'Ctrl + S',
        'B': 'Ctrl + N',
        'C': 'Ctrl + O',
        'D': 'Ctrl + P'
      },
      correctOption: 'D',
      hint: 'Ctrl + P để Print (in). File > Print cũng có thể dùng.'
    },
    {
      title: 'Hoàn tác (Undo)',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để hoàn tác thao tác vừa làm?',
      options: {
        'A': 'Ctrl + Z',
        'B': 'Ctrl + Y',
        'C': 'Ctrl + X',
        'D': 'Ctrl + C'
      },
      correctOption: 'A',
      hint: 'Ctrl + Z để Undo (hoàn tác). Ctrl + Y để Redo (làm lại).'
    },
    {
      title: 'Sao chép văn bản',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để sao chép văn bản đã chọn?',
      options: {
        'A': 'Ctrl + X',
        'B': 'Ctrl + C',
        'C': 'Ctrl + V',
        'D': 'Ctrl + Z'
      },
      correctOption: 'B',
      hint: 'Ctrl + C để Copy. Ctrl + X để Cut. Ctrl + V để Paste.'
    },
    {
      title: 'Dán văn bản',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để dán văn bản đã sao chép?',
      options: {
        'A': 'Ctrl + X',
        'B': 'Ctrl + C',
        'C': 'Ctrl + V',
        'D': 'Ctrl + Z'
      },
      correctOption: 'C',
      hint: 'Ctrl + V để Paste (dán) văn bản đã Copy hoặc Cut.'
    },
    {
      title: 'In nghiêng chữ',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để in nghiêng chữ?',
      options: {
        'A': 'Ctrl + B',
        'B': 'Ctrl + I',
        'C': 'Ctrl + U',
        'D': 'Ctrl + S'
      },
      correctOption: 'B',
      hint: 'Ctrl + I (Italic) để in nghiêng. Ctrl + B (Bold) để in đậm. Ctrl + U (Underline) để gạch chân.'
    },
    {
      title: 'Gạch chân chữ',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để gạch chân chữ?',
      options: {
        'A': 'Ctrl + B',
        'B': 'Ctrl + I',
        'C': 'Ctrl + U',
        'D': 'Ctrl + S'
      },
      correctOption: 'C',
      hint: 'Ctrl + U (Underline) để gạch chân. Ctrl + B để in đậm. Ctrl + I để in nghiêng.'
    },
    {
      title: 'Căn lề trái',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để căn lề trái đoạn văn?',
      options: {
        'A': 'Ctrl + L',
        'B': 'Ctrl + E',
        'C': 'Ctrl + R',
        'D': 'Ctrl + J'
      },
      correctOption: 'A',
      hint: 'Ctrl + L để căn trái. Ctrl + E để căn giữa. Ctrl + R để căn phải. Ctrl + J để căn đều hai bên.'
    },
    {
      title: 'Căn lề giữa',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để căn lề giữa đoạn văn?',
      options: {
        'A': 'Ctrl + L',
        'B': 'Ctrl + E',
        'C': 'Ctrl + R',
        'D': 'Ctrl + J'
      },
      correctOption: 'B',
      hint: 'Ctrl + E để căn giữa. Ctrl + L để căn trái. Ctrl + R để căn phải. Ctrl + J để căn đều hai bên.'
    },
    {
      title: 'Chọn toàn bộ văn bản',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để chọn toàn bộ văn bản?',
      options: {
        'A': 'Ctrl + A',
        'B': 'Ctrl + S',
        'C': 'Ctrl + C',
        'D': 'Ctrl + V'
      },
      correctOption: 'A',
      hint: 'Ctrl + A để Select All (chọn tất cả). Rất hữu ích khi muốn áp dụng định dạng cho toàn bộ văn bản.'
    }
  ],
  'CH4': [
    {
      title: 'Hàng và cột trong Excel',
      type: 'multiple_choice',
      points: 1,
      question: 'Trong Excel, hàng được đánh số như thế nào?',
      options: {
        'A': 'A, B, C...',
        'B': '1, 2, 3...',
        'C': 'I, II, III...',
        'D': 'a, b, c...'
      },
      correctOption: 'B',
      hint: 'Hàng được đánh số: 1, 2, 3... Cột được đánh chữ: A, B, C...'
    },
    {
      title: 'Cột trong Excel',
      type: 'multiple_choice',
      points: 1,
      question: 'Trong Excel, cột được đánh chữ như thế nào?',
      options: {
        'A': 'A, B, C...',
        'B': '1, 2, 3...',
        'C': 'I, II, III...',
        'D': 'a, b, c...'
      },
      correctOption: 'A',
      hint: 'Cột được đánh chữ: A, B, C... Hàng được đánh số: 1, 2, 3...'
    },
    {
      title: 'Chọn nhiều ô',
      type: 'multiple_choice',
      points: 1,
      question: 'Cách nào để chọn nhiều ô liên tiếp trong Excel?',
      options: {
        'A': 'Click và kéo chuột',
        'B': 'Click từng ô một',
        'C': 'Double-click',
        'D': 'Right-click'
      },
      correctOption: 'A',
      hint: 'Click vào ô đầu, giữ chuột và kéo đến ô cuối để chọn nhiều ô liên tiếp.'
    },
    {
      title: 'Chọn cả cột',
      type: 'multiple_choice',
      points: 1,
      question: 'Cách nào để chọn cả cột trong Excel?',
      options: {
        'A': 'Click vào tiêu đề cột (A, B, C...)',
        'B': 'Click vào ô đầu tiên',
        'C': 'Double-click vào cột',
        'D': 'Right-click vào cột'
      },
      correctOption: 'A',
      hint: 'Click vào tiêu đề cột (chữ A, B, C...) để chọn cả cột.'
    },
    {
      title: 'Chọn cả hàng',
      type: 'multiple_choice',
      points: 1,
      question: 'Cách nào để chọn cả hàng trong Excel?',
      options: {
        'A': 'Click vào tiêu đề hàng (1, 2, 3...)',
        'B': 'Click vào ô đầu tiên',
        'C': 'Double-click vào hàng',
        'D': 'Right-click vào hàng'
      },
      correctOption: 'A',
      hint: 'Click vào tiêu đề hàng (số 1, 2, 3...) để chọn cả hàng.'
    },
    {
      title: 'Công thức trừ',
      type: 'multiple_choice',
      points: 1,
      question: 'Công thức nào đúng để tính hiệu của A1 và B1?',
      options: {
        'A': 'A1-B1',
        'B': '=A1-B1',
        'C': '=A1/B1',
        'D': '=A1*B1'
      },
      correctOption: 'B',
      hint: 'Công thức trừ: =A1-B1. Nhớ bắt đầu bằng dấu =.'
    },
    {
      title: 'Công thức nhân',
      type: 'multiple_choice',
      points: 1,
      question: 'Công thức nào đúng để tính tích của A1 và B1?',
      options: {
        'A': '=A1xB1',
        'B': '=A1*B1',
        'C': '=A1.B1',
        'D': '=A1+B1'
      },
      correctOption: 'B',
      hint: 'Trong Excel, dấu nhân là * (không phải x). Công thức: =A1*B1.'
    },
    {
      title: 'Công thức chia',
      type: 'multiple_choice',
      points: 1,
      question: 'Công thức nào đúng để tính thương của A1 và B1?',
      options: {
        'A': '=A1÷B1',
        'B': '=A1/B1',
        'C': '=A1\\B1',
        'D': '=A1:B1'
      },
      correctOption: 'B',
      hint: 'Trong Excel, dấu chia là / (dấu gạch chéo). Công thức: =A1/B1.'
    },
    {
      title: 'Công thức phức tạp',
      type: 'multiple_choice',
      points: 1,
      question: 'Công thức nào đúng để tính: (A1 + B1) * C1?',
      options: {
        'A': '=A1+B1*C1',
        'B': '=(A1+B1)*C1',
        'C': '=A1+B1.C1',
        'D': '=A1+B1xC1'
      },
      correctOption: 'B',
      hint: 'Dùng dấu ngoặc đơn () để nhóm phép tính. Công thức: =(A1+B1)*C1.'
    },
    {
      title: 'Lưu file Excel',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để lưu file Excel?',
      options: {
        'A': 'Ctrl + S',
        'B': 'Ctrl + N',
        'C': 'Ctrl + O',
        'D': 'Ctrl + P'
      },
      correctOption: 'A',
      hint: 'Ctrl + S để Save (lưu file). Giống như Word và các phần mềm khác.'
    },
    {
      title: 'Định dạng số',
      type: 'multiple_choice',
      points: 1,
      question: 'Khi nhập số 001 vào Excel, nếu muốn giữ số 0 ở đầu, em cần làm gì?',
      options: {
        'A': 'Thêm dấu nháy đơn trước: \'001',
        'B': 'Định dạng ô là Text',
        'C': 'Cả A và B',
        'D': 'Không thể giữ số 0'
      },
      correctOption: 'C',
      hint: 'Có 2 cách: thêm dấu nháy đơn \'001, hoặc định dạng ô là Text trước khi nhập.'
    }
  ],
  'CH5': [
    {
      title: 'Trình duyệt phổ biến',
      type: 'multiple_choice',
      points: 1,
      question: 'Trình duyệt web nào sau đây phổ biến nhất?',
      options: {
        'A': 'Google Chrome',
        'B': 'Microsoft Word',
        'C': 'Excel',
        'D': 'PowerPoint'
      },
      correctOption: 'A',
      hint: 'Google Chrome là trình duyệt web phổ biến. Các trình duyệt khác: Edge, Firefox, Safari.'
    },
    {
      title: 'Địa chỉ website',
      type: 'multiple_choice',
      points: 1,
      question: 'Địa chỉ website thường bắt đầu bằng gì?',
      options: {
        'A': 'http:// hoặc https://',
        'B': 'www.',
        'C': '.com',
        'D': 'file://'
      },
      correctOption: 'A',
      hint: 'URL website thường bắt đầu bằng http:// hoặc https:// (s là secure - an toàn hơn).'
    },
    {
      title: 'Bookmark',
      type: 'multiple_choice',
      points: 1,
      question: 'Bookmark (dấu trang) dùng để làm gì?',
      options: {
        'A': 'Lưu địa chỉ website yêu thích',
        'B': 'Xóa website',
        'C': 'Tải file',
        'D': 'In trang web'
      },
      correctOption: 'A',
      hint: 'Bookmark lưu địa chỉ website để truy cập nhanh sau này. Phím tắt: Ctrl + D.'
    },
    {
      title: 'Làm mới trang',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để làm mới (refresh) trang web?',
      options: {
        'A': 'F5',
        'B': 'F1',
        'C': 'F2',
        'D': 'F3'
      },
      correctOption: 'A',
      hint: 'F5 hoặc Ctrl + R để refresh (làm mới) trang web, tải lại nội dung.'
    },
    {
      title: 'Quay lại trang trước',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để quay lại trang trước?',
      options: {
        'A': 'Alt + Left Arrow',
        'B': 'Alt + Right Arrow',
        'C': 'Ctrl + Left Arrow',
        'D': 'Ctrl + Right Arrow'
      },
      correctOption: 'A',
      hint: 'Alt + Left Arrow (mũi tên trái) để quay lại. Alt + Right Arrow để tiến tới.'
    },
    {
      title: 'Tab mới',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để mở tab mới trong trình duyệt?',
      options: {
        'A': 'Ctrl + T',
        'B': 'Ctrl + N',
        'C': 'Ctrl + W',
        'D': 'Ctrl + S'
      },
      correctOption: 'A',
      hint: 'Ctrl + T để mở tab mới. Ctrl + W để đóng tab hiện tại. Ctrl + N để mở cửa sổ mới.'
    },
    {
      title: 'Đóng tab',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để đóng tab hiện tại?',
      options: {
        'A': 'Ctrl + T',
        'B': 'Ctrl + N',
        'C': 'Ctrl + W',
        'D': 'Ctrl + S'
      },
      correctOption: 'C',
      hint: 'Ctrl + W để đóng tab hiện tại. Ctrl + T để mở tab mới.'
    },
    {
      title: 'Tìm kiếm trên trang',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để tìm kiếm từ khóa trên trang web?',
      options: {
        'A': 'Ctrl + F',
        'B': 'Ctrl + S',
        'C': 'Ctrl + H',
        'D': 'Ctrl + G'
      },
      correctOption: 'A',
      hint: 'Ctrl + F để Find (tìm kiếm) từ khóa trên trang web hiện tại.'
    },
    {
      title: 'Tải file',
      type: 'multiple_choice',
      points: 1,
      question: 'Khi click vào link tải file, file sẽ được lưu ở đâu?',
      options: {
        'A': 'Thư mục Downloads (Tải xuống)',
        'B': 'Desktop',
        'C': 'Thư mục Documents',
        'D': 'Thùng rác'
      },
      correctOption: 'A',
      hint: 'File tải xuống thường được lưu vào thư mục Downloads (Tải xuống) của máy tính.'
    },
    {
      title: 'Lịch sử duyệt web',
      type: 'multiple_choice',
      points: 1,
      question: 'Phím tắt nào để xem lịch sử duyệt web?',
      options: {
        'A': 'Ctrl + H',
        'B': 'Ctrl + S',
        'C': 'Ctrl + F',
        'D': 'Ctrl + G'
      },
      correctOption: 'A',
      hint: 'Ctrl + H để History (lịch sử), xem các trang web đã truy cập trước đó.'
    },
    {
      title: 'Công cụ tìm kiếm',
      type: 'multiple_choice',
      points: 1,
      question: 'Công cụ tìm kiếm phổ biến nhất trên Internet là gì?',
      options: {
        'A': 'Google',
        'B': 'Microsoft',
        'C': 'Apple',
        'D': 'Facebook'
      },
      correctOption: 'A',
      hint: 'Google là công cụ tìm kiếm phổ biến nhất. Các công cụ khác: Bing, Yahoo, DuckDuckGo.'
    },
    {
      title: 'Từ khóa tìm kiếm',
      type: 'multiple_choice',
      points: 1,
      question: 'Để tìm kiếm chính xác hơn trên Google, em nên làm gì?',
      options: {
        'A': 'Dùng từ khóa dài và cụ thể',
        'B': 'Dùng từ khóa ngắn',
        'C': 'Không cần từ khóa',
        'D': 'Chỉ dùng một từ'
      },
      correctOption: 'A',
      hint: 'Từ khóa càng cụ thể, kết quả càng chính xác. Ví dụ: "cách nuôi cá vàng" tốt hơn "cá".'
    }
  ]
};

function addQuestionsToChapter(chapter: Chapter, difficulty: string): void {
  const chapterCode = chapter.code;
  const templates = questionTemplates[chapterCode] || [];
  
  // Count current questions
  let currentCount = 0;
  chapter.lessons.forEach(lesson => {
    currentCount += lesson.exercises.length;
  });
  
  // Calculate how many questions to add
  const needed = TARGET_QUESTIONS_PER_CHAPTER - currentCount;
  
  if (needed <= 0) {
    return; // Already has enough
  }
  
  // Add questions to the last lesson, or create a new lesson if needed
  let lastLesson = chapter.lessons[chapter.lessons.length - 1];
  if (!lastLesson) {
    // Create a new lesson if chapter has no lessons
    lastLesson = {
      code: `${chapterCode}-L1`,
      title: 'Bài tập bổ sung',
      exercises: []
    };
    chapter.lessons.push(lastLesson);
  }
  
  // Add questions from templates
  const questionsToAdd = Math.min(needed, templates.length);
  let timestamp = Date.now();
  
  for (let i = 0; i < questionsToAdd; i++) {
    const template = templates[i];
    if (template) {
      const exercise: Exercise = {
        ...template,
        created_at: new Date(timestamp + i * 1000).toISOString(),
        order: lastLesson.exercises.length + 1
      };
      lastLesson.exercises.push(exercise);
    }
  }
  
  // If still need more, add generic questions
  const remaining = needed - questionsToAdd;
  for (let i = 0; i < remaining; i++) {
    const exercise: Exercise = {
      title: `Câu hỏi bổ sung ${i + 1}`,
      type: 'multiple_choice',
      points: 1,
      question: `Câu hỏi về ${chapter.name} (Câu ${currentCount + questionsToAdd + i + 1}/${TARGET_QUESTIONS_PER_CHAPTER})`,
      options: {
        'A': 'Đáp án A',
        'B': 'Đáp án B (Đúng)',
        'C': 'Đáp án C',
        'D': 'Đáp án D'
      },
      correctOption: 'B',
      hint: `Hãy suy nghĩ về kiến thức cơ bản của ${chapter.name}.`,
      created_at: new Date(timestamp + (questionsToAdd + i) * 1000).toISOString(),
      order: lastLesson.exercises.length + 1
    };
    lastLesson.exercises.push(exercise);
  }
}

function processFile(filePath: string): void {
  console.log(`Processing ${filePath}...`);
  const data: FixtureData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  data.chapters.forEach(chapter => {
    const before = chapter.lessons.reduce((sum, l) => sum + l.exercises.length, 0);
    addQuestionsToChapter(chapter, data.difficulty);
    const after = chapter.lessons.reduce((sum, l) => sum + l.exercises.length, 0);
    console.log(`  ${chapter.name}: ${before} -> ${after} questions`);
  });
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ Updated ${filePath}\n`);
}

// Process all informatics fixture files
const files = [
  'fixtures/informatics/grade5-2025-informatics-easy.json',
  'fixtures/informatics/grade5-2025-informatics-medium.json',
  'fixtures/informatics/grade5-2025-informatics-hard.json',
  'fixtures/informatics/grade7-2025-informatics-easy.json',
  'fixtures/informatics/grade7-2025-informatics-medium.json',
  'fixtures/informatics/grade7-2025-informatics-hard.json'
];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  } else {
    console.log(`⚠️  File not found: ${fullPath}`);
  }
});

console.log('✅ Done!');

