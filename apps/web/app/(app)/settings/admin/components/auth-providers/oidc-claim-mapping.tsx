"use client";

import { ExclamationTriangleIcon, UserGroupIcon } from "@heroicons/react/16/solid";
import { Description, InputGroup, Label, Separator, Switch, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { RestartRequiredChip } from "../restart-required-chip";
import { UnsavedChangesChip } from "../unsaved-changes-chip";

export interface ClaimMappingValues {
  enabled: boolean;
  scopes: string;
  groupsClaim: string;
  adminGroup: string;
  householdPrefix: string;
}

interface OIDCClaimMappingProps {
  values: ClaimMappingValues;
  onChange: (values: ClaimMappingValues) => void;
  isDirty?: boolean;
}

export function OIDCClaimMapping({ values, onChange, isDirty = false }: OIDCClaimMappingProps) {
  const tClaimMapping = useTranslations("settings.admin.authProviders.oidc.claimMapping");

  const updateField = <K extends keyof ClaimMappingValues>(
    field: K,
    value: ClaimMappingValues[K]
  ) => {
    onChange({ ...values, [field]: value });
  };

  return (
    <>
      <Separator className="my-2" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="text-default-500 h-4 w-4" />
          <span className="text-default-700 font-medium">{tClaimMapping("title")}</span>
          {isDirty && <UnsavedChangesChip />}
          <RestartRequiredChip />
        </div>
        <Switch
          aria-label={tClaimMapping("title")}
          isSelected={values.enabled}
          onChange={(enabled) => updateField("enabled", enabled)}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
      <p className="text-default-500 text-sm">{tClaimMapping("description")}</p>

      {values.enabled && (
        <div className="bg-warning-50 border-warning-200 text-warning-700 flex items-start gap-2 rounded-lg border p-3">
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{tClaimMapping("securityWarning")}</p>
        </div>
      )}

      <TextField
        fullWidth
        isDisabled={!values.enabled}
        value={values.scopes}
        onChange={(value) => updateField("scopes", value)}
      >
        <Label>{tClaimMapping("scopes")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Input placeholder={tClaimMapping("scopesPlaceholder")} />
        </InputGroup>
        <Description>{tClaimMapping("scopesDescription")}</Description>
      </TextField>
      <TextField
        fullWidth
        isDisabled={!values.enabled}
        value={values.groupsClaim}
        onChange={(value) => updateField("groupsClaim", value)}
      >
        <Label>{tClaimMapping("groupsClaim")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Input placeholder="groups" />
        </InputGroup>
        <Description>{tClaimMapping("groupsClaimDescription")}</Description>
      </TextField>
      <TextField
        fullWidth
        isDisabled={!values.enabled}
        value={values.adminGroup}
        onChange={(value) => updateField("adminGroup", value)}
      >
        <Label>{tClaimMapping("adminGroup")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Input placeholder="norish_admin" />
        </InputGroup>
        <Description>{tClaimMapping("adminGroupDescription")}</Description>
      </TextField>
      <TextField
        fullWidth
        isDisabled={!values.enabled}
        value={values.householdPrefix}
        onChange={(value) => updateField("householdPrefix", value)}
      >
        <Label>{tClaimMapping("householdPrefix")}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Input placeholder="norish_household_" />
        </InputGroup>
        <Description>{tClaimMapping("householdPrefixDescription")}</Description>
      </TextField>
    </>
  );
}
