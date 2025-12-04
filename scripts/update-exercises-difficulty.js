const fs = require('fs');
const path = require('path');

// Math exercises by lesson and difficulty
const mathExercises = {
  'MATH7-CH1-L1': {
    medium: {
      mc: [
        'So sánh số hữu tỉ có tử và mẫu âm/dương khác nhau',
        'Sắp xếp dãy số hữu tỉ theo thứ tự tăng dần',
        'Tìm số hữu tỉ nằm giữa hai số hữu tỉ cho trước',
        'Xác định số hữu tỉ lớn nhất/nhỏ nhất trong một tập hợp',
        'Chuyển đổi và so sánh số hữu tỉ ở các dạng khác nhau'
      ],
      essay: [
        'Tự luận: Rút gọn các phân số sau: a) $\\frac{15}{25}$   b) $-\\frac{18}{27}$   c) $\\frac{42}{-56}$   d) $\\frac{96}{120}$',
        'Tự luận: Sắp xếp các số hữu tỉ sau theo thứ tự giảm dần: $-\\frac{3}{4}$, $\\frac{5}{6}$, $-\\frac{2}{3}$, $\\frac{1}{2}$, $0$ và giải thích cách làm'
      ]
    },
    hard: {
      mc: [
        'Bài toán vận dụng số hữu tỉ trong bài toán chuyển động / công việc đơn giản',
        'Chứng minh một biểu thức chứa số hữu tỉ luôn nhận giá trị không đổi',
        'Tìm điều kiện để một phân số là số hữu tỉ dương/âm',
        'Giải bài toán tìm số hữu tỉ thỏa mãn nhiều điều kiện',
        'Vận dụng tính chất số hữu tỉ để giải bài toán thực tế'
      ],
      essay: [
        'Tự luận (nâng cao): Chứng minh rằng giữa hai số hữu tỉ bất kỳ luôn tồn tại ít nhất một số hữu tỉ khác',
        'Tự luận (nâng cao): Cho $a, b$ là hai số hữu tỉ. Chứng minh rằng $\\frac{a+b}{2}$ cũng là số hữu tỉ và nằm giữa $a$ và $b$'
      ]
    }
  },
  'MATH7-CH1-L2': {
    medium: {
      mc: [
        'Tính giá trị biểu thức có cộng, trừ nhiều số hữu tỉ',
        'Tính giá trị biểu thức có nhân, chia số hữu tỉ (có rút gọn)',
        'Giải bài toán thực tế đơn giản sử dụng số hữu tỉ',
        'Tìm giá trị của biến trong biểu thức số hữu tỉ',
        'Áp dụng tính chất phân phối với số hữu tỉ'
      ],
      essay: [
        'Tự luận: Thực hiện các phép tính sau và rút gọn kết quả: a) $\\frac{5}{6} + \\frac{7}{12}$   b) $\\frac{11}{15} - \\frac{4}{9}$   c) $(\\frac{3}{4} \\cdot \\frac{8}{9}) : \\frac{2}{3}$',
        'Tự luận: Tính giá trị biểu thức: $\\frac{2}{3} \\times (\\frac{5}{6} + \\frac{1}{4}) - \\frac{1}{2} \\div \\frac{3}{8}$'
      ]
    },
    hard: {
      mc: [
        'Biến đổi biểu thức phức tạp với số hữu tỉ',
        'Giải bài toán thực tế nhiều bước sử dụng phép cộng, trừ, nhân, chia số hữu tỉ',
        'Tìm điều kiện của biến để phân thức hữu tỉ có nghĩa',
        'Chứng minh đẳng thức với số hữu tỉ',
        'Vận dụng tính chất số hữu tỉ để giải phương trình đơn giản'
      ],
      essay: [
        'Tự luận (nâng cao): Cho biểu thức $A = \\frac{2x}{3} - \\frac{1}{2} : (\\frac{x}{6} - \\frac{1}{4})$. Tìm điều kiện của $x$ để $A$ có nghĩa và rút gọn $A$',
        'Tự luận (nâng cao): Giải bài toán: Một người đi xe máy từ A đến B với vận tốc $\\frac{40}{3}$ km/h. Nếu đi với vận tốc $\\frac{50}{3}$ km/h thì đến sớm hơn 30 phút. Tính quãng đường AB'
      ]
    }
  },
  'MATH7-CH2-L1': {
    medium: {
      mc: [
        'Tính căn bậc hai của số không phải số chính phương (ước lượng)',
        'So sánh căn bậc hai của các số không phải số chính phương',
        'Tìm số vô tỉ trong một tập hợp số',
        'Áp dụng tính chất căn bậc hai để tính giá trị biểu thức',
        'Nhận biết số hữu tỉ và số vô tỉ trong các trường hợp phức tạp'
      ],
      essay: [
        'Tự luận: Rút gọn các biểu thức sau: a) $\\sqrt{50}$   b) $\\sqrt{\\frac{8}{18}}$   c) $\\sqrt{\\frac{49}{81}}$   d) $2\\sqrt{18} - \\sqrt{8}$',
        'Tự luận: So sánh $\\sqrt{2}$ và $\\frac{3}{2}$ bằng cách bình phương hai vế'
      ]
    },
    hard: {
      mc: [
        'Chứng minh số vô tỉ',
        'Tính giá trị biểu thức chứa nhiều căn bậc hai',
        'Giải bài toán thực tế sử dụng căn bậc hai',
        'Chứng minh tính chất của căn bậc hai',
        'Vận dụng căn bậc hai để giải phương trình đơn giản'
      ],
      essay: [
        'Tự luận (nâng cao): Chứng minh rằng $\\sqrt{2}$ là số vô tỉ bằng phương pháp phản chứng',
        'Tự luận (nâng cao): Rút gọn biểu thức: $\\sqrt{12} + \\sqrt{27} - \\sqrt{48} + \\sqrt{75}$ và tính giá trị của nó'
      ]
    }
  },
  'MATH7-CH2-L2': {
    medium: {
      mc: [
        'Biểu diễn số thực phức tạp trên trục số',
        'So sánh nhiều số thực (bao gồm cả số vô tỉ)',
        'Tìm số thực thỏa mãn điều kiện cho trước',
        'Áp dụng tính chất số thực để giải bài toán',
        'Xác định vị trí số thực trên trục số với độ chính xác cao'
      ],
      essay: [
        'Tự luận: Biểu diễn các số trên trục số: $-\\sqrt{2}, 0, \\frac{3}{2}, \\sqrt{5}, -\\frac{1}{2}$ và sắp xếp theo thứ tự tăng dần',
        'Tự luận: Chứng minh rằng giữa hai số thực bất kỳ luôn tồn tại vô số số thực khác'
      ]
    },
    hard: {
      mc: [
        'Giải bài toán thực tế phức tạp với số thực',
        'Chứng minh tính chất của tập hợp số thực',
        'Vận dụng số thực để giải phương trình',
        'Tìm số thực thỏa mãn nhiều điều kiện đồng thời',
        'Áp dụng tính chất số thực trong bài toán hình học'
      ],
      essay: [
        'Tự luận (nâng cao): Cho $a, b$ là hai số thực dương. Chứng minh rằng $\\frac{a+b}{2} \\geq \\sqrt{ab}$ (bất đẳng thức AM-GM)',
        'Tự luận (nâng cao): Tìm tất cả các số thực $x$ thỏa mãn: $|x - 2| < 3$ và biểu diễn trên trục số'
      ]
    }
  },
  'MATH7-CH3-L1': {
    medium: {
      mc: [
        'Tính số đo góc bù, góc phụ',
        'Xác định góc đối đỉnh trong hình phức tạp',
        'Áp dụng tính chất góc để tính số đo góc chưa biết',
        'Giải bài toán có nhiều góc liên quan',
        'Chứng minh hai góc bằng nhau dựa vào tính chất góc'
      ],
      essay: [
        'Tự luận: Cho hai đường thẳng cắt nhau tạo thành bốn góc. Biết tổng số đo hai góc kề bù bằng $180^\\circ$ và một góc bằng $65^\\circ$. Tính số đo các góc còn lại',
        'Tự luận: Cho hình vẽ có ba đường thẳng cắt nhau. Biết một góc bằng $40^\\circ$. Tính số đo tất cả các góc còn lại'
      ]
    },
    hard: {
      mc: [
        'Bài toán tổng hợp dùng nhiều quan hệ góc',
        'Chứng minh tính chất góc trong hình phức tạp',
        'Giải bài toán góc trong hình học không gian đơn giản',
        'Vận dụng tính chất góc để chứng minh định lý',
        'Áp dụng góc để giải bài toán thực tế'
      ],
      essay: [
        'Tự luận (nâng cao): Cho hình vẽ có hai đường thẳng song song bị cắt bởi một đường thẳng thứ ba. Chứng minh rằng các góc so le trong bằng nhau',
        'Tự luận (nâng cao): Cho tam giác $ABC$ có $\\angle A = 60^\\circ$, $\\angle B = 80^\\circ$. Tia phân giác của $\\angle C$ cắt $AB$ tại $D$. Tính $\\angle ADC$'
      ]
    }
  },
  'MATH7-CH3-L2': {
    medium: {
      mc: [
        'Tính số đo góc so le trong, đồng vị khi biết một góc',
        'Chứng minh hai đường thẳng song song dựa vào góc',
        'Áp dụng tính chất góc so le trong, đồng vị để tính góc',
        'Giải bài toán có nhiều cặp góc so le trong, đồng vị',
        'Xác định quan hệ giữa các góc trong hình có đường song song'
      ],
      essay: [
        'Tự luận: Cho hai đường thẳng song song $a$ và $b$ bị cắt bởi đường thẳng $c$. Biết một góc đồng vị bằng $75^\\circ$. Tính số đo tất cả các góc còn lại',
        'Tự luận: Chứng minh rằng nếu một đường thẳng cắt hai đường thẳng song song thì các góc so le trong bằng nhau'
      ]
    },
    hard: {
      mc: [
        'Chứng minh hai đường thẳng song song bằng nhiều cách',
        'Giải bài toán góc phức tạp với nhiều đường song song',
        'Vận dụng tính chất góc để chứng minh định lý',
        'Áp dụng góc so le trong, đồng vị trong bài toán hình học',
        'Giải bài toán thực tế sử dụng tính chất đường song song'
      ],
      essay: [
        'Tự luận (nâng cao): Cho hình vẽ có ba đường thẳng song song bị cắt bởi hai đường thẳng. Chứng minh rằng các đoạn thẳng tương ứng tỉ lệ',
        'Tự luận (nâng cao): Cho tam giác $ABC$. Qua điểm $D$ trên cạnh $AB$, vẽ đường thẳng song song với $BC$ cắt $AC$ tại $E$. Chứng minh $\\frac{AD}{DB} = \\frac{AE}{EC}$'
      ]
    }
  },
  'MATH7-CH4-L1': {
    medium: {
      mc: [
        'Xác định trường hợp bằng nhau của tam giác trong bài toán phức tạp',
        'Chứng minh hai tam giác bằng nhau từ nhiều dữ kiện',
        'Áp dụng tính chất tam giác bằng nhau để tính cạnh, góc',
        'Giải bài toán có nhiều cặp tam giác bằng nhau',
        'Vận dụng tam giác bằng nhau để chứng minh đoạn thẳng bằng nhau'
      ],
      essay: [
        'Tự luận: Cho tam giác $ABC$ và tam giác $DEF$ có $AB = DE$, $BC = EF$, $\\angle B = \\angle E$. Chứng minh $\\triangle ABC = \\triangle DEF$ theo trường hợp c.g.c',
        'Tự luận: Cho tam giác $ABC$ có $M$ là trung điểm của $BC$. Chứng minh rằng nếu $AM$ là đường trung tuyến thì $AM$ chia tam giác thành hai tam giác bằng nhau'
      ]
    },
    hard: {
      mc: [
        'Chứng minh tam giác bằng nhau trong hình phức tạp',
        'Vận dụng tam giác bằng nhau để chứng minh tính chất hình học',
        'Giải bài toán tổng hợp sử dụng nhiều trường hợp bằng nhau',
        'Áp dụng tam giác bằng nhau trong bài toán thực tế',
        'Chứng minh định lý sử dụng tính chất tam giác bằng nhau'
      ],
      essay: [
        'Tự luận (nâng cao): Cho tam giác $ABC$ cân tại $A$. Gọi $D$ và $E$ lần lượt là trung điểm của $AB$ và $AC$. Chứng minh $\\triangle ABE = \\triangle ACD$',
        'Tự luận (nâng cao): Cho hình thang $ABCD$ ($AB \\parallel CD$). Gọi $M$ và $N$ lần lượt là trung điểm của $AD$ và $BC$. Chứng minh $MN = \\frac{AB + CD}{2}$'
      ]
    }
  },
  'MATH7-CH4-L2': {
    medium: {
      mc: [
        'Áp dụng tam giác bằng nhau để tính độ dài cạnh, số đo góc',
        'Chứng minh hai đoạn thẳng bằng nhau bằng tam giác bằng nhau',
        'Giải bài toán có nhiều bước sử dụng tam giác bằng nhau',
        'Vận dụng tam giác bằng nhau để chứng minh đường thẳng song song',
        'Áp dụng tính chất tam giác bằng nhau trong bài toán thực tế'
      ],
      essay: [
        'Tự luận: Cho tam giác $ABC$ có $AB = AC$. Gọi $D$ là điểm trên cạnh $BC$ sao cho $AD$ là đường phân giác. Chứng minh $\\triangle ABD = \\triangle ACD$',
        'Tự luận: Cho hình vẽ có $MN \\parallel BC$ trong tam giác $ABC$. Chứng minh rằng $\\frac{AM}{AB} = \\frac{AN}{AC}$'
      ]
    },
    hard: {
      mc: [
        'Chứng minh tính chất hình học phức tạp bằng tam giác bằng nhau',
        'Giải bài toán tổng hợp nhiều bước với tam giác bằng nhau',
        'Vận dụng tam giác bằng nhau để chứng minh định lý',
        'Áp dụng tam giác bằng nhau trong bài toán hình học nâng cao',
        'Chứng minh đẳng thức hình học sử dụng tam giác bằng nhau'
      ],
      essay: [
        'Tự luận (nâng cao): Cho tam giác $ABC$ có $M$ là trung điểm của $BC$. Trên tia đối của tia $MA$ lấy điểm $D$ sao cho $MA = MD$. Chứng minh $AB = CD$ và $AB \\parallel CD$',
        'Tự luận (nâng cao): Cho hình thang $ABCD$ ($AB \\parallel CD$). Gọi $E$ và $F$ lần lượt là trung điểm của $AD$ và $BC$. Chứng minh $EF = \\frac{AB + CD}{2}$ và $EF \\parallel AB$'
      ]
    }
  },
  'MATH7-CH5-L1': {
    medium: {
      mc: [
        'Phân tích và xử lý dữ liệu phức tạp hơn',
        'Tính các đại lượng thống kê cơ bản (trung bình, tổng)',
        'Nhận xét và đánh giá chất lượng dữ liệu',
        'So sánh dữ liệu từ nhiều nguồn khác nhau',
        'Áp dụng phương pháp thu thập dữ liệu phù hợp'
      ],
      essay: [
        'Tự luận: Thu thập và lập bảng thống kê điểm kiểm tra Toán của 10 học sinh. Tính điểm trung bình và nhận xét',
        'Tự luận: Lập bảng thống kê số giờ học mỗi ngày của 5 học sinh trong một tuần. Tính tổng số giờ và trung bình mỗi ngày'
      ]
    },
    hard: {
      mc: [
        'Phân tích dữ liệu và đưa ra kết luận',
        'Tính các đại lượng thống kê nâng cao',
        'Đánh giá độ tin cậy của dữ liệu',
        'Vận dụng thống kê để giải bài toán thực tế',
        'So sánh và phân tích xu hướng từ dữ liệu'
      ],
      essay: [
        'Tự luận (nâng cao): Thu thập dữ liệu về chiều cao của 15 học sinh. Lập bảng thống kê, tính chiều cao trung bình, tìm giá trị lớn nhất và nhỏ nhất, và nhận xét',
        'Tự luận (nâng cao): Khảo sát số sách đọc trong tháng của 20 học sinh. Phân tích dữ liệu và đưa ra nhận xét về thói quen đọc sách'
      ]
    }
  },
  'MATH7-CH5-L2': {
    medium: {
      mc: [
        'Đọc và phân tích biểu đồ cột, đoạn thẳng phức tạp',
        'So sánh dữ liệu từ nhiều biểu đồ',
        'Tính toán dựa trên biểu đồ',
        'Nhận xét xu hướng từ biểu đồ',
        'Vẽ biểu đồ từ bảng số liệu cho trước'
      ],
      essay: [
        'Tự luận: Cho bảng số liệu về nhiệt độ trung bình các tháng trong năm. Vẽ biểu đồ đoạn thẳng và nhận xét xu hướng thay đổi nhiệt độ',
        'Tự luận: Vẽ biểu đồ cột biểu diễn số học sinh giỏi các môn Toán, Văn, Anh của một lớp. So sánh và nhận xét'
      ]
    },
    hard: {
      mc: [
        'Phân tích và dự đoán xu hướng từ biểu đồ',
        'So sánh và đánh giá dữ liệu từ nhiều biểu đồ',
        'Vận dụng biểu đồ để giải bài toán thực tế',
        'Đọc và phân tích biểu đồ kết hợp',
        'Tính toán và suy luận từ biểu đồ phức tạp'
      ],
      essay: [
        'Tự luận (nâng cao): Cho biểu đồ cột biểu diễn doanh thu 4 quý trong năm. Phân tích xu hướng, tính tổng doanh thu, quý có doanh thu cao nhất và thấp nhất, và đưa ra nhận xét',
        'Tự luận (nâng cao): Vẽ và phân tích biểu đồ đoạn thẳng biểu diễn số lượng học sinh tham gia câu lạc bộ qua 6 tháng. Nhận xét xu hướng và dự đoán số lượng học sinh tháng tiếp theo'
      ]
    }
  },
  'MATH7-CH6-L1': {
    medium: {
      mc: [
        'Kết hợp kiến thức số hữu tỉ và số thực trong bài toán',
        'Tính giá trị biểu thức phức tạp với số hữu tỉ và căn bậc hai',
        'So sánh và sắp xếp số hữu tỉ và số thực',
        'Giải bài toán tổng hợp về số hữu tỉ và số thực',
        'Vận dụng tính chất số hữu tỉ và số thực'
      ],
      essay: [
        'Tự luận: Tính giá trị biểu thức: $\\frac{1}{2} + \\sqrt{4} - \\frac{3}{5} \\times \\sqrt{\\frac{9}{25}}$',
        'Tự luận: Sắp xếp các số sau theo thứ tự tăng dần: $\\sqrt{2}, \\frac{3}{2}, -1, 0, \\sqrt{9}, -\\frac{1}{2}, \\sqrt{5}$'
      ]
    },
    hard: {
      mc: [
        'Giải bài toán tổng hợp nâng cao về số hữu tỉ và số thực',
        'Chứng minh tính chất liên quan đến số hữu tỉ và số thực',
        'Vận dụng số hữu tỉ và số thực trong bài toán thực tế phức tạp',
        'Áp dụng tính chất số hữu tỉ và số thực để giải phương trình',
        'Giải bài toán đòi hỏi tư duy tổng hợp cao'
      ],
      essay: [
        'Tự luận (nâng cao): Chứng minh rằng tổng của một số hữu tỉ và một số vô tỉ là số vô tỉ',
        'Tự luận (nâng cao): Tìm tất cả các số thực $x$ thỏa mãn: $|x - \\frac{1}{2}| < 2$ và $x > -1$. Biểu diễn trên trục số'
      ]
    }
  },
  'MATH7-CH6-L2': {
    medium: {
      mc: [
        'Kết hợp kiến thức hình học và dữ liệu trong bài toán',
        'Áp dụng tính chất góc và tam giác bằng nhau',
        'Đọc và phân tích biểu đồ kết hợp với tính toán',
        'Giải bài toán tổng hợp về hình học và dữ liệu',
        'Vận dụng nhiều kiến thức cùng lúc'
      ],
      essay: [
        'Tự luận: Cho biểu đồ cột thể hiện số bài tập Toán, Văn, Anh một học sinh làm trong tuần. Tính tổng số bài tập, môn nào làm nhiều nhất, và nhận xét',
        'Tự luận: Cho hình vẽ có hai đường thẳng song song bị cắt bởi một đường thẳng thứ ba. Biết một góc bằng $45^\\circ$. Tính số đo tất cả các góc còn lại'
      ]
    },
    hard: {
      mc: [
        'Giải bài toán tổng hợp nâng cao về hình học và dữ liệu',
        'Chứng minh tính chất hình học phức tạp',
        'Phân tích và dự đoán từ dữ liệu thống kê',
        'Vận dụng nhiều kiến thức để giải bài toán thực tế',
        'Giải bài toán đòi hỏi tư duy tổng hợp và sáng tạo'
      ],
      essay: [
        'Tự luận (nâng cao): Cho tam giác $ABC$ có $AB = AC$. Gọi $D$ là trung điểm của $BC$. Chứng minh $AD \\perp BC$ và $AD$ là đường phân giác của $\\angle A$',
        'Tự luận (nâng cao): Phân tích biểu đồ cột và đoạn thẳng biểu diễn số học sinh tham gia các câu lạc bộ qua 6 tháng. So sánh xu hướng, tính tổng số học sinh, và đưa ra nhận xét chi tiết'
      ]
    }
  }
};

