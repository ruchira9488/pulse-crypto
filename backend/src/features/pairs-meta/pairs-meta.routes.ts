import type { FastifyInstance } from 'fastify';
import type { PairsMetaService } from './pairs-meta.service';

export function registerPairsMetaRoutes(app: FastifyInstance, service: PairsMetaService): void {
  app.get('/pairs/meta', async (_req, reply) => {
    const body = await service.get();
    reply.header('cache-control', 'no-store');
    return body;
  });
}
