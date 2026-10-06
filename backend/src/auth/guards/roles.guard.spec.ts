import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

// Минимальный ExecutionContext: RolesGuard использует только обработчик, класс и request.user
function contextFor(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: string[] | undefined) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('пропускает запрос, если для метода роли не заданы', () => {
    expect(guardRequiring(undefined).canActivate(contextFor({ role: 'EMPLOYEE' }))).toBe(true);
    expect(guardRequiring([]).canActivate(contextFor({ role: 'EMPLOYEE' }))).toBe(true);
  });

  it('пропускает пользователя, чья роль входит в список разрешённых', () => {
    const guard = guardRequiring(['OFFICE_MANAGER', 'ADMIN']);
    expect(guard.canActivate(contextFor({ role: 'OFFICE_MANAGER' }))).toBe(true);
    expect(guard.canActivate(contextFor({ role: 'ADMIN' }))).toBe(true);
  });

  it('отклоняет пользователя с другой ролью (403)', () => {
    const guard = guardRequiring(['OFFICE_MANAGER', 'ADMIN']);
    expect(() => guard.canActivate(contextFor({ role: 'EMPLOYEE' }))).toThrow(ForbiddenException);
  });

  it('отклоняет запрос без пользователя в контексте (403)', () => {
    const guard = guardRequiring(['ADMIN']);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
