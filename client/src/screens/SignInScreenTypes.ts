import type { FormEvent, MouseEvent } from "react";

type SignInStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type SignInScreenProps = {
  step: "email" | "code";
  email: string;
  code: string;
  status: SignInStatus;
  googleClientId: string;
  onEmailChange: (nextEmail: string) => void;
  onCodeChange: (nextCode: string) => void;
  onRequestCode: (
    event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
  ) => void;
  onVerifyCode: (event: FormEvent<HTMLFormElement>) => void;
  onGoogleCredential: (credential: string) => void;
  onPasskeySignIn: () => void;
  onResetEmail: () => void;
};

export type { SignInScreenProps, SignInStatus };
