export function fakeToolResponse(
  id: string,
  callId: string,
  name: string,
  argumentsValue: object,
) {
  return {
    id,
    status: 'completed',
    output: [
      {
        type: 'function_call',
        call_id: callId,
        name,
        arguments: JSON.stringify(argumentsValue),
      },
    ],
    output_parsed: null,
  };
}

export function fakeFinalResponse(findings: unknown[] = []) {
  return {
    id: 'final-response',
    status: 'completed',
    output: [],
    output_parsed: { findings },
  };
}
