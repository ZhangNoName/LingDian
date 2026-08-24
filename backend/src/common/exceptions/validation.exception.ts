import type { ValidationError } from 'class-validator';
import { LegalConsentUpdateRequiredException, ParamException } from './app.exception';

export function createValidationException(errors: ValidationError[]): Error {
  if (hasProperty(errors, 'legalConsent')) {
    return new LegalConsentUpdateRequiredException();
  }

  const message = errors
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .filter(Boolean)
    .join('; ');
  return new ParamException(message || 'Request parameters are invalid');
}

function hasProperty(errors: ValidationError[], property: string): boolean {
  return errors.some((error) =>
    error.property === property || hasProperty(error.children ?? [], property),
  );
}
