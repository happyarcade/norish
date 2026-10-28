"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { InputGroup, Label, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { signIn } from "@norish/shared/lib/auth/client";

interface EmailPasswordFormProps {
  callbackUrl?: string;
  registrationEnabled?: boolean;
}

export function EmailPasswordForm({
  callbackUrl = "/",
  registrationEnabled = false,
}: EmailPasswordFormProps) {
  const t = useTranslations("auth.emailPassword");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setError(result.error.message || t("errors.invalidCredentials"));
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
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            type="password"
          />
        </InputGroup>
      </TextField>

      {error && <p className="text-small text-danger text-center">{error}</p>}

      <Button
        fullWidth
        className="mt-2"
        isDisabled={!email || !password}
        isPending={isLoading}
        type="submit"
        variant="primary"
      >
        {t("signIn")}
      </Button>

      {registrationEnabled && (
        <p className="text-small text-default-500 text-center">
          {t("noAccount")}{" "}
          <Link
            className="text-primary text-sm font-medium hover:underline"
            href={`/signup${callbackUrl !== "/" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
          >
            {t("signUp")}
          </Link>
        </p>
      )}
    </form>
  );
}
