import { createServer } from 'node:http';

const port = Number(process.env.MOCK_OPENAI_PORT ?? 4010);
const findings = [
  { title: 'Missing boundary validation', description: 'The change accepts data before checking the required boundary.', severity: 'medium', confidence: 0.9 },
  { title: 'Uncovered failure path', description: 'The changed failure path does not preserve the expected invariant.', severity: 'medium', confidence: 0.9 },
  { title: 'Ambiguous state transition', description: 'The updated state transition can leave related records inconsistent.', severity: 'medium', confidence: 0.9 },
];

const server = createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/responses') {
    response.writeHead(404).end();
    return;
  }
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    const requestBody = JSON.parse(body);
    const isRequirementsAgent = String(requestBody.instructions).includes("MergeProof's requirements analysis agent");
    const output = JSON.stringify({ findings: isRequirementsAgent ? findings : [] });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      id: `resp_fake_${Date.now()}`,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed',
      model: requestBody.model,
      output: [{
        id: `msg_fake_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', annotations: [], text: output }],
      }],
      usage: {
        input_tokens: 64,
        output_tokens: 32,
        total_tokens: 96,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    }));
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Fake Responses API listening on http://127.0.0.1:${port}/v1\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
