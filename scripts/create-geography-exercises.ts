import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

interface Exercise {
  uuid: string;
  title: string;
  type: 'multiple_choice' | 'essay';
  points: number;
  question: string;
  options?: Record<string, string>;
  correctOption?: string;
  hint?: string;
  answer?: string;
  created_at: string;
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

interface ExerciseFixture {
  grade: number;
  subject: string;
  subjectCode: string;
  difficulty: string;
  description: string;
  chapters: Chapter[];
}

// Grade 5 Geography exercises - Easy
const grade5EasyExercises: ExerciseFixture = {
  grade: 5,
  subject: "Địa lý",
  subjectCode: "GEO5",
  difficulty: "easy",
  description: "Easy exercises for Grade 5 Geography (Lớp 5 Địa lý) - basic practice",
  chapters: [
    {
      code: "CH1",
      name: "Chương 1: Việt Nam - Đất nước chúng ta",
      lessons: [
        {
          code: "GEO5-CH1-L1",
          title: "Vị trí địa lý Việt Nam",
          exercises: [
            {
              uuid: randomUUID(),
              title: "Vị trí địa lý Việt Nam",
              type: "multiple_choice",
              points: 1,
              question: "Việt Nam nằm ở khu vực nào?",
              options: {
                "A": "Đông Nam Á",
                "B": "Tây Nam Á",
                "C": "Bắc Á",
                "D": "Trung Á"
              },
              correctOption: "A",
              hint: "Việt Nam nằm ở phía đông bán đảo Đông Dương, thuộc khu vực Đông Nam Á.",
              created_at: "2025-01-01T00:00:00.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Diện tích Việt Nam",
              type: "multiple_choice",
              points: 1,
              question: "Diện tích của Việt Nam khoảng bao nhiêu?",
              options: {
                "A": "Khoảng 331.000 km²",
                "B": "Khoảng 500.000 km²",
                "C": "Khoảng 200.000 km²",
                "D": "Khoảng 1.000.000 km²"
              },
              correctOption: "A",
              hint: "Việt Nam có diện tích khoảng 331.212 km².",
              created_at: "2025-01-01T00:00:01.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Tự luận: Vị trí địa lý Việt Nam",
              type: "essay",
              points: 2,
              question: "Em hãy nêu vị trí địa lý của Việt Nam và các nước láng giềng.",
              hint: "Hãy nêu vị trí của Việt Nam trên bản đồ và các nước xung quanh.",
              answer: "Việt Nam nằm ở khu vực Đông Nam Á, phía đông bán đảo Đông Dương. Phía bắc giáp Trung Quốc, phía tây giáp Lào và Campuchia, phía đông và nam giáp biển Đông.",
              created_at: "2025-01-01T00:00:02.000Z"
            }
          ]
        },
        {
          code: "GEO5-CH1-L2",
          title: "Hình dạng lãnh thổ",
          exercises: [
            {
              uuid: randomUUID(),
              title: "Hình dạng lãnh thổ",
              type: "multiple_choice",
              points: 1,
              question: "Lãnh thổ Việt Nam có hình dạng như thế nào?",
              options: {
                "A": "Hình chữ nhật",
                "B": "Hình chữ S",
                "C": "Hình tròn",
                "D": "Hình vuông"
              },
              correctOption: "B",
              hint: "Lãnh thổ Việt Nam có hình chữ S, kéo dài từ Bắc xuống Nam.",
              created_at: "2025-01-01T00:00:03.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Chiều dài lãnh thổ",
              type: "multiple_choice",
              points: 1,
              question: "Chiều dài lãnh thổ Việt Nam từ Bắc xuống Nam khoảng bao nhiêu?",
              options: {
                "A": "Khoảng 1.000 km",
                "B": "Khoảng 1.650 km",
                "C": "Khoảng 2.000 km",
                "D": "Khoảng 500 km"
              },
              correctOption: "B",
              hint: "Lãnh thổ Việt Nam kéo dài từ Bắc xuống Nam khoảng 1.650 km.",
              created_at: "2025-01-01T00:00:04.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Tự luận: Hình dạng lãnh thổ",
              type: "essay",
              points: 2,
              question: "Em hãy mô tả hình dạng lãnh thổ Việt Nam.",
              hint: "Hãy nêu hình dạng và đặc điểm của lãnh thổ Việt Nam.",
              answer: "Lãnh thổ Việt Nam có hình chữ S, kéo dài từ Bắc xuống Nam khoảng 1.650 km. Bề ngang hẹp nhất chỉ khoảng 50 km ở Quảng Bình. Việt Nam có đường bờ biển dài hơn 3.260 km.",
              created_at: "2025-01-01T00:00:05.000Z"
            }
          ]
        },
        {
          code: "GEO5-CH1-L3",
          title: "Miền Bắc",
          exercises: [
            {
              uuid: randomUUID(),
              title: "Khí hậu miền Bắc",
              type: "multiple_choice",
              points: 1,
              question: "Miền Bắc có khí hậu như thế nào?",
              options: {
                "A": "Nóng quanh năm",
                "B": "Nhiệt đới gió mùa, có mùa đông lạnh",
                "C": "Lạnh quanh năm",
                "D": "Khô hạn"
              },
              correctOption: "B",
              hint: "Miền Bắc có khí hậu nhiệt đới gió mùa, có mùa đông lạnh.",
              created_at: "2025-01-01T00:00:06.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Thành phố lớn miền Bắc",
              type: "multiple_choice",
              points: 1,
              question: "Thành phố nào sau đây thuộc miền Bắc?",
              options: {
                "A": "Thành phố Hồ Chí Minh",
                "B": "Hà Nội",
                "C": "Cần Thơ",
                "D": "Đà Nẵng"
              },
              correctOption: "B",
              hint: "Hà Nội là thủ đô, nằm ở miền Bắc Việt Nam.",
              created_at: "2025-01-01T00:00:07.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Tự luận: Đặc điểm miền Bắc",
              type: "essay",
              points: 2,
              question: "Em hãy nêu đặc điểm địa hình và khí hậu của miền Bắc.",
              hint: "Hãy nêu về địa hình và khí hậu đặc trưng của miền Bắc.",
              answer: "Miền Bắc có khí hậu nhiệt đới gió mùa, có mùa đông lạnh. Địa hình đa dạng với đồng bằng sông Hồng, trung du và miền núi phía Bắc. Các tỉnh thành phố lớn: Hà Nội, Hải Phòng, Quảng Ninh.",
              created_at: "2025-01-01T00:00:08.000Z"
            }
          ]
        },
        {
          code: "GEO5-CH1-L4",
          title: "Miền Trung",
          exercises: [
            {
              uuid: randomUUID(),
              title: "Địa hình miền Trung",
              type: "multiple_choice",
              points: 1,
              question: "Địa hình miền Trung có đặc điểm gì?",
              options: {
                "A": "Rộng và bằng phẳng",
                "B": "Hẹp, dốc từ Tây sang Đông",
                "C": "Toàn bộ là núi cao",
                "D": "Toàn bộ là đồng bằng"
              },
              correctOption: "B",
              hint: "Miền Trung có địa hình hẹp, dốc từ Tây sang Đông.",
              created_at: "2025-01-01T00:00:09.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Thiên tai miền Trung",
              type: "multiple_choice",
              points: 1,
              question: "Miền Trung thường chịu ảnh hưởng của thiên tai nào?",
              options: {
                "A": "Động đất",
                "B": "Bão lũ",
                "C": "Tuyết rơi",
                "D": "Hạn hán kéo dài"
              },
              correctOption: "B",
              hint: "Miền Trung thường xuyên chịu ảnh hưởng của bão lũ.",
              created_at: "2025-01-01T00:00:10.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Tự luận: Đặc điểm miền Trung",
              type: "essay",
              points: 2,
              question: "Em hãy nêu đặc điểm địa hình và khí hậu của miền Trung.",
              hint: "Hãy nêu về địa hình hẹp và khí hậu khắc nghiệt của miền Trung.",
              answer: "Miền Trung có địa hình hẹp, dốc từ Tây sang Đông. Có nhiều dãy núi chạy dọc theo bờ biển. Khí hậu khắc nghiệt, thường xuyên chịu ảnh hưởng của bão lũ. Các tỉnh thành: Đà Nẵng, Huế, Quy Nhơn.",
              created_at: "2025-01-01T00:00:11.000Z"
            }
          ]
        },
        {
          code: "GEO5-CH1-L5",
          title: "Miền Nam",
          exercises: [
            {
              uuid: randomUUID(),
              title: "Khí hậu miền Nam",
              type: "multiple_choice",
              points: 1,
              question: "Miền Nam có khí hậu như thế nào?",
              options: {
                "A": "Nóng quanh năm, có 2 mùa",
                "B": "Lạnh quanh năm",
                "C": "Có 4 mùa rõ rệt",
                "D": "Khô hạn"
              },
              correctOption: "A",
              hint: "Miền Nam có khí hậu nhiệt đới gió mùa, nóng quanh năm, có 2 mùa: mùa khô và mùa mưa.",
              created_at: "2025-01-01T00:00:12.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Đồng bằng miền Nam",
              type: "multiple_choice",
              points: 1,
              question: "Đồng bằng nào là vựa lúa lớn nhất cả nước?",
              options: {
                "A": "Đồng bằng sông Hồng",
                "B": "Đồng bằng sông Cửu Long",
                "C": "Đồng bằng Duyên hải miền Trung",
                "D": "Đồng bằng Thanh Hóa"
              },
              correctOption: "B",
              hint: "Đồng bằng sông Cửu Long là vựa lúa lớn nhất cả nước.",
              created_at: "2025-01-01T00:00:13.000Z"
            },
            {
              uuid: randomUUID(),
              title: "Tự luận: Đặc điểm miền Nam",
              type: "essay",
              points: 2,
              question: "Em hãy nêu đặc điểm địa hình và khí hậu của miền Nam.",
              hint: "Hãy nêu về đồng bằng sông Cửu Long và khí hậu nóng quanh năm của miền Nam.",
              answer: "Miền Nam có khí hậu nhiệt đới gió mùa, nóng quanh năm. Có đồng bằng sông Cửu Long rộng lớn, màu mỡ. Các thành phố lớn: Thành phố Hồ Chí Minh, Cần Thơ, An Giang.",
              created_at: "2025-01-01T00:00:14.000Z"
            }
          ]
        }
      ]
    }
  ]
};

// Function to add more exercises to reach 15 per chapter
function addExercisesToChapter(chapter: Chapter, targetCount: number = 15) {
  chapter.lessons.forEach((lesson, lessonIndex) => {
    const currentCount = lesson.exercises.length;
    const essayCount = lesson.exercises.filter(e => e.type === 'essay').length;
    
    // Ensure at least 1 essay per lesson
    if (essayCount === 0 && lesson.exercises.length > 0) {
      const lastExercise = lesson.exercises[lesson.exercises.length - 1];
      const baseTime = new Date(lastExercise.created_at).getTime();
      
      lesson.exercises.push({
        uuid: randomUUID(),
        title: `Tự luận: Nêu hiểu biết của em về ${lesson.title}`,
        type: "essay",
        points: 2,
        question: `Nêu hiểu biết của em về ${lesson.title} (Câu ${lesson.exercises.length + 1}/15)`,
        hint: `Hãy viết ngắn gọn, rõ ràng về ${lesson.title}.`,
        answer: `Đây là câu trả lời ngắn gọn về ${lesson.title}. Kiến thức cơ bản cần được trình bày rõ ràng và dễ hiểu.`,
        created_at: new Date(baseTime + 1000).toISOString()
      });
    }
    
    // Add multiple choice exercises to reach target
    const exercisesToAdd = targetCount - lesson.exercises.length;
    for (let i = 0; i < exercisesToAdd; i++) {
      const lastExercise = lesson.exercises[lesson.exercises.length - 1];
      const baseTime = new Date(lastExercise.created_at).getTime();
      const exerciseNum = lesson.exercises.length + 1;
      
      lesson.exercises.push({
        uuid: randomUUID(),
        title: `Câu hỏi bổ sung về ${lesson.title}`,
        type: "multiple_choice",
        points: 1,
        question: `Câu hỏi bổ sung về ${lesson.title} (Câu ${exerciseNum}/15)`,
        options: {
          "A": "Đáp án A",
          "B": "Đáp án B (Đúng)",
          "C": "Đáp án C",
          "D": "Đáp án D"
        },
        correctOption: "B",
        hint: `Hãy suy nghĩ về kiến thức cơ bản của ${lesson.title}.`,
        created_at: new Date(baseTime + (i + 1) * 1000).toISOString()
      });
    }
  });
  
  // Ensure chapter has at least 15 exercises total
  let totalExercises = 0;
  chapter.lessons.forEach(lesson => {
    totalExercises += lesson.exercises.length;
  });
  
  if (totalExercises < targetCount) {
    // Distribute remaining exercises across lessons
    const remaining = targetCount - totalExercises;
    const exercisesPerLesson = Math.ceil(remaining / chapter.lessons.length);
    
    chapter.lessons.forEach(lesson => {
      const lastExercise = lesson.exercises[lesson.exercises.length - 1];
      const baseTime = new Date(lastExercise.created_at).getTime();
      
      for (let i = 0; i < exercisesPerLesson && lesson.exercises.length < targetCount / chapter.lessons.length; i++) {
        const exerciseNum = lesson.exercises.length + 1;
        lesson.exercises.push({
          uuid: randomUUID(),
          title: `Câu hỏi bổ sung về ${lesson.title}`,
          type: "multiple_choice",
          points: 1,
          question: `Câu hỏi bổ sung về ${lesson.title} (Câu ${exerciseNum}/15)`,
          options: {
            "A": "Đáp án A",
            "B": "Đáp án B (Đúng)",
            "C": "Đáp án C",
            "D": "Đáp án D"
          },
          correctOption: "B",
          hint: `Hãy suy nghĩ về kiến thức cơ bản của ${lesson.title}.`,
          created_at: new Date(baseTime + (i + 1) * 1000).toISOString()
        });
      }
    });
  }
}

// Process all chapters
grade5EasyExercises.chapters.forEach(chapter => {
  addExercisesToChapter(chapter, 15);
});

// Write to file
const outputPath = path.join(process.cwd(), 'fixtures/geography/grade5-2025-geography-easy.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(grade5EasyExercises, null, 2), 'utf-8');

console.log('✅ Created grade5-2025-geography-easy.json');
console.log(`   Chapters: ${grade5EasyExercises.chapters.length}`);
grade5EasyExercises.chapters.forEach(chapter => {
  let total = 0;
  chapter.lessons.forEach(lesson => {
    total += lesson.exercises.length;
  });
  console.log(`   ${chapter.name}: ${total} exercises`);
});

