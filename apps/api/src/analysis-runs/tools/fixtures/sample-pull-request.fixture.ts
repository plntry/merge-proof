import type { ChangedFile, PrMetadata } from '../tool.types.js';

export const SAMPLE_PR_METADATA: PrMetadata = {
  repository: 'merge-proof',
  pullRequestNumber: 42,
  title: 'Add organization credit validation',
  description:
    'Prevent reviews when an organization has no credits. Credits must be consumed only for successfully created reviews, and callers may spend credits only for organizations they can access.',
  author: 'mergeproof-dev',
  baseBranch: 'main',
  headBranch: 'feature/organization-credit-validation',
};

export const SAMPLE_CHANGED_FILES: ChangedFile[] = [
  {
    path: 'src/reviews/reviews.controller.ts',
    status: 'modified',
    additions: 6,
    deletions: 1,
  },
  {
    path: 'src/reviews/reviews.service.ts',
    status: 'modified',
    additions: 18,
    deletions: 2,
  },
  {
    path: 'src/organizations/organizations.repository.ts',
    status: 'modified',
    additions: 14,
    deletions: 1,
  },
  {
    path: 'src/reviews/reviews.service.spec.ts',
    status: 'modified',
    additions: 32,
    deletions: 0,
  },
];

export const SAMPLE_REPOSITORY_FILES: Readonly<Record<string, string>> = {
  'src/reviews/reviews.controller.ts': `export class ReviewsController {
  create(dto: CreateReviewDto): Promise<Review> {
    return this.reviewsService.create(dto);
  }
}`,
  'src/reviews/reviews.service.ts': `export class ReviewsService {
  async create(input: CreateReviewInput): Promise<Review> {
    const remainingCredits = await this.organizationsRepository.consumeCredit(
      input.organizationId,
    );

    if (remainingCredits === undefined) {
      throw new BadRequestException('Organization has no available credits');
    }

    return this.reviewRepository.save(input);
  }
}`,
  'src/organizations/organizations.repository.ts': `export class OrganizationsRepository {
  async consumeCredit(organizationId: string): Promise<number | undefined> {
    const result = await this.pool.query(
      'UPDATE organizations SET credits = credits - 1 WHERE id = $1 AND credits > 0 RETURNING credits',
      [organizationId],
    );

    return result.rows[0]?.credits;
  }
}`,
  'src/reviews/reviews.service.spec.ts': `describe('ReviewsService', () => {
  it('rejects review creation when the organization has no credits', async () => {
    organizationsRepository.consumeCredit.mockResolvedValue(undefined);
    await expect(service.create(input)).rejects.toThrow(BadRequestException);
  });
});`,
};
