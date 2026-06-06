export class TrialExpiredError extends Error {
  constructor(message: string = 'Tu período de prueba ha expirado. Activa tu plan para continuar.') {
    super(message);
    this.name = 'TrialExpiredError';
  }
}

export function isDbTrialExpiredError(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const message = error.message || '';
  const hint = error.hint || '';
  
  return (
    code === 'P0001' && 
    (message.includes('trial_expired') || hint.toLowerCase().includes('prueba') || hint.toLowerCase().includes('expirado'))
  );
}
