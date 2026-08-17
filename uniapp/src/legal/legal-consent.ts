import { LEGAL_DOCUMENT_VERSIONS, type LegalConsentInput } from "@lingdian/contracts";

export class LegalConsentRequiredError extends Error {
  constructor() {
    super("请先阅读并同意《用户服务协议》和《隐私政策》");
    this.name = "LegalConsentRequiredError";
  }
}

export function requireLegalConsent(accepted: boolean): LegalConsentInput {
  if (!accepted) throw new LegalConsentRequiredError();

  return {
    userAgreementVersion: LEGAL_DOCUMENT_VERSIONS.USER_AGREEMENT,
    privacyPolicyVersion: LEGAL_DOCUMENT_VERSIONS.PRIVACY_POLICY,
  };
}

type GuardedLoginAction = <T>(
  action: (legalConsent: LegalConsentInput) => T | Promise<T>,
) => Promise<T | undefined>;

export interface LoginLegalConsentActions {
  sendCode: GuardedLoginAction;
  submit: GuardedLoginAction;
  beginThirdPartyLogin: GuardedLoginAction;
  wechatPhoneLogin: GuardedLoginAction;
}

export function createLoginLegalConsentActions(
  readAccepted: () => boolean,
  notifyRequired: (message: string) => void,
): LoginLegalConsentActions {
  const run: GuardedLoginAction = async (action) => {
    let legalConsent: LegalConsentInput;
    try {
      legalConsent = requireLegalConsent(readAccepted());
    } catch (error) {
      if (error instanceof LegalConsentRequiredError) {
        notifyRequired(error.message);
        return undefined;
      }
      throw error;
    }

    return action(legalConsent);
  };

  return {
    sendCode: run,
    submit: run,
    beginThirdPartyLogin: run,
    wechatPhoneLogin: run,
  };
}
