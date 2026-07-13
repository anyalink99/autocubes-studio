import assert from 'node:assert/strict';
import {AssistantApiError, createAssistantResponse} from '../dev-server/assistant-api';

const requests: unknown[] = [];
const fakeClient = {
  responses: {
    create: async (request: unknown) => {
      requests.push(request);
      return {
        id: 'resp_test',
        model: 'gpt-test',
        output_text: 'Test answer',
        usage: {input_tokens: 4, output_tokens: 2},
      };
    },
  },
};

const main = async () => {
  const result = await createAssistantResponse({
    prompt: 'Hello',
    previousResponseId: 'resp_previous',
    maxOutputTokens: 200,
  }, {
    model: 'gpt-test',
    instructions: 'Be concise.',
    client: fakeClient,
  });

  assert.equal(result.answer, 'Test answer');
  assert.equal(result.responseId, 'resp_test');
  assert.deepEqual(requests[0], {
    model: 'gpt-test',
    input: 'Hello',
    instructions: 'Be concise.',
    previous_response_id: 'resp_previous',
    max_output_tokens: 200,
  });

  await assert.rejects(
    () => createAssistantResponse({prompt: 'Hello'}, {}),
    (error) => error instanceof AssistantApiError && error.statusCode === 503,
  );

  await assert.rejects(
    () => createAssistantResponse({prompt: ''}, {client: fakeClient}),
    (error) => error instanceof AssistantApiError && error.statusCode === 400,
  );

  console.log('Assistant API QA passed');
};

void main();
