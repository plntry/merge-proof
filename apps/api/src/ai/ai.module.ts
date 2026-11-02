import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './ai.constants.js';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.getOrThrow<string>('OPENAI_API_KEY');

        return new OpenAI({
          apiKey,
        });
      },
    },
  ],
  exports: [OPENAI_CLIENT],
})
export class AiModule {}
