import { Controller, MessageEvent, Param, Sse } from '@nestjs/common';
import { defer, distinctUntilChanged, exhaustMap, from, interval, map, Observable, startWith, takeWhile } from 'rxjs';
import { AnalysisLiveService } from './analysis-live.service.js';
import { LIVE_TERMINAL_STATUSES } from './analysis-live.types.js';

@Controller('analysis-runs')
export class AnalysisLiveController {
  constructor(private readonly live: AnalysisLiveService) {}

  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return defer(() =>
      interval(1500).pipe(
        startWith(0),
        exhaustMap(() => from(this.live.snapshot(id))),
        map((snapshot) => ({ type: 'snapshot', data: snapshot })),
        distinctUntilChanged(
          (previous, current) => JSON.stringify(previous.data) === JSON.stringify(current.data),
        ),
        takeWhile(
          (event) =>
            !LIVE_TERMINAL_STATUSES.includes(
              event.data.analysisRun.status as (typeof LIVE_TERMINAL_STATUSES)[number],
            ),
          true,
        ),
      ),
    );
  }
}