// Update Math medium and hard files
['medium', 'hard'].forEach(difficulty => {
  const filePath = path.join(__dirname, '..', 'fixtures', 'math', `grade7-2025-math-${difficulty}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  data.lessons = data.lessons.map(lesson => {
    const exercises = mathExercises[lesson.code]?.[difficulty];
    if (exercises) {
      const exerciseList = [
        ...exercises.mc.map(title => ({
          title,
          type: 'multiple_choice',
          points: difficulty === 'medium' ? 2 : 3
        })),
        ...exercises.essay.map(title => ({
          title,
          type: 'essay',
          points: difficulty === 'medium' ? 3 : 4
        }))
      ];
      return { ...lesson, exercises: exerciseList };
    }
    return lesson;
  });
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated ${filePath}`);
});

// English exercises by lesson and difficulty
const englishExercises = {
  'ENG7-CH1-L1': {
    medium: {
      mc: [
        'Choose the best answer: There ______ a big kitchen in my house. (A) is (B) are (C) be',
        'Choose the best answer: There ______ two bedrooms upstairs. (A) is (B) are (C) am',
        'Choose the best option: Our living room is on the ______ floor. (A) one (B) first (C) firstly',
        'Complete the sentence: The ______ has a sofa and a TV. (A) bedroom (B) living room (C) bathroom',
        'Choose the correct form: There ______ many rooms in my house. (A) is (B) are (C) be'
      ],
      essay: [
        'Writing: Describe your house in 5–6 sentences (number of rooms, what is in each room, which room you like most and why).',
        'Writing: Write a paragraph comparing your house with your friend\'s house. Use "There is/There are" and descriptive adjectives.'
      ]
    },
    hard: {
      mc: [
        'Choose the best answer: My house ______ a small garden and a big garage. (A) have (B) has (C) is having',
        'Choose the best answer: There ______ three bedrooms but there ______ only one bathroom. (A) is / is (B) are / is (C) are / are',
        'Choose the best answer: The room ______ a large window that looks out over the street. (A) has (B) is (C) have',
        'Choose the correct sentence: (A) My house has got a beautiful garden. (B) My house have got a beautiful garden. (C) My house is got a beautiful garden.',
        'Complete: The kitchen is ______ the ground floor, ______ the dining room. (A) in / next to (B) on / next to (C) at / beside'
      ],
      essay: [
        'Writing (advanced): Write a paragraph (8–10 sentences) describing your dream house. Include where it is, how many rooms it has, what special things there are in each room, and why you like it.',
        'Writing (advanced): Write an essay comparing living in a house versus living in an apartment. Discuss advantages and disadvantages of each.'
      ]
    }
  },
  'ENG7-CH1-L2': {
    medium: {
      mc: [
        'Choose the best answer: Students usually have lunch in the ______. (A) library (B) canteen (C) classroom',
        'Choose the best answer: We can borrow books from the ______. (A) playground (B) gym (C) library',
        'Choose the correct sentence: (A) There are a big playground at my school. (B) There is a big playground at my school. (C) There be a big playground at my school.',
        'Complete: The science lab is ______ the second floor. (A) in (B) on (C) at',
        'Choose: We do experiments in the ______. (A) library (B) laboratory (C) canteen'
      ],
      essay: [
        'Writing: Write 5 sentences to describe your school (buildings, playground, library, canteen, etc.).',
        'Writing: Write a paragraph about your favorite place at school and explain why you like it.'
      ]
    },
    hard: {
      mc: [
        'Choose the best answer: Our school library is ______ place for students who love reading. (A) a quiet (B) quiet (C) the quiet',
        'Choose the best answer: The science lab is ______ the second floor, next ______ the computer room. (A) in / to (B) on / to (C) on / to the',
        'Choose the best answer: There ______ many trees around the playground, so it is very cool in summer. (A) is (B) are (C) be',
        'Complete: The gymnasium is ______ the sports field, ______ students can play basketball. (A) near / where (B) next to / which (C) beside / that',
        'Choose: We have our chemistry lessons in the ______ on the third floor. (A) laboratory (B) library (C) canteen'
      ],
      essay: [
        'Writing (advanced): Write a paragraph (8–10 sentences) describing your school, focusing on special places (library, labs, playground, canteen) and how students use them every day.',
        'Writing (advanced): Write an essay about how school facilities affect students\' learning. Discuss the importance of different places in a school.'
      ]
    }
  },
  'ENG7-CH1-L3': {
    medium: {
      mc: [
        'Choose the best answer: He ______ to school at 7 a.m. (A) go (B) goes (C) going',
        'Choose the best answer: They ______ TV in the evening. (A) watch (B) watches (C) watching',
        'Choose the best answer: She ______ breakfast at 6:30 every day. (A) have (B) has (C) having',
        'Choose the correct adverb: I ______ do my homework after dinner. (A) always (B) always do (C) do always',
        'Complete: My sister ______ up at 6 o\'clock. (A) get (B) gets (C) getting'
      ],
      essay: [
        'Writing: Write a short paragraph (6–8 sentences) about your weekday routine using Present Simple and adverbs of frequency (always, usually, often, sometimes, never).',
        'Writing: Write about your weekend routine and compare it with your weekday routine.'
      ]
    },
    hard: {
      mc: [
        'Choose the best answer: She ______ her homework before dinner every day. (A) do (B) does (C) is doing',
        'Choose the best answer: My parents ______ TV in the evening but they ______ go to bed late. (A) watch / don\'t (B) watches / don\'t (C) watch / doesn\'t',
        'Choose the best answer: How often ______ you ______ English outside the classroom? (A) do / practise (B) does / practise (C) do / practises',
        'Complete: I ______ to the library twice a week to study. (A) go (B) goes (C) am going',
        'Choose: They ______ their friends on weekends. (A) meet (B) meets (C) is meeting'
      ],
      essay: [
        'Writing (advanced): Write a diary-style paragraph (8–10 sentences) describing a typical school day for you. Use Present Simple and at least three adverbs of frequency (always, usually, often, sometimes, never).',
        'Writing (advanced): Write an essay comparing your daily routine with your best friend\'s routine. Use Present Simple and time expressions.'
      ]
    }
  },
  'ENG7-CH2-L1': {
    medium: {
      mc: [
        'Choose the best answer: I have a ______. I can\'t eat anything. (A) headache (B) toothache (C) stomachache',
        'Choose the best answer: You ______ drink more water. (A) should (B) shouldn\'t (C) mustn\'t',
        'Choose the best answer: He has a fever, so he ______ go to school today. (A) should (B) shouldn\'t (C) can',
        'Complete: I have a sore throat. I ______ see a doctor. (A) should (B) shouldn\'t (C) must',
        'Choose: You look tired. You ______ go to bed early. (A) should (B) shouldn\'t (C) can\'t'
      ],
      essay: [
        'Writing: Write 4–5 sentences giving advice to a friend who has a cold (using "should" and "shouldn\'t").',
        'Writing: Write a paragraph about what you should and shouldn\'t do to stay healthy.'
      ]
    },
    hard: {
      mc: [
        'Choose the best answer: You look very tired. You ______ go to bed earlier. (A) should (B) shouldn\'t (C) mustn\'t',
        'Choose the best answer: You have a toothache. You ______ eat too many sweets. (A) should (B) shouldn\'t (C) can',
        'Choose the best answer: She has a high fever, so she ______ stay at home and ______ see a doctor. (A) should / should (B) shouldn\'t / should (C) should / shouldn\'t',
        'Complete: If you have a headache, you ______ take medicine and ______ rest. (A) should / should (B) shouldn\'t / should (C) should / shouldn\'t',
        'Choose: He feels dizzy. He ______ drive a car. (A) should (B) shouldn\'t (C) must'
      ],
      essay: [
        'Writing (advanced): Write a short email (8–10 sentences) to a friend who is ill, describing his/her health problems and giving advice using "should" and "shouldn\'t".',
        'Writing (advanced): Write an essay about healthy lifestyle habits. Discuss what people should and shouldn\'t do to maintain good health.'
      ]
    }
  },
  'ENG7-CH2-L2': {
    medium: {
      mc: [
        'Choose the best answer: My favourite ______ is playing badminton. (A) hobby (B) job (C) food',
        'Choose the best answer: I ______ collecting stamps. (A) am interested in (B) am interested (C) interested in',
        'Choose the best answer: He ______ reading books in his free time. (A) like (B) likes (C) is like',
        'Complete: She is good ______ drawing. (A) at (B) in (C) on',
        'Choose: My hobby is ______ music. (A) listen to (B) listening to (C) to listen'
      ],
      essay: [
        'Writing: Write a short paragraph (5–7 sentences) about your favourite hobby (what it is, when you do it, who you do it with, why you enjoy it).',
        'Writing: Write about a hobby you would like to try and explain why it interests you.'
      ]
    },
    hard: {
      mc: [
        'Choose the best answer: I ______ playing chess because it helps me think carefully. (A) enjoy (B) am enjoy (C) enjoys',
        'Choose the best answer: She is very good ______ drawing and painting. (A) at (B) in (C) on',
        'Choose the best answer: My brother ______ collecting coins for five years. (A) has (B) has been (C) has been',
        'Complete: I spend my free time ______ novels and ______ to music. (A) reading / listening (B) read / listen (C) to read / to listen',
        'Choose: Her hobby is ______ photographs of nature. (A) take (B) taking (C) to take'
      ],
      essay: [
        'Writing (advanced): Write a paragraph (10–12 sentences) about a hobby that is good for your health. Explain what it is, how to do it, and why it is healthy.',
        'Writing (advanced): Write an essay comparing two different hobbies and discuss which one you prefer and why.'
      ]
    }
  }
};

