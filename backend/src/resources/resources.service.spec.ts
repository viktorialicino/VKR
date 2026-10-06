import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ResourcesService } from './resources.service.js';

// Подменяем PrismaService: проверяем только логику переходов статусов, без базы данных
function serviceWithStatus(status: string | null) {
  const prisma = {
    resource: {
      findUnique: vi.fn().mockResolvedValue(status ? { id: 'r1', status } : null),
      update: vi.fn().mockResolvedValue({ id: 'r1' }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'h1' }) },
    resourceLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockResolvedValue([{ id: 'r1', status: 'updated' }]),
  };
  return { prisma, service: new ResourcesService(prisma as unknown as PrismaService) };
}

describe('ResourcesService.changeStatus', () => {
  it.each([
    ['AVAILABLE', 'issue', 'ISSUED', 'ISSUED'],
    ['ISSUED', 'return', 'AVAILABLE', 'RETURNED'],
    ['AVAILABLE', 'repair', 'IN_REPAIR', 'TO_REPAIR'],
    ['ISSUED', 'repair', 'IN_REPAIR', 'TO_REPAIR'],
    ['IN_REPAIR', 'return', 'AVAILABLE', 'RETURNED'],
  ] as const)('из статуса %s действие «%s» переводит в %s и пишет %s в журнал', async (from, action, to, log) => {
    const { prisma, service } = serviceWithStatus(from);
    const holderId = action === 'issue' ? 'h1' : undefined;
    await service.changeStatus('r1', { action, holderId }, 'u1');
    expect(prisma.resource.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' }, data: { status: to, holderId: holderId ?? null } }),
    );
    expect(prisma.resourceLog.create).toHaveBeenCalledWith({
      data: { resourceId: 'r1', userId: 'u1', holderId: holderId ?? null, action: log },
    });
  });

  it.each([
    ['ISSUED', 'issue'],
    ['IN_REPAIR', 'issue'],
    ['AVAILABLE', 'return'],
    ['IN_REPAIR', 'repair'],
  ] as const)('из статуса %s действие «%s» недопустимо (400)', async (from, action) => {
    const { prisma, service } = serviceWithStatus(from);
    await expect(service.changeStatus('r1', { action, holderId: 'h1' }, 'u1')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('выдача без указания сотрудника отклоняется (400), с несуществующим сотрудником — 404', async () => {
    const { prisma, service } = serviceWithStatus('AVAILABLE');
    await expect(service.changeStatus('r1', { action: 'issue' }, 'u1')).rejects.toThrow(BadRequestException);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.changeStatus('r1', { action: 'issue', holderId: 'x' }, 'u1')).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('для несуществующего ресурса возвращает 404', async () => {
    const { service } = serviceWithStatus(null);
    await expect(service.changeStatus('nope', { action: 'issue' }, 'u1')).rejects.toThrow(NotFoundException);
  });
});
