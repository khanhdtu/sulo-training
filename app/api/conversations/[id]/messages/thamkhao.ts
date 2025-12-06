import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ResponseConfig } from '../response-configs/entities/response-config.entity';
import { User } from '../users/entities/user.entity';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

interface UsageStats {
  model: string;
  method: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: number;
  cached?: boolean;
}

interface DailyUsage {
  date: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  byMethod: Record<string, { requests: number; tokens: number; cost: number }>;
  cacheHits: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly defaultModel: string;
  private readonly cheapModel: string;
  private readonly cacheEnabled: boolean;
  private readonly cacheTTL: number;
  private readonly monitoringEnabled: boolean;

  // Model pricing per 1M tokens (approximate, update based on actual pricing)
  private readonly modelPricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set. OpenAI features will not work.');
    }
    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });

    // Model configuration
    this.defaultModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o';
    this.cheapModel = this.configService.get<string>('OPENAI_CHEAP_MODEL') || 'gpt-3.5-turbo';

    // Cache configuration
    this.cacheEnabled = this.configService.get<string>('OPENAI_CACHE_ENABLED') !== 'false';
    this.cacheTTL =
      parseInt(this.configService.get<string>('OPENAI_CACHE_TTL') || '3600', 10) || 3600; // Default 1 hour

    // Monitoring configuration
    this.monitoringEnabled =
      this.configService.get<string>('OPENAI_MONITORING_ENABLED') !== 'false';
  }

  async generateAnswer(
    question: string,
    questionImageUrl?: string | null,
    user?: User,
    responseConfig?: ResponseConfig | null,
  ): Promise<string> {
    if (!this.configService.get<string>('OPENAI_API_KEY')) {
      throw new Error('OpenAI API key is not configured');
    }

    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(
        'answer',
        question,
        questionImageUrl,
        user,
        responseConfig,
      );
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for answer generation');
        // Track cache hit
        if (this.monitoringEnabled) {
          await this.trackUsage({
            model: this.selectModel(question, questionImageUrl, responseConfig),
            method: 'generateAnswer',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            timestamp: Date.now(),
            cached: true,
          });
        }
        return cached;
      }
    }

    // Build prompt based on response config
    const prompt = this.buildPrompt(question, user, responseConfig);

    // Select model based on complexity
    const model = this.selectModel(question, questionImageUrl, responseConfig);
    const maxTokens = this.calculateMaxTokens(responseConfig);

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: questionImageUrl
            ? [
                { type: 'text', text: question },
                {
                  type: 'image_url',
                  image_url: {
                    url: questionImageUrl.startsWith('http')
                      ? questionImageUrl
                      : `${this.configService.get<string>('APP_URL') || 'http://localhost:3009'}${questionImageUrl}`,
                  },
                },
              ]
            : question,
        },
      ];

      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
      });

      const answer = completion.choices[0]?.message?.content || '';

      // Track usage
      if (this.monitoringEnabled) {
        const usage = completion.usage;
        await this.trackUsage({
          model,
          method: 'generateAnswer',
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
          estimatedCost: this.calculateCost(
            model,
            usage?.prompt_tokens || 0,
            usage?.completion_tokens || 0,
          ),
          timestamp: Date.now(),
          cached: false,
        });
      }

      // Cache the result
      if (this.cacheEnabled && answer) {
        const cacheKey = this.generateCacheKey(
          'answer',
          question,
          questionImageUrl,
          user,
          responseConfig,
        );
        await this.redisService.set(cacheKey, answer, this.cacheTTL);
      }

      // Log usage
      if (completion.usage) {
        const cost = this.calculateCost(
          model,
          completion.usage.prompt_tokens,
          completion.usage.completion_tokens,
        );
        this.logger.log(
          `OpenAI usage - Model: ${model}, Tokens: ${completion.usage.total_tokens} (prompt: ${completion.usage.prompt_tokens}, completion: ${completion.usage.completion_tokens}), Estimated cost: $${cost.toFixed(6)}`,
        );
      }

      return answer;
    } catch (error: any) {
      this.logger.error('OpenAI API error:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  async analyzeConversation(
    question: string,
    answer: string,
    user?: User,
  ): Promise<{
    detectedGrade?: number;
    detectedSubject?: string;
    knowledgeLevel?: string;
    confidenceScore?: number;
    detectedTopics?: string;
    learningGaps?: string;
    strengths?: string;
    recommendations?: string;
    recommendedTopics?: string;
  }> {
    if (!this.configService.get<string>('OPENAI_API_KEY')) {
      throw new Error('OpenAI API key is not configured');
    }

    const prompt = `Analyze the following educational conversation and provide a JSON response with the following structure:
{
  "detectedGrade": number (1-9, the grade level detected from the question),
  "detectedSubject": string (e.g., "math", "physics", "chemistry", "literature"),
  "knowledgeLevel": string ("beginner", "intermediate", "advanced", "expert"),
  "confidenceScore": number (0-100),
  "detectedTopics": string (comma-separated list of topics covered in this question),
  "learningGaps": string (areas where the student needs improvement),
  "strengths": string (areas where the student shows strength),
  "recommendations": string (suggestions for further learning),
  "recommendedTopics": string (comma-separated list of related topics the student should learn next, based on the current question and answer. These should be topics that build upon or relate to the detectedTopics, suitable for the student's grade level and knowledge level)
}

Question: ${question}
Answer provided: ${answer}
User grade: ${user?.grade || 'unknown'}

Important: Provide 3-5 recommended topics that are:
- Related to the current question's topic
- Appropriate for the student's grade level
- Build upon or expand from the detectedTopics
- Help the student progress in their learning journey

Respond ONLY with valid JSON, no additional text.`;

    try {
      // Use cheaper model for analysis (simpler task)
      const model = this.cheapModel;
      const maxTokens = 1500; // Increased for recommended topics

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an educational assessment expert. Analyze conversations and provide structured JSON responses. Always respond in Vietnamese (Tiếng Việt). All text fields in JSON must be in Vietnamese.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
      });

      const analysisText = completion.choices[0]?.message?.content || '{}';

      // Track usage
      if (this.monitoringEnabled) {
        const usage = completion.usage;
        await this.trackUsage({
          model,
          method: 'analyzeConversation',
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
          estimatedCost: this.calculateCost(
            model,
            usage?.prompt_tokens || 0,
            usage?.completion_tokens || 0,
          ),
          timestamp: Date.now(),
          cached: false,
        });
      }

      // Log usage
      if (completion.usage) {
        const cost = this.calculateCost(
          model,
          completion.usage.prompt_tokens,
          completion.usage.completion_tokens,
        );
        this.logger.log(
          `OpenAI usage - Model: ${model}, Method: analyzeConversation, Tokens: ${completion.usage.total_tokens}, Estimated cost: $${cost.toFixed(6)}`,
        );
      }

      return JSON.parse(analysisText);
    } catch (error: any) {
      this.logger.error('OpenAI analysis error:', error);
      throw new Error(`Failed to analyze conversation: ${error.message}`);
    }
  }

  async checkAnswer(
    question: string,
    answerImageUrl: string,
    correctAnswer?: string,
  ): Promise<{
    isCorrect: boolean;
    feedback: string;
    errors?: string[];
    suggestions?: string;
  }> {
    if (!this.configService.get<string>('OPENAI_API_KEY')) {
      throw new Error('OpenAI API key is not configured');
    }

    const prompt = `You are a teacher checking a student's answer. 
Question: ${question}
${correctAnswer ? `Expected answer: ${correctAnswer}` : ''}

Analyze the image of the student's answer and provide a JSON response:
{
  "isCorrect": boolean,
  "feedback": string (detailed feedback on the answer),
  "errors": string[] (list of specific errors found, if any),
  "suggestions": string (suggestions for improvement, if needed)
}

Respond ONLY with valid JSON, no additional text.`;

    try {
      // Use GPT-4o for image analysis (better vision capabilities)
      const model = this.defaultModel;
      const maxTokens = 1500; // Feedback can be detailed

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a patient and encouraging teacher. Provide constructive feedback. Always respond in Vietnamese (Tiếng Việt). All text fields in JSON (feedback, errors, suggestions) must be in Vietnamese.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: answerImageUrl.startsWith('http')
                    ? answerImageUrl
                    : `${this.configService.get<string>('APP_URL') || 'http://localhost:3009'}${answerImageUrl}`,
                },
              },
            ],
          },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
      });

      const resultText = completion.choices[0]?.message?.content || '{}';

      // Track usage
      if (this.monitoringEnabled) {
        const usage = completion.usage;
        await this.trackUsage({
          model,
          method: 'checkAnswer',
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
          estimatedCost: this.calculateCost(
            model,
            usage?.prompt_tokens || 0,
            usage?.completion_tokens || 0,
          ),
          timestamp: Date.now(),
          cached: false,
        });
      }

      // Log usage
      if (completion.usage) {
        const cost = this.calculateCost(
          model,
          completion.usage.prompt_tokens,
          completion.usage.completion_tokens,
        );
        this.logger.log(
          `OpenAI usage - Model: ${model}, Method: checkAnswer, Tokens: ${completion.usage.total_tokens}, Estimated cost: $${cost.toFixed(6)}`,
        );
      }

      return JSON.parse(resultText);
    } catch (error: any) {
      this.logger.error('OpenAI answer check error:', error);
      throw new Error(`Failed to check answer: ${error.message}`);
    }
  }

  async clarifyAnswer(question: string, previousAnswer: string): Promise<string> {
    if (!this.configService.get<string>('OPENAI_API_KEY')) {
      throw new Error('OpenAI API key is not configured');
    }

    const prompt = `The student says they still do not fully understand the previous explanation.

You must:
- Explain the concept again in an even simpler and clearer way, step by step.
- Use friendly and encouraging Vietnamese (Tiếng Việt).
- Highlight 1–2 key formulas or ideas on separate lines so they are easy to see.
- Then give exactly ONE new practice problem that is similar in difficulty and topic to the original question, and guide the student on how to start solving it (but do NOT give the full final answer immediately).

Original question (from the student):
${question}

Previous explanation (from you):
${previousAnswer}

Now write the new explanation and the similar practice problem in Vietnamese.`;

    try {
      const model = this.selectModel(question, undefined, null);
      const maxTokens = 1500;

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a very patient Vietnamese tutor. When the student does not understand, you explain again more simply, step by step, and you give a similar practice problem. Always answer in Vietnamese (Tiếng Việt).',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_tokens: maxTokens,
      });

      const answer = completion.choices[0]?.message?.content || '';

      if (this.monitoringEnabled && completion.usage) {
        await this.trackUsage({
          model,
          method: 'clarifyAnswer',
          promptTokens: completion.usage.prompt_tokens || 0,
          completionTokens: completion.usage.completion_tokens || 0,
          totalTokens: completion.usage.total_tokens || 0,
          estimatedCost: this.calculateCost(
            model,
            completion.usage.prompt_tokens || 0,
            completion.usage.completion_tokens || 0,
          ),
          timestamp: Date.now(),
          cached: false,
        });
      }

      return answer;
    } catch (error: any) {
      this.logger.error('OpenAI clarify answer error:', error);
      throw new Error(`Failed to clarify answer: ${error.message}`);
    }
  }

  private buildPrompt(
    question: string,
    user?: User,
    responseConfig?: ResponseConfig | null,
  ): string {
    let prompt = `You are a friendly and patient teacher for ${
      user?.grade || 'elementary'
    } grade students. Always respond in Vietnamese (Tiếng Việt). `;

    const lowerQuestion = question.toLowerCase();
    const isMath =
      /toán|math|phép cộng|phép trừ|phép nhân|phép chia|phương trình|hình học|đại số|giải hệ|tích phân|đạo hàm|logarit|logarithm/.test(
        lowerQuestion,
      );
    const isPhysics =
      /vật lý|vật li|physics|lực|vận tốc|gia tốc|điện trường|từ trường|cơ học|quang học|nhiệt học/.test(
        lowerQuestion,
      );
    const isChemistry =
      /hóa học|hoa hoc|chemistry|phương trình hóa học|cân bằng phương trình|oxi hoá|khử|axit|bazơ|muối|hợp chất/.test(
        lowerQuestion,
      );

    if (responseConfig) {
      if (responseConfig.useSimpleLanguage) {
        prompt += 'Use simple, easy-to-understand language appropriate for children. ';
      }

      if (responseConfig.includeDefinition) {
        prompt += 'Always explain key definitions clearly. ';
      }

      if (responseConfig.includeExamples) {
        prompt += 'Provide concrete examples to illustrate concepts. ';
      }

      if (responseConfig.includeSteps) {
        prompt += 'Break down solutions into clear, step-by-step instructions. ';
      }

      if (responseConfig.includeAnalogy) {
        prompt += 'Use analogies and comparisons to help students understand. ';
      }

      if (responseConfig.encourageThinking) {
        prompt +=
          'Encourage students to think through problems themselves before providing the answer. ';
      }

      if (responseConfig.customPrompt) {
        prompt += `\n\nAdditional instructions: ${responseConfig.customPrompt}`;
      }
    } else {
      // Default prompt
      prompt +=
        'Use simple language, provide clear explanations with examples, break down solutions into steps, and encourage thinking. ';
    }

    if (isMath || isPhysics || isChemistry) {
      prompt +=
        '\n\nThe student is asking about Math/Physics/Chemistry. When writing formulas or expressions, you must:\n' +
        '- Always use Unicode mathematical and scientific symbols when possible (for example: √16 = 4, √2, x², x³, ½, ¾, H₂O, CO₂).\n' +
        '- Clearly format each important formula on its own separate line so it is easy to read (for example:\n' +
        '  ⭐ Ví dụ: √25 = 5\n' +
        '  ⭐ Ví dụ: x² + y² = z²\n' +
        '  ⭐ Ví dụ: v = s / t\n' +
        ').\n' +
        '- Always provide 1–2 short example expressions using these notations, and when appropriate also show the LaTeX form in parentheses, for example: ⭐ Ví dụ: √25 = 5 (\\(\\sqrt{25} = 5\\)), ⭐ Ví dụ: x² + y² = z² (\\(x^2 + y^2 = z^2\\)).\n';
      if (isChemistry) {
        prompt +=
          '- For chemistry, always write full chemical equations using correct subscripts and arrows in Unicode, each equation on its own line, and when appropriate also show the LaTeX form in parentheses, for example:\n' +
          '  2H₂ + O₂ → 2H₂O (\\(2H_2 + O_2 \\rightarrow 2H_2O\\))\n' +
          '  CaCO₃ → CaO + CO₂ (\\(CaCO_3 \\rightarrow CaO + CO_2\\)).\n';
      }
    }

    prompt +=
      '\n\nWhen answering questions:\n' +
      '- Always respond in Vietnamese (Tiếng Việt)\n' +
      '- Be encouraging and supportive\n' +
      '- Explain concepts clearly\n' +
      '- Help students understand the reasoning behind solutions\n' +
      '- Use age-appropriate language\n' +
      '- Be patient and thorough';

    return prompt;
  }

  /**
   * Select appropriate model based on question complexity
   * Use cheaper model for simple questions, expensive model for complex ones
   */
  private selectModel(
    question: string,
    questionImageUrl?: string | null,
    responseConfig?: ResponseConfig | null,
  ): string {
    // Always use GPT-4o for images (better vision)
    if (questionImageUrl) {
      return this.defaultModel;
    }

    // Use GPT-4o if response config requires detailed explanations
    if (responseConfig) {
      const needsAdvancedModel =
        responseConfig.includeDefinition &&
        responseConfig.includeExamples &&
        responseConfig.includeSteps &&
        responseConfig.includeAnalogy;

      if (needsAdvancedModel) {
        return this.defaultModel;
      }
    }

    // Check question complexity (simple heuristic)
    const questionLength = question.length;
    const hasComplexKeywords = /(calculate|solve|prove|derive|analyze|explain in detail)/i.test(
      question,
    );

    // Use cheaper model for simple questions
    if (questionLength < 100 && !hasComplexKeywords) {
      return this.cheapModel;
    }

    // Default to expensive model for complex questions
    return this.defaultModel;
  }

  /**
   * Calculate optimal max_tokens based on response config
   */
  private calculateMaxTokens(responseConfig?: ResponseConfig | null): number {
    let baseTokens = 500; // Base answer length

    if (responseConfig) {
      if (responseConfig.includeDefinition) baseTokens += 200;
      if (responseConfig.includeExamples) baseTokens += 300;
      if (responseConfig.includeSteps) baseTokens += 400;
      if (responseConfig.includeAnalogy) baseTokens += 200;
      if (responseConfig.customPrompt) baseTokens += 200;
    }

    // Cap at reasonable maximum
    return Math.min(baseTokens, 3000);
  }

  /**
   * Generate cache key from question and context
   */
  private generateCacheKey(
    type: string,
    question: string,
    questionImageUrl?: string | null,
    user?: User,
    responseConfig?: ResponseConfig | null,
  ): string {
    const keyData = {
      type,
      question: question.toLowerCase().trim(),
      imageUrl: questionImageUrl || '',
      userId: user?.id || '',
      grade: user?.grade || '',
      configId: responseConfig?.id || '',
      useSimpleLanguage: responseConfig?.useSimpleLanguage || false,
      includeDefinition: responseConfig?.includeDefinition || false,
      includeExamples: responseConfig?.includeExamples || false,
      includeSteps: responseConfig?.includeSteps || false,
      includeAnalogy: responseConfig?.includeAnalogy || false,
    };

    const keyString = JSON.stringify(keyData);
    const hash = crypto.createHash('sha256').update(keyString).digest('hex');
    return `openai:${type}:${hash}`;
  }

  /**
   * Track usage statistics
   */
  private async trackUsage(stats: UsageStats): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dailyKey = `openai:usage:daily:${date}`;
      const monthlyKey = `openai:usage:monthly:${date.substring(0, 7)}`; // YYYY-MM

      // Get current daily stats
      const dailyStats = (await this.redisService.get<DailyUsage>(dailyKey)) || {
        date,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byMethod: {},
        cacheHits: 0,
      };

      // Update daily stats
      dailyStats.totalRequests += 1;
      if (!stats.cached) {
        dailyStats.totalTokens += stats.totalTokens;
        dailyStats.totalCost += stats.estimatedCost;

        // Update by model
        if (!dailyStats.byModel[stats.model]) {
          dailyStats.byModel[stats.model] = { requests: 0, tokens: 0, cost: 0 };
        }
        dailyStats.byModel[stats.model].requests += 1;
        dailyStats.byModel[stats.model].tokens += stats.totalTokens;
        dailyStats.byModel[stats.model].cost += stats.estimatedCost;

        // Update by method
        if (!dailyStats.byMethod[stats.method]) {
          dailyStats.byMethod[stats.method] = { requests: 0, tokens: 0, cost: 0 };
        }
        dailyStats.byMethod[stats.method].requests += 1;
        dailyStats.byMethod[stats.method].tokens += stats.totalTokens;
        dailyStats.byMethod[stats.method].cost += stats.estimatedCost;
      } else {
        dailyStats.cacheHits += 1;
      }

      // Save daily stats (keep for 90 days)
      await this.redisService.set(dailyKey, dailyStats, 90 * 24 * 3600);

      // Update monthly stats
      const monthlyStats = (await this.redisService.get<DailyUsage>(monthlyKey)) || {
        date: date.substring(0, 7),
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        byModel: {},
        byMethod: {},
        cacheHits: 0,
      };

      monthlyStats.totalRequests += 1;
      if (!stats.cached) {
        monthlyStats.totalTokens += stats.totalTokens;
        monthlyStats.totalCost += stats.estimatedCost;

        if (!monthlyStats.byModel[stats.model]) {
          monthlyStats.byModel[stats.model] = { requests: 0, tokens: 0, cost: 0 };
        }
        monthlyStats.byModel[stats.model].requests += 1;
        monthlyStats.byModel[stats.model].tokens += stats.totalTokens;
        monthlyStats.byModel[stats.model].cost += stats.estimatedCost;

        if (!monthlyStats.byMethod[stats.method]) {
          monthlyStats.byMethod[stats.method] = { requests: 0, tokens: 0, cost: 0 };
        }
        monthlyStats.byMethod[stats.method].requests += 1;
        monthlyStats.byMethod[stats.method].tokens += stats.totalTokens;
        monthlyStats.byMethod[stats.method].cost += stats.estimatedCost;
      } else {
        monthlyStats.cacheHits += 1;
      }

      // Save monthly stats (keep for 1 year)
      await this.redisService.set(monthlyKey, monthlyStats, 365 * 24 * 3600);
    } catch (error) {
      this.logger.error('Failed to track usage:', error);
    }
  }

  /**
   * Calculate estimated cost based on model and tokens
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.modelPricing[model] || this.modelPricing['gpt-3.5-turbo'];
    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Get usage statistics for a specific date or date range
   */
  async getUsageStats(date?: string): Promise<DailyUsage | null> {
    if (!this.monitoringEnabled) {
      return null;
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const key = `openai:usage:daily:${targetDate}`;
    return await this.redisService.get<DailyUsage>(key);
  }

  /**
   * Get monthly usage statistics
   */
  async getMonthlyUsageStats(month?: string): Promise<DailyUsage | null> {
    if (!this.monitoringEnabled) {
      return null;
    }

    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const key = `openai:usage:monthly:${targetMonth}`;
    return await this.redisService.get<DailyUsage>(key);
  }

  /**
   * Get usage summary (today's stats)
   */
  async getUsageSummary(): Promise<{
    today: DailyUsage | null;
    thisMonth: DailyUsage | null;
  }> {
    return {
      today: await this.getUsageStats(),
      thisMonth: await this.getMonthlyUsageStats(),
    };
  }
}