// English easy exercises
const englishEasyExercises = {
  'ENG7-CH1-L1': {
    mc: [
      'Choose the correct word: This is the ______ (kitchen / pencil).',
      'Match the words with pictures: bedroom, bathroom, living room, garden.',
      'Choose the correct option: I sleep in the ______ (bedroom / kitchen).',
      'Complete: There ______ a sofa in the living room. (A) is (B) are (C) be',
      'Choose: The ______ is where we cook food. (A) bedroom (B) kitchen (C) bathroom)'
    ],
    essay: [
      'Writing: Write 3 simple sentences to describe your house (for example: There is a living room. There are two bedrooms. ...).',
      'Writing: Write 4 sentences about the rooms in your house and what you do in each room.'
    ]
  },
  'ENG7-CH1-L2': {
    mc: [
      'Choose the correct place: We read books in the ______ (library / bathroom).',
      'Choose the correct answer: We have lunch in the ______ (canteen / garden).',
      'Choose the correct sentence: (A) There is a playground at my school. (B) There are a playground at my school.',
      'Complete: We do experiments in the ______. (A) library (B) laboratory (C) canteen',
      'Choose: Students play sports in the ______. (A) library (B) playground (C) classroom'
    ],
    essay: [
      'Writing: Write 3 sentences about your school using "There is / There are" (for example: There is a library. There are 20 classrooms. ...).',
      'Writing: Write 4 sentences describing your favorite place at school and why you like it.'
    ]
  },
  'ENG7-CH1-L3': {
    mc: [
      'Choose the correct form: She ______ (get / gets) up at 6 a.m.',
      'Choose the correct adverb: He ______ (always / never) does his homework.',
      'Choose the correct sentence: (A) I go to school every day. (B) I goes to school every day.',
      'Complete: They ______ breakfast at 7 o\'clock. (A) have (B) has (C) having',
      'Choose: My sister ______ to school by bus. (A) go (B) goes (C) going'
    ],
    essay: [
      'Writing: Write 4 sentences about your daily routine using Present Simple (for example: I get up at 6 a.m. I have breakfast at 6:30. ...).',
      'Writing: Write 5 sentences about what you do on weekends using Present Simple.'
    ]
  },
  'ENG7-CH2-L1': {
    mc: [
      'Choose the correct word: I have a ______ (headache / homework).',
      'Choose the best advice: I have a fever. I ______ (should / shouldn\'t) go to school.',
      'Choose the correct answer: I have a toothache. I should go to the ______ (dentist / teacher).',
      'Complete: You look sick. You ______ see a doctor. (A) should (B) shouldn\'t (C) can',
      'Choose: If you have a cold, you ______ drink warm water. (A) should (B) shouldn\'t (C) must'
    ],
    essay: [
      'Writing: Write 3 sentences giving advice using "should / shouldn\'t" (for example: You should drink water. You shouldn\'t eat too much fast food. ...).',
      'Writing: Write 4 sentences about what you should do to stay healthy.'
    ]
  },
  'ENG7-CH2-L2': {
    mc: [
      'Choose the correct word: My favourite ______ is reading. (hobby / healthy)',
      'Choose the best answer: I ______ playing football. (like / am interested)',
      'Choose the correct phrase: (A) I am interested in music. (B) I am interest in music.',
      'Complete: She likes ______ books. (A) read (B) reading (C) to read',
      'Choose: My hobby is ______ stamps. (A) collect (B) collecting (C) to collect'
    ],
    essay: [
      'Writing: Write 4 sentences about your hobby (what it is, when you do it, why you like it).',
      'Writing: Write 5 sentences about a hobby you would like to try and why.'
    ]
  }
};

