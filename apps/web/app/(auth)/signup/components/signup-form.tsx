"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EnvelopeIcon, LockClosedIcon, UserIcon } from "@heroicons/react/24/outline";
import { Description, InputGroup, Label, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { signUp } from "@norish/shared/lib/auth/client";

interface SignupFormProps {
  callbackUrl?: string;
}

export function SignupForm({ callbackUrl = "/" }: SignupFormProps) {
  const t = useTranslations("auth.signup");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const isFormValid = name && email && password && confirmPassword && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordsMatch) {
      setError(t("errors.passwordMismatch"));

      return;
    }

    if (password.length < 8) {
      setError(t("errors.passwordTooShort"));

      return;
    }

    if (password.length > 128) {
      setError(t("errors.passwordTooLong"));

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signUp.email({
        name,
        email: email.trim().toLowerCase(),
        password,
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setError(result.error.message || t("errors.createFailed"));
      } else {
        router.push(callbackUrl);
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <TextField
        fullWidth
        isRequired
        value={name}
        onChange={(value) => {
          setName(value);
          setError(null);
        }}
      >
        <Label>{t("name")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <UserIcon className="text-default-400 h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input autoComplete="name" placeholder={t("namePlaceholder")} type="text" />
        </InputGroup>
      </TextField>

      <TextField
        fullWidth
        isRequired
        value={email}
        onChange={(value) => {
          setEmail(value);
          setError(null);
        }}
      >
        <Label>{t("email")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <EnvelopeIcon className="text-default-400 h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            placeholder={t("emailPlaceholder")}
            spellCheck={false}
            type="email"
          />
        </InputGroup>
      </TextField>

      <TextField
        fullWidth
        isRequired
        value={password}
        onChange={(value) => {
          setPassword(value);
          setError(null);
        }}
      >
        <Label>{t("password")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <LockClosedIcon className="text-default-400 h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            type="password"
          />
        </InputGroup>
        <Description>{t("passwordDescription")}</Description>
      </TextField>

      <TextField
        fullWidth
        isRequired
        value={confirmPassword}
        onChange={(value) => {
          setConfirmPassword(value);
          setError(null);
        }}
      >
        <Label>{t("confirmPassword")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <LockClosedIcon className="text-default-400 h-4 w-4" />
          </InputGroup.Prefix>
          <InputGroup.Input
            autoComplete="new-password"
            placeholder={t("confirmPasswordPlaceholder")}
            type="password"
          />
        </InputGroup>
      </TextField>

      {error && <p className="text-small text-danger text-center">{error}</p>}

      <Button
        fullWidth
        className="mt-2"
        isDisabled={!isFormValid}
        isPending={isLoading}
        type="submit"
        variant="primary"
      >
        {t("createAccount")}
      </Button>

      <p className="text-small text-default-500 text-center">
        {t("hasAccount")}{" "}
        <Link
          className="text-primary text-sm font-medium hover:underline"
          href={`/login${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
        >
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
