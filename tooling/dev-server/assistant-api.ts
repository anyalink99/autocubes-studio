import OpenAI from 'openai';

export type AssistantRequest = {
  prompt: string;
  previousResponseId?: string;
  maxOutputTokens?: number;
};

type ResponsesClient = {
  responses: {
    create(request: {
      model: string;
      input: string;
      instructions?: string;
      previous_response_id?: string;
      max_output_tokens?: number;
    }): Promise<{
      id: string;
      model: string;
      output_text: string;
      usage?: unknown;
    }>;
  };
};

export type AssistantConfig = {
  apiKey?: string;
  model?: string;
  instructions?: string;
  client?: ResponsesClient;
};

export type AssistantResult = {
  answer: string;
  responseId: string;
  model: string;
  usage?: unknown;
};

export class AssistantApiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'AssistantApiError';
  }
}

const validateRequest = (request: AssistantRequest) => {
  if (typeof request.prompt !== 'string' || !request.prompt.trim()) {
    throw new AssistantApiError('A non-empty prompt is required', 400);
  }
  if (request.prompt.length > 100_000) {
    throw new AssistantApiError('Prompt exceeds 100,000 characters', 413);
  }
  if (request.previousResponseId !== undefined && (
    typeof request.previousResponseId !== 'string'
    || request.previousResponseId.length > 256
    || !/^[a-zA-Z0-9_-]+$/.test(request.previousResponseId)
  )) {
    throw new AssistantApiError('previousResponseId is invalid', 400);
  }
  if (request.maxOutputTokens !== undefined && (
    !Number.isInteger(request.maxOutputTokens)
    || request.maxOutputTokens < 1
    || request.maxOutputTokens > 32_768
  )) {
    throw new AssistantApiError('maxOutputTokens must be an integer from 1 to 32768', 400);
  }
};

export const createAssistantResponse = async (
  request: AssistantRequest,
  config: AssistantConfig,
): Promise<AssistantResult> => {
  validateRequest(request);
  if (!config.apiKey && !config.client) throw new AssistantApiError('OPENAI_API_KEY is not configured', 503);

  const model = config.model?.trim() || 'gpt-5.6';
  const client = config.client ?? new OpenAI({apiKey: config.apiKey}) as unknown as ResponsesClient;
  const input = {
    model,
    input: request.prompt.trim(),
    ...(config.instructions?.trim() ? {instructions: config.instructions.trim()} : {}),
    ...(request.previousResponseId ? {previous_response_id: request.previousResponseId} : {}),
    ...(request.maxOutputTokens ? {max_output_tokens: request.maxOutputTokens} : {}),
  };

  try {
    const response = await client.responses.create(input);
    if (!response.id || !response.output_text?.trim()) {
      throw new AssistantApiError('OpenAI returned a response without text', 502);
    }
    return {
      answer: response.output_text.trim(),
      responseId: response.id,
      model: response.model || model,
      ...(response.usage === undefined ? {} : {usage: response.usage}),
    };
  } catch (error) {
    if (error instanceof AssistantApiError) throw error;
    const upstreamStatus = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as {status: unknown}).status)
      : Number.NaN;
    const statusCode = Number.isInteger(upstreamStatus) && upstreamStatus >= 400 && upstreamStatus < 500
      ? upstreamStatus
      : 502;
    const message = error instanceof Error ? error.message : String(error);
    throw new AssistantApiError(`OpenAI request failed: ${message}`, statusCode);
  }
};