// Update English easy file
const englishEasyPath = path.join(__dirname, '..', 'fixtures', 'english', 'grade7-2025-english-easy.json');
const englishEasyData = JSON.parse(fs.readFileSync(englishEasyPath, 'utf8'));

englishEasyData.lessons = englishEasyData.lessons.map(lesson => {
  const exercises = englishEasyExercises[lesson.code];
  if (exercises) {
    const exerciseList = [
      ...exercises.mc.map(title => ({
        title,
        type: 'multiple_choice',
        points: 1
      })),
      ...exercises.essay.map(title => ({
        title,
        type: 'essay',
        points: 2
      }))
    ];
    return { ...lesson, exercises: exerciseList };
  }
  return lesson;
});

fs.writeFileSync(englishEasyPath, JSON.stringify(englishEasyData, null, 2) + '\n', 'utf8');
console.log(`✓ Updated ${englishEasyPath}`);

// Update English medium and hard files
['medium', 'hard'].forEach(difficulty => {
  const filePath = path.join(__dirname, '..', 'fixtures', 'english', `grade7-2025-english-${difficulty}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  data.lessons = data.lessons.map(lesson => {
    const exercises = englishExercises[lesson.code]?.[difficulty];
    if (exercises) {
      const exerciseList = [
        ...exercises.mc.map(title => ({
          title,
          type: 'multiple_choice',
          points: difficulty === 'medium' ? 2 : 3
        })),
        ...exercises.essay.map(title => ({
          title,
          type: 'essay',
          points: difficulty === 'medium' ? 3 : 4
        }))
      ];
      return { ...lesson, exercises: exerciseList };
    }
    return lesson;
  });
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated ${filePath}`);
});

console.log('\n✅ All exercises updated with appropriate difficulty levels!');

