import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Grade essay submission from image using OpenAI Vision
 */
export async function gradeEssayFromImage(
  imageUrl: string,
  question: string,
  correctAnswer: string,
  studentAnswer?: string
): Promise<{
  score: number;
  feedback: string;
  isCorrect: boolean;
}> {
  try {
    const prompt = `You are a teacher grading a student's handwritten answer.

Question: ${question}
Correct Answer: ${correctAnswer}
${studentAnswer ? `Student's Answer (if visible): ${studentAnswer}` : ''}

Please:
1. Analyze the student's handwritten answer in the image
2. Grade it on a scale of 0-100
3. Provide constructive feedback
4. Determine if the answer is correct (score >= 70)

Respond in JSON format:
{
  "score": number (0-100),
  "feedback": "detailed feedback in Vietnamese",
  "isCorrect": boolean
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o instead of GPT-4 Vision (cheaper)
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      score: result.score || 0,
      feedback: result.feedback || 'Không thể chấm bài.',
      isCorrect: result.isCorrect || false,
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to grade essay');
  }
}

/**
 * Grade multiple essay images
 */
export async function gradeMultipleEssays(
  imageUrls: string[],
  questions: Array<{ question: string; answer: string }>
): Promise<Array<{ score: number; feedback: string; isCorrect: boolean }>> {
  const results = await Promise.all(
    imageUrls.map((imageUrl, index) => {
      const questionData = questions[index];
      if (!questionData) {
        return {
          score: 0,
          feedback: 'Không tìm thấy câu hỏi tương ứng.',
          isCorrect: false,
        };
      }
      return gradeEssayFromImage(imageUrl, questionData.question, questionData.answer);
    })
  );

  return results;
}

